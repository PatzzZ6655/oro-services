// One-time consent for the Drive refresh token. Run locally. Prints the token to the terminal.
// Do not commit the token or pass it as a shell argument that lands in a history file you share.
//
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-drive-consent.mjs
//
// The OAuth client needs this redirect URI: http://127.0.0.1:53682/callback
// Scope requested: https://www.googleapis.com/auth/drive.file

import { createServer } from "node:http";

const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
const port = 53682;
const redirectUri = `http://127.0.0.1:${port}/callback`;

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment first.");
  process.exit(1);
}

const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
url.searchParams.set("client_id", clientId);
url.searchParams.set("redirect_uri", redirectUri);
url.searchParams.set("response_type", "code");
url.searchParams.set("scope", "https://www.googleapis.com/auth/drive.file");
url.searchParams.set("access_type", "offline");
url.searchParams.set("prompt", "consent");

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", redirectUri);
  if (requestUrl.pathname !== "/callback") {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  const code = requestUrl.searchParams.get("code");
  if (!code) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Google did not return a code.");
    return;
  }
  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Drive consent received. You can close this tab and read the terminal.");
  server.close();
  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const json = await tokenResponse.json();
    if (!tokenResponse.ok || typeof json.refresh_token !== "string") {
      console.error("Google did not return a refresh token.", tokenResponse.status);
      process.exit(1);
    }
    console.log("Set this as GOOGLE_DRIVE_REFRESH_TOKEN. Do not commit it.");
    console.log(json.refresh_token);
  } catch {
    console.error("The token exchange failed.");
    process.exit(1);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("Open this URL in a browser signed in as pat.z@orosvc.com:");
  console.log(url.toString());
});
