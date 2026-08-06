// Left icon rail — rendered straight from the tool registry.
import { useEditor } from '../../state/EditorContext'
import { TOOL_ORDER, TOOL_REGISTRY } from '../../config/tools'
import { IconButton } from '../common/primitives'
import './ToolRail.css'

export function ToolRail() {
  const { activeToolId, setActiveTool, setDialog, pendingPlacement } = useEditor()

  return (
    <nav className="tool-rail" aria-label="Tools">
      {TOOL_ORDER.map((id) => {
        const tool = TOOL_REGISTRY[id]
        return (
          <IconButton
            key={id}
            icon={tool.icon}
            label={tool.label}
            active={activeToolId === id}
            onClick={() => {
              setActiveTool(id)
              // Sign always goes through capture first unless a signature is staged.
              if (id === 'signature' && pendingPlacement?.type !== 'signature') {
                setDialog('signature')
              }
            }}
          />
        )
      })}
    </nav>
  )
}
