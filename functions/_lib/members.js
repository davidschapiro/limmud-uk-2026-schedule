// Invite-based membership.
//
// Invite mode is ON when the INVITE_CODE variable is set. Then a logged-in person may use the
// API only if they are a member: they joined with the code (KV key "member:<email>"), they
// already have saved stars from before invite mode ("user:<email>"), or their address is in
// OWNERS_EMAILS (comma-separated, optional).
// Invite mode OFF (no INVITE_CODE): everyone who gets past Cloudflare Access may use the API,
// which is the right setting when the Access policy itself lists the allowed emails.
//
// To remove someone: delete their "member:<email>" and "user:<email>" keys in the KV namespace.

export const inviteMode = (env) => !!(env.INVITE_CODE && String(env.INVITE_CODE).trim());

// Read from OWNERS_EMAILS; OWNER_EMAILS (the earlier name) still works.
export const ownerEmails = (env) =>
  String(env.OWNERS_EMAILS || env.OWNER_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

// Owners (OWNERS_EMAILS) may also see the member list (GET /api/members).
export const isOwner = (env, email) => ownerEmails(env).includes(email);

export async function isMember(env, email) {
  if (!inviteMode(env)) return true;
  if (isOwner(env, email)) return true;
  const [m, u] = await Promise.all([env.FAVS.get(`member:${email}`), env.FAVS.get(`user:${email}`)]);
  return m !== null || u !== null;
}

export function codeMatches(env, given) {
  const a = new TextEncoder().encode(String(env.INVITE_CODE).trim().toLowerCase());
  const b = new TextEncoder().encode(String(given || "").trim().toLowerCase());
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}
