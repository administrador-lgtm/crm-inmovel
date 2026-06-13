// Mint a short-lived Google API access token from a long-lived refresh token.
// The Inmovel bot already owns a Google OAuth client (client id/secret) and a
// refresh token with Sheets scope; the sync reuses them so it never needs a
// static, expiring token in its env.

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
