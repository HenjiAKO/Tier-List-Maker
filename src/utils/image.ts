export const ACCEPTED_TYPES = ["image/png", "image/jpeg"] as const

export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(",")

export const MAX_DIMENSION = 320

export const MAX_BYTES = 12 * 1024 * 1024

export interface ProcessedImage {
  dataUrl: string
  width: number
  height: number
  name: string
}

export interface ImportResult {
  accepted: ProcessedImage[]
  rejected: { name: string; reason: string }[]
}

function acceptAttr(): string {
  return ACCEPTED_TYPES.map((t) => `.${t.slice("image/".length)}`).join(",")
}

/** Human-readable accept string for a file input. */
export function imageAcceptLabel(): string {
  return acceptAttr()
    .split(",")
    .map((s) => s.replace(".", "").toUpperCase())
    .join(" / ")
}

export function validateImageFile(file: File): string | null {
  const type = file.type.toLowerCase()
  if (!(ACCEPTED_TYPES as readonly string[]).includes(type)) {
    return `${file.name}: only PNG and JPG images are supported.`
  }
  if (file.size > MAX_BYTES) {
    return `${file.name}: image is larger than ${Math.round(MAX_BYTES / 1024 / 1024)}MB.`
  }
  return null
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("decode failed"))
    img.src = src
  })
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("read failed"))
    reader.readAsDataURL(file)
  })
}

/**
 * Validates, downscales and re-encodes an image for storage.
 *
 * PNG sources stay PNG so transparency survives; JPEG sources are re-encoded as
 * JPEG, which is what keeps a list of dozens of items inside the ~5MB
 * localStorage budget.
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  const invalid = validateImageFile(file)
  if (invalid) throw new Error(invalid)

  const source = await readAsDataUrl(file)
  const img = await loadImage(source)

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas unavailable")
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, width, height)

  const isPng = file.type.toLowerCase() === "image/png"
  const dataUrl = isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85)

  return {
    dataUrl,
    width,
    height,
    // Filename without extension doubles as the default item name.
    name: file.name.replace(/\.[^.]+$/, ""),
  }
}

/** Processes a batch, collecting per-file failures instead of throwing. */
export async function processImageFiles(files: File[] | FileList): Promise<ImportResult> {
  const accepted: ProcessedImage[] = []
  const rejected: { name: string; reason: string }[] = []

  for (const file of Array.from(files)) {
    try {
      accepted.push(await processImageFile(file))
    } catch (err) {
      rejected.push({
        name: file.name,
        reason: err instanceof Error ? err.message : "Could not read image.",
      })
    }
  }

  return { accepted, rejected }
}

/** Turns a dropped DataTransfer into the image files it carries. */
export function imageFilesFromDrop(dt: DataTransfer): File[] {
  return Array.from(dt.files).filter((f) => f.type.startsWith("image/"))
}
