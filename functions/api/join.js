import { json } from "../_lib/http.js";
import { inviteMode, isMember, codeMatches } from "../_lib/members.js";

const MAX_TRIES_PER_HOUR = 10;

// POST /api/join { code } — turns a logged-in visitor into a member.
export async function onRequestPost({ request, env, data }) {
  const email = data.email;
  if (!inviteMode(env) || (await isMember(env, email))) return json({ ok: true, email });

  const failKey = `joinfail:${email}`;
  const fails = Number((await env.FAVS.get(failKey)) || 0);
  if (fails >= MAX_TRIES_PER_HOUR) return json({ error: "too_many_tries" }, 429);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (!codeMatches(env, body.code)) {
    await env.FAVS.put(failKey, String(fails + 1), { expirationTtl: 3600 });
    return json({ error: "wrong_code" }, 403);
  }
  await env.FAVS.put(`member:${email}`, JSON.stringify({ joinedAt: new Date().toISOString() }));
  return json({ ok: true, email });
}
