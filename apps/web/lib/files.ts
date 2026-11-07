import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const root = () => path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "../../.data/uploads"));

/** Files live outside `public`: attachments concern children and are served through a permission check. */
export async function saveUpload(schoolId: string, file: File): Promise<string> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new UploadError("Format berkas harus JPG, PNG, WEBP, atau PDF");
  if (file.size > MAX_BYTES) throw new UploadError("Ukuran berkas maksimal 5 MB");
  const relative = `${schoolId}/${randomUUID()}.${ext}`;
  const target = path.join(root(), relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return relative;
}

export class UploadError extends Error {}

export async function readUpload(relative: string) {
  const target = path.resolve(root(), relative);
  if (!target.startsWith(`${root()}${path.sep}`)) return null;
  const ext = path.extname(target).slice(1);
  const type = Object.entries(ALLOWED).find(([, e]) => e === ext)?.[0];
  if (!type) return null;
  try {
    return { bytes: await readFile(target), type };
  } catch {
    return null;
  }
}
