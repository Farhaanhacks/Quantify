// Cloudflare R2, over its S3-compatible API.
//
// R2 is the right store for this: filings are written once and read rarely, and
// R2 charges nothing for egress, which is the whole cost of a document archive
// that exists to be checked occasionally rather than served constantly.
//
// The S3 API means AWS Signature Version 4, which is implemented here rather
// than pulled in. The AWS SDK is several megabytes to sign one PUT, and a
// serverless function that carries it pays for the parse on every cold start.
// What follows is the signing procedure itself, which is a fixed sequence of
// SHA-256 and HMAC steps over a canonical form of the request.
//
// The parts that are easy to get wrong, and are therefore written out:
//   * the payload hash goes in a header AND in the canonical request
//   * header names are lower-cased and sorted, and the signed list must match
//     the headers actually sent, exactly
//   * the path is URI-encoded except for the slashes
//   * R2 has no regions, but SigV4 requires one in the scope, and "auto" is
//     what Cloudflare documents

const enc = new TextEncoder();

const hex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? enc.encode(data) : data;
  return hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}

/** Percent-encode a path segment the way S3 expects, leaving slashes alone. */
export function encodeS3Path(path: string): string {
  return path
    .split("/")
    .map((seg) =>
      encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    )
    .join("/");
}

export interface SigV4Input {
  method: string;
  host: string;
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  payloadHash: string;
  /** ISO basic format, e.g. 20260331T101500Z. Injected so it can be tested. */
  amzDate: string;
  extraHeaders?: Record<string, string>;
}

/**
 * The Authorization header for one request.
 *
 * Returned alongside the headers it signed, because the two must agree: a
 * signature over a header list that differs from what is sent is rejected with
 * a message that names neither, and the resulting hunt is long.
 */
export async function signV4(input: SigV4Input): Promise<{
  authorization: string;
  headers: Record<string, string>;
  canonicalRequest: string;
  stringToSign: string;
}> {
  const date = input.amzDate.slice(0, 8);
  const scope = `${date}/${input.region}/${input.service}/aws4_request`;

  const headers: Record<string, string> = {
    host: input.host,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": input.amzDate,
    ...Object.fromEntries(
      Object.entries(input.extraHeaders ?? {}).map(([k, v]) => [k.toLowerCase(), v])
    ),
  };

  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders.map((h) => `${h}:${headers[h].trim()}\n`).join("");
  const signedHeaderList = signedHeaders.join(";");

  const canonicalRequest = [
    input.method.toUpperCase(),
    encodeS3Path(input.path),
    "", // no query string on these requests
    canonicalHeaders,
    signedHeaderList,
    input.payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    input.amzDate,
    scope,
    await sha256(canonicalRequest),
  ].join("\n");

  // The signing key is derived down the scope, one HMAC per component, which is
  // what keeps a leaked daily key from being usable for another day or service.
  let key: ArrayBuffer = await hmac(enc.encode(`AWS4${input.secretAccessKey}`), date);
  key = await hmac(key, input.region);
  key = await hmac(key, input.service);
  key = await hmac(key, "aws4_request");
  const signature = hex(await hmac(key, stringToSign));

  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaderList}, Signature=${signature}`,
    headers,
    canonicalRequest,
    stringToSign,
  };
}

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

/** The timestamp SigV4 wants: 20260331T101500Z. */
export function amzDate(now = new Date()): string {
  return `${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export interface R2PutResult {
  ok: boolean;
  key?: string;
  status?: number;
  error?: string;
}

/**
 * Write one object, and say plainly when it did not work.
 *
 * The status is carried through rather than reduced to a boolean, because the
 * three failures here need different fixes and look identical otherwise: 403 is
 * the key or the signature, 404 is the bucket name, and a network error is the
 * account id in the host.
 */
export async function r2Put(
  key: string,
  body: string,
  contentType = "application/octet-stream"
): Promise<R2PutResult> {
  const cfg = r2Config();
  if (!cfg) {
    return {
      ok: false,
      error:
        "R2 is not configured. Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.",
    };
  }
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const path = `/${cfg.bucket}/${key}`;
  const payloadHash = await sha256(body);
  const signed = await signV4({
    method: "PUT",
    host,
    path,
    // R2 has no regions, but SigV4 requires one in the credential scope and
    // Cloudflare documents "auto".
    region: "auto",
    service: "s3",
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    payloadHash,
    amzDate: amzDate(),
    extraHeaders: { "content-type": contentType },
  });

  try {
    const res = await fetch(`https://${host}${encodeS3Path(path)}`, {
      method: "PUT",
      headers: { ...signed.headers, authorization: signed.authorization },
      body,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `R2 responded ${res.status}.` };
    }
    return { ok: true, key, status: res.status };
  } catch (e) {
    return { ok: false, error: `R2 unreachable: ${(e as Error).message}` };
  }
}
