// App-wide knobs. Every knob has a default here; nothing is scattered.

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4
export const ZOOM_STEP = 0.25
export const ZOOM_DEFAULT = 1

export const THUMBNAIL_SCALE = 0.16

export const TEXT_DEFAULTS = {
  fontSize: 14,
  color: { r: 0.1, g: 0.1, b: 0.1 },
  lineHeight: 1.3,
} as const

export const HIGHLIGHT_COLOR = { r: 1, g: 0.85, b: 0.2 }
export const HIGHLIGHT_OPACITY = 0.4
export const ERASE_DEFAULT_FILL = { r: 1, g: 1, b: 1 }

/** DPI used when a page must be rasterized (redaction, aggressive compress). */
export const RASTER_DPI_PRESETS = [
  { label: 'Small file (96 dpi)', dpi: 96, jpegQuality: 0.6 },
  { label: 'Balanced (144 dpi)', dpi: 144, jpegQuality: 0.75 },
  { label: 'High quality (200 dpi)', dpi: 200, jpegQuality: 0.85 },
] as const

export const REDACTION_DPI = 200
export const REDACTION_JPEG_QUALITY = 0.9

export const IMAGE_EXPORT_DPI = 150

/** Above this page count, warn before rasterizing operations. */
export const HEAVY_OP_PAGE_WARNING = 100
