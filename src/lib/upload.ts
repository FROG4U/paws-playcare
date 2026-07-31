import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Compress an uploaded image hard: cap the dimensions and re-encode as WebP so
// stored files are tiny. Returns the public path (e.g. /uploads/abc.webp).
export async function saveCompressedImage(
  file: File,
  opts: { maxWidth?: number; quality?: number } = {}
): Promise<string> {
  const { maxWidth = 1600, quality = 72 } = opts;
  const bytes = Buffer.from(await file.arrayBuffer());

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID().replace(/-/g, "")}.webp`;
  const outPath = path.join(UPLOAD_DIR, name);

  await sharp(bytes)
    .rotate() // respect EXIF orientation
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toFile(outPath);

  return `/uploads/${name}`;
}

// Best-effort removal of a previously uploaded image.
export async function deleteUpload(publicPath?: string | null) {
  if (!publicPath || !publicPath.startsWith("/uploads/")) return;
  try {
    await fs.unlink(path.join(process.cwd(), "public", publicPath.replace(/^\//, "")));
  } catch {
    // ignore — file may already be gone
  }
}
