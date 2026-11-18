import { getEmail } from "../_lib/access.js";
import { json } from "../_lib/http.js";

// Every /api/* request must carry a valid Cloudflare Access login.
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
  return context.next();
}
