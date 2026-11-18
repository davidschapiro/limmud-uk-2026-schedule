import { json } from "../_lib/http.js";

// KV layout: one key per person, "user:<email>" -> { name, ids: [sessionId...], share, updatedAt }
const keyFor = (email) => `user:${email}`;
const MAX_IDS = 800;

function defaultName(email) {
  const local = email.split("@")[0].split(/[._+-]/)[0] || email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

async function load(env, email) {
  const rec = await env.FAVS.get(keyFor(email), "json");
  return { name: rec?.name || defaultName(email), ids: rec?.ids || [], share: rec?.share !== false, updatedAt: rec?.updatedAt || null };
}

export async function onRequestGet({ env, data }) {
  const rec = await load(env, data.email);
  return json({ email: data.email, ...rec });
}

export async function onRequestPut({ request, env, data }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const rec = await load(env, data.email);
  if (body.ids !== undefined) {
    if (!Array.isArray(body.ids) || body.ids.length > MAX_IDS || !body.ids.every((x) => typeof x === "string" && /^\d{1,9}$/.test(x)))
      return json({ error: "bad_ids" }, 400);
    rec.ids = [...new Set(body.ids)];
  }
  if (body.name !== undefined) {
    const n = String(body.name).trim().slice(0, 40);
    if (n) rec.name = n;
  }
  if (body.share !== undefined) rec.share = !!body.share;
  rec.updatedAt = new Date().toISOString();
  await env.FAVS.put(keyFor(data.email), JSON.stringify(rec));
  return json({ email: data.email, ...rec });
}
