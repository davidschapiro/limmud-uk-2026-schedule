// Verifies the Cloudflare Access JWT on each API request and returns the signed-in email.
// Docs: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
//
// Required environment variables (Pages → Settings → Variables):
//   ACCESS_TEAM_DOMAIN  e.g. "yourteam.cloudflareaccess.com"
//   ACCESS_AUD          the Application Audience (AUD) tag of the Access application
// Local development only: DEV_EMAIL skips verification. Never set it in production.

let certCache = { at: 0, keys: null, domain: null };

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const decodeJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function getKeys(domain) {
  if (certCache.keys && certCache.domain === domain && Date.now() - certCache.at < 10 * 60 * 1000) return certCache.keys;
  const res = await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("could not load Access certs");
  const { keys } = await res.json();
  certCache = { at: Date.now(), keys, domain };
  return keys;
}

function readToken(request) {
  const h = request.headers.get("Cf-Access-Jwt-Assertion");
  if (h) return h;
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return m ? m[1] : null;
}

export async function getEmail(request, env) {
  if (env.DEV_EMAIL) return String(env.DEV_EMAIL).toLowerCase();
  const domain = (env.ACCESS_TEAM_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain || !env.ACCESS_AUD) throw new Error("ACCESS_TEAM_DOMAIN / ACCESS_AUD not configured");
  const token = readToken(request);
  if (!token) return null;
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return null;
  const header = decodeJson(h);
  const payload = decodeJson(p);
  const keys = await getKeys(domain);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk || header.alg !== "RS256") return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (payload.iss !== `https://${domain}`) return null;
  if (payload.exp && payload.exp < now) return null;
  return payload.email ? String(payload.email).toLowerCase() : null;
}
