// Renders the active dialog (table lookup, no switch branching) plus the
// shared job-progress overlay and error toast.
import type { JSX } from 'react'
import { useEditor, type DialogId } from '../../state/EditorContext'
import { useJobs } from '../../hooks/useJobs'
import { ProgressOverlay } from '../common/primitives'
import { ExportDialog } from './ExportDialog'
import { CompressDialog } from './CompressDialog'
import { ConvertDialog } from './ConvertDialog'
import { SplitDialog } from './SplitDialog'
import { ExtractDialog } from './ExtractDialog'
import { SignatureCaptureDialog } from './SignatureCaptureDialog'
import './dialogs.css'

export type Jobs = ReturnType<typeof useJobs>

const DIALOGS: Record<Exclude<DialogId, null>, (jobs: Jobs) => JSX.Element> = {
  export: (jobs) => <ExportDialog jobs={jobs} />,
  compress: (jobs) => <CompressDialog jobs={jobs} />,
  convert: (jobs) => <ConvertDialog jobs={jobs} />,
  split: (jobs) => <SplitDialog jobs={jobs} />,
  extract: (jobs) => <ExtractDialog jobs={jobs} />,
  signature: () => <SignatureCaptureDialog />,
}

export function DialogHost() {
  const { dialog } = useEditor()
  const jobs = useJobs()

  return (
    <>
      {dialog && !jobs.job && DIALOGS[dialog](jobs)}
      {jobs.job && <ProgressOverlay message={jobs.job.message} percent={jobs.job.fraction} />}
      {jobs.jobError && (
        <div className="job-error" role="alert">
          <span>{jobs.jobError}</span>
          <button onClick={jobs.clearJobError}>Dismiss</button>
        </div>
      )}
    </>
  )
}
