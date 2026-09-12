// Mint a short-lived Google API access token from the long-lived refresh token.
// Reuses the same Google OAuth client (id/secret/refresh token) the sheet_sync
// function already owns; the refresh token carries the Drive scope, so this
// token can create folders and upload files to Drive.

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export async function mintAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(
      `Google token refresh failed (${res.status}): ${await res.text()}`,
    );
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Google token refresh returned no access_token");
  }
  return json.access_token;
}
