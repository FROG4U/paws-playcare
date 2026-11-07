"use client";

// Shrink a photo in the browser before it's uploaded.
//
// A phone photo is 5-15 MB, which is slow on mobile data and big enough that
// the upload can be rejected outright, losing everything else typed into the
// form. The server re-encodes to WebP anyway, so there's nothing to gain from
// sending the original: this gets it down to a few hundred KB first.
export async function shrinkImage(
  file: File,
  opts: { maxSide?: number; quality?: number } = {}
): Promise<File> {
  const { maxSide = 1800, quality = 0.82 } = opts;
  if (!file.type.startsWith("image/")) return file;
  // HEIC and friends can't be drawn by every browser; leave them to the server.
  if (!/jpe?g|png|webp/i.test(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file; // no gain, keep the original

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file; // anything odd: let the server deal with it
  }
}
