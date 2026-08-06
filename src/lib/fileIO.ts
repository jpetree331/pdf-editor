// Framework-free. Browser download helper — the only way bytes leave the app.

/** Copy a (possibly offset) view into a plain ArrayBuffer-backed Blob. */
export function bytesToBlob(bytes: Uint8Array, mime: string): Blob {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return new Blob([buffer], { type: mime })
}

export function downloadBytes(bytes: Uint8Array, fileName: string, mime: string): void {
  const url = URL.createObjectURL(bytesToBlob(bytes, mime))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
