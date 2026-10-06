import { isDesktop, resolveImageUrl } from "@/lib/desktop"

/**
 * Image persistence.
 *
 * A new item needs its id before the library entry that references it, so the
 * id is minted first and used as the media filename. On desktop the canvas
 * output is written to disk as `media/<id>.png`; in a browser it stays a data
 * URL, which is what keeps the web build self-contained.
 */

export interface StoredImage {
  /** Relative media path on desktop, a data URL in a browser. */
  image: string
  id: string
}

/**
 * Persists one processed image and returns the reference to store on the item.
 *
 * @param id Item id, used as the media filename.
 * @param dataUrl Canvas output from processImageFile.
 */
export async function storeImage(id: string, dataUrl: string): Promise<StoredImage> {
  if (!isDesktop()) return { image: dataUrl, id }

  const extension = dataUrl.startsWith("data:image/png") ? "png" : "jpg"
  const result = await window.desktop!.putMedia({ id, extension, dataUrl })
  if (!result.ok) {
    // A failed write should not lose the user's import, so fall back to
    // embedding the image in the index instead of dropping it.
    return { image: dataUrl, id }
  }
  return { image: result.image, id }
}

/** Removes image files for ids that are no longer referenced. */
export async function deleteMedia(ids: string[]): Promise<void> {
  if (!isDesktop() || ids.length === 0) return
  await window.desktop!.deleteMedia(ids)
}

/** <img src> value for a stored item image. */
export function itemImageSrc(image: string): string {
  return resolveImageUrl(image)
}
