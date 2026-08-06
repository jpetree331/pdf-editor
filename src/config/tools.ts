// THE canvas-tool registry. The canvas dispatches pointer events by table
// lookup — adding a tool means adding an entry here and a behavior module,
// never branching in components.
import type { ToolBehavior } from '../tools/types'
import { selectTool } from '../tools/selectTool'
import { editTextTool } from '../tools/editTextTool'
import { textTool } from '../tools/textTool'
import { placeTool } from '../tools/placeTool'
import { highlightTool, eraseTool, redactTool, cropTool } from '../tools/boxTools'

export type CanvasToolId =
  | 'select'
  | 'editText'
  | 'text'
  | 'highlight'
  | 'image'
  | 'signature'
  | 'erase'
  | 'redact'
  | 'crop'

export interface CanvasToolDefinition {
  id: CanvasToolId
  label: string
  /** Icon name resolved by the Icon component. */
  icon: string
  cursor: string
  behavior: ToolBehavior
  /** Short hint shown in the inspector when the tool is active. */
  hint: string
}

export const TOOL_REGISTRY: Record<CanvasToolId, CanvasToolDefinition> = {
  select: {
    id: 'select',
    label: 'Select',
    icon: 'cursor',
    cursor: 'default',
    behavior: selectTool,
    hint: 'Click an object to select it. Drag to move, use handles to resize. Double-click text to edit.',
  },
  editText: {
    id: 'editText',
    label: 'Edit text',
    icon: 'editText',
    cursor: 'text',
    behavior: editTextTool,
    hint: 'Click a line of the document’s text to rewrite it. The original is covered and replaced in a close-matching font. The covered text stays in the file — use Redact for anything sensitive.',
  },
  text: {
    id: 'text',
    label: 'Add text',
    icon: 'text',
    cursor: 'text',
    behavior: textTool,
    hint: 'Click on the page to place a text box.',
  },
  highlight: {
    id: 'highlight',
    label: 'Highlight',
    icon: 'highlight',
    cursor: 'crosshair',
    behavior: highlightTool,
    hint: 'Drag over content to highlight it.',
  },
  image: {
    id: 'image',
    label: 'Add image',
    icon: 'image',
    cursor: 'copy',
    behavior: placeTool,
    hint: 'Choose an image, then click on the page to place it.',
  },
  signature: {
    id: 'signature',
    label: 'Sign',
    icon: 'signature',
    cursor: 'copy',
    behavior: placeTool,
    hint: 'Create your signature, then click on the page to place it.',
  },
  erase: {
    id: 'erase',
    label: 'Erase (cover)',
    icon: 'erase',
    cursor: 'crosshair',
    behavior: eraseTool,
    hint: 'Drag a box to cover content. This hides — it does not remove. Use Redact to truly remove.',
  },
  redact: {
    id: 'redact',
    label: 'Redact',
    icon: 'redact',
    cursor: 'crosshair',
    behavior: redactTool,
    hint: 'Drag a box over content to permanently remove it. The page is flattened to an image on export.',
  },
  crop: {
    id: 'crop',
    label: 'Crop page',
    icon: 'crop',
    cursor: 'crosshair',
    behavior: cropTool,
    hint: 'Drag the area to keep. Applied when you export.',
  },
}

export const TOOL_ORDER: CanvasToolId[] = [
  'select',
  'editText',
  'text',
  'highlight',
  'image',
  'signature',
  'erase',
  'redact',
  'crop',
]
