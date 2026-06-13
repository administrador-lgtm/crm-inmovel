// Minimal Google Sheets reader. The bot keeps writing to the Sheet; this client
// reads a tab as an array of header-keyed row objects. Auth uses a Google
// service account (recommended) via an access token minted from the
// GOOGLE_SERVICE_ACCOUNT_JSON env var, or a pre-supplied GOOGLE_SHEETS_TOKEN.
//
// The function is deliberately read-only: it NEVER writes back to the Sheet.

type Row = Record<string, string>;

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Read a tab and return rows keyed by the header row (row 1). Empty trailing
 * cells are returned as empty strings so callers can rely on every header key
 * being present.
 */
export async function readTab(
  spreadsheetId: string,
  tab: string,
  accessToken: string,
): Promise<Row[]> {
  const range = encodeURIComponent(`${tab}!A1:ZZ`);
  const url = `${SHEETS_API}/${spreadsheetId}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(
      `Sheets API ${res.status} reading ${tab}: ${await res.text()}`,
    );
  }
  const body = (await res.json()) as { values?: string[][] };
  const values = body.values ?? [];
  if (values.length === 0) return [];

  const headers = values[0].map((h) => String(h).trim());
  return values.slice(1).map((cells) => {
    const row: Row = {};
    headers.forEach((header, i) => {
      if (!header) return;
      row[header] = cells[i] !== undefined ? String(cells[i]) : "";
    });
    return row;
  });
}
