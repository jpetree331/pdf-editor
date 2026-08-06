import { EditorProvider, useEditor } from './state/EditorContext'
import { HomePage } from './components/home/HomePage'
import { EditorShell } from './components/shell/EditorShell'

function Root() {
  const { session } = useEditor()
  return session ? <EditorShell /> : <HomePage />
}

export default function App() {
  return (
    <EditorProvider>
      <Root />
    </EditorProvider>
  )
}
