import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { DocumentFormat, FilingSource } from "@/lib/filings/types";

/**
 * Cloudflare R2 is the immutable store for original filing documents.
 *
 * Do not put these files in GitHub, Vercel's filesystem or Redis. The object
 * key contains the content hash, so the same bytes from NSE and BSE resolve to
 * the same immutable object instead of consuming storage twice.
 */

const required = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

export interface RawDocumentMeta {
  companyId?: string;
  source?: FilingSource;
  periodEnd?: string;
  format?: DocumentFormat;
}

const extension: Record<DocumentFormat, string> = {
  xbrl: "xbrl",
  xhtml: "xhtml",
  html: "html",
  "pdf-text": "pdf",
  "pdf-scanned": "pdf",
};

const contentType: Record<DocumentFormat, string> = {
  xbrl: "application/xml",
  xhtml: "application/xhtml+xml",
  html: "text/html; charset=utf-8",
  "pdf-text": "application/pdf",
  "pdf-scanned": "application/pdf",
};

const safePart = (value: string | undefined, fallback: string): string => {
  const clean = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
};

export function r2Configuration():
  | { configured: true; accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }
  | { configured: false; missing: string[] } {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) return { configured: false, missing: [...missing] };
  return {
    configured: true,
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET_NAME!,
  };
}

export function filingObjectKey(contentHash: string, meta: RawDocumentMeta = {}): string {
  const prefix = safePart(process.env.R2_FILINGS_PREFIX, "filings");
  const source = safePart(meta.source, "unknown-source");
  const company = safePart(meta.companyId, "unknown-company");
  const period = safePart(meta.periodEnd, "unknown-period");
  const ext = extension[meta.format ?? "xbrl"];
  return `${prefix}/india/${source}/${company}/${period}/${contentHash}.${ext}`;
}

export async function putRawDocument(
  contentHash: string,
  bytes: string | Uint8Array,
  meta: RawDocumentMeta = {}
): Promise<{ stored: boolean; storageKey?: string; reason?: string }> {
  const config = r2Configuration();
  if ("missing" in config) {
    return {
      stored: false,
      reason: `Cloudflare R2 is not configured. Missing: ${config.missing.join(", ")}.`,
    };
  }

  const key = filingObjectKey(contentHash, meta);
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes,
        ContentType: contentType[meta.format ?? "xbrl"],
        Metadata: {
          "content-sha256": contentHash,
          source: safePart(meta.source, "unknown-source"),
          company: safePart(meta.companyId, "unknown-company"),
          "period-end": safePart(meta.periodEnd, "unknown-period"),
        },
      })
    );
    return { stored: true, storageKey: `r2://${config.bucket}/${key}` };
  } catch (error) {
    return {
      stored: false,
      reason: `Cloudflare R2 upload failed: ${(error as Error).message}`,
    };
  }
}
