import { getEmail } from "../_lib/access.js";
import { json } from "../_lib/http.js";
import { isMember } from "../_lib/members.js";

// Every /api/* request must carry a valid Cloudflare Access login.
// In invite mode (INVITE_CODE set), everything except /api/join also requires membership.
export async function onRequest(context) {
  let email;
  try {
    email = await getEmail(context.request, context.env);
  } catch (e) {
    return json({ error: "server_misconfigured", detail: String(e.message || e) }, 500);
  }
  if (!email) return json({ error: "not_signed_in" }, 401);
  if (!context.env.FAVS) return json({ error: "server_misconfigured", detail: "KV binding FAVS missing" }, 500);
  context.data.email = email;

  const path = new URL(context.request.url).pathname.replace(/\/$/, "");
  if (path !== "/api/join" && !(await isMember(context.env, email))) {
    return json({ error: "not_invited", email }, 403);
  }
  return context.next();
}
