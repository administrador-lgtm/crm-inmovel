// Minimal Google Drive v3 helpers for the backup export: find-or-create a
// folder, upload a file (multipart), list child folders, delete a file.
// All calls use a bearer access token minted from the Drive-scoped refresh token.

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

async function driveFetch(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`Drive ${init.method ?? "GET"} ${url} -> ${res.status}: ${await res.text()}`);
  }
  return res;
}

/** Find a folder by exact name (optionally under a parent). Returns its id or null. */
export async function findFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string | null> {
  const clauses = [
    `mimeType='${FOLDER_MIME}'`,
    `name='${name.replace(/'/g, "\\'")}'`,
    "trashed=false",
  ];
  if (parentId) clauses.push(`'${parentId}' in parents`);
  const q = encodeURIComponent(clauses.join(" and "));
  const res = await driveFetch(
    token,
    `${DRIVE_API}/files?q=${q}&fields=files(id,name)&spaces=drive`,
  );
  const json = (await res.json()) as { files?: { id: string }[] };
  return json.files?.[0]?.id ?? null;
}

/** Find-or-create a folder by name (optionally under a parent). Returns its id. */
export async function ensureFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const existing = await findFolder(token, name, parentId);
  if (existing) return existing;
  const res = await driveFetch(token, `${DRIVE_API}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  const json = (await res.json()) as { id: string };
  return json.id;
}

/** Upload a text file into a folder (multipart: metadata + content). */
export async function uploadFile(
  token: string,
  folderId: string,
  name: string,
  content: string,
  mimeType = "application/x-ndjson",
): Promise<void> {
  const boundary = "inmovel-backup-boundary";
  const metadata = JSON.stringify({ name, parents: [folderId] });
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;
  await driveFetch(token, `${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

/** List immediate child folders of a parent. Returns [{id, name}]. */
export async function listChildFolders(
  token: string,
  parentId: string,
): Promise<{ id: string; name: string }[]> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
  );
  const res = await driveFetch(
    token,
    `${DRIVE_API}/files?q=${q}&fields=files(id,name)&spaces=drive&pageSize=1000`,
  );
  const json = (await res.json()) as { files?: { id: string; name: string }[] };
  return json.files ?? [];
}

/** Permanently delete a file/folder by id. */
export async function deleteFile(token: string, id: string): Promise<void> {
  await driveFetch(token, `${DRIVE_API}/files/${id}`, { method: "DELETE" });
}
