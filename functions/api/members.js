import { json } from "../_lib/http.js";
import { inviteMode, isOwner, ownerEmails } from "../_lib/members.js";

// GET /api/members — who is in the group. Only for OWNERS_EMAILS; everyone else gets 403.
// A person counts if they joined with the invite code ("member:<email>"), have a saved
// record ("user:<email>"), or are an owner. Emails are shown here because only owners see this.
async function listKeys(env, prefix) {
  const names = [];
  let cursor;
  do {
    const page = await env.FAVS.list({ prefix, cursor });
    names.push(...page.keys.map((k) => k.name.slice(prefix.length)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return names;
}

export async function onRequestGet({ env, data }) {
  if (!isOwner(env, data.email)) return json({ error: "owners_only" }, 403);

  const [joined, users] = await Promise.all([listKeys(env, "member:"), listKeys(env, "user:")]);
  const emails = [...new Set([...joined, ...users, ...ownerEmails(env)])];
  const joinedSet = new Set(joined), userSet = new Set(users), owners = new Set(ownerEmails(env));

  const members = await Promise.all(emails.map(async (email) => {
    const [m, u] = await Promise.all([
      joinedSet.has(email) ? env.FAVS.get(`member:${email}`, "json") : null,
      userSet.has(email) ? env.FAVS.get(`user:${email}`, "json") : null,
    ]);
    return {
      email,
      name: u?.name || null,
      owner: owners.has(email),
      joinedAt: m?.joinedAt || null,
      stars: Array.isArray(u?.ids) ? u.ids.length : 0,
      share: u ? u.share !== false : null,
      lastSaved: u?.updatedAt || null,
    };
  }));
  members.sort((a, b) => (a.joinedAt || a.lastSaved || "").localeCompare(b.joinedAt || b.lastSaved || "") || a.email.localeCompare(b.email));
  return json({ inviteMode: inviteMode(env), members });
}
