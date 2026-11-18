import { json } from "../_lib/http.js";

// Everyone else who has sharing switched on: [{ id, name, ids }].
// Emails are never sent to the browser; `id` is a short opaque hash so the page can tell people apart.
async function shortHash(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf).slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ env, data }) {
  const keys = [];
  let cursor;
  do {
    const page = await env.FAVS.list({ prefix: "user:", cursor });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const mine = `user:${data.email}`;
  const recs = await Promise.all(keys.filter((k) => k !== mine).map(async (k) => [k, await env.FAVS.get(k, "json")]));
  const friends = [];
  for (const [k, r] of recs) {
    if (!r || r.share === false || !Array.isArray(r.ids) || !r.ids.length) continue;
    friends.push({ id: await shortHash(k), name: r.name || "Someone", ids: r.ids });
  }
  friends.sort((a, b) => a.name.localeCompare(b.name));
  return json({ friends });
}
