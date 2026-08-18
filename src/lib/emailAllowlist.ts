// Parsing for the email allowlists that gate Pro comps and staff access.
//
// No imports, so scripts/test-admin-access.mjs can exercise it directly. That
// matters more here than almost anywhere else in this codebase: the dangerous
// failure is not a wrong answer, it is a PERMISSIVE one. An empty or missing
// variable must mean "nobody", never "everybody", and that is a property worth
// pinning in a test rather than re-reading the code and hoping.

/** Split on commas, semicolons or whitespace; lower-case; drop blanks. */
export function parseEmailAllowlist(raw: string | undefined | null): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Is this email on the list?
 *
 * Absent list ⇒ false. Absent email ⇒ false. There is no wildcard and no "allow
 * all" value: to grant access, a specific address has to be written down.
 */
export function emailInAllowlist(email: string | undefined | null, raw: string | undefined | null): boolean {
  if (!email) return false;
  const list = parseEmailAllowlist(raw);
  if (list.size === 0) return false;
  return list.has(email.trim().toLowerCase());
}
