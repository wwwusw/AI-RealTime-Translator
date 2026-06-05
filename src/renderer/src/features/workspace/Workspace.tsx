type WorkspaceProps = {
  filePath: string | null
  canStart: boolean
  isRunning: boolean
  onPick: () => void
  onStart: () => void
  onPause: () => void
  onReset: () => void
}

export function Workspace({
  filePath,
  canStart,
  isRunning,
  onPick,
  onStart,
  onPause,
  onReset
}: WorkspaceProps) {
  return (
    <section className="workspace-card" aria-label="Task workspace">
      <p className="eyebrow">Workspace</p>
      <h2>Task Controls</h2>
      <p className="workspace-path">{filePath ?? 'No media file selected yet.'}</p>
      <div className="task-buttons">
        <button type="button" onClick={onPick}>
          Select File
        </button>
        <button type="button" onClick={onStart} disabled={!canStart}>
          Start Processing
        </button>
        <button type="button" onClick={onPause} disabled={!isRunning}>
          Pause Processing
        </button>
        <button type="button" onClick={onReset}>
          Reset Task
        </button>
      </div>
    </section>
  )
}
