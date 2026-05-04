/** Friendly display name — treats blank DB strings like missing (not `|| 'Unnamed'`). */
export function displayName(fullName, email, fallback = 'Member') {
  const n = typeof fullName === 'string' ? fullName.trim() : '';
  if (n) return n;
  const em = typeof email === 'string' ? email.trim() : '';
  if (em) return em;
  return fallback;
}
