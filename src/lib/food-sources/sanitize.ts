// Postgres text columns reject an embedded NUL byte outright, and a single
// bad character fails the whole INSERT. External data (crowdsourced Open Food
// Facts especially) can contain one from upstream encoding issues, so strip
// it defensively before any external string reaches the database. Built via
// fromCharCode(0) at runtime rather than an escape sequence in source, since
// writing that sequence directly into this file corrupted it into a raw byte.
const NUL_CHAR = String.fromCharCode(0);

export function sanitizeText(value: string): string {
  return value.split(NUL_CHAR).join("").trim();
}

export function sanitizeNullableText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = sanitizeText(value);
  return cleaned.length > 0 ? cleaned : null;
}
