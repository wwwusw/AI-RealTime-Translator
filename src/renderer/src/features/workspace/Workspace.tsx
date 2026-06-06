type WorkspaceProps = {
  inputMode: 'file' | 'system-audio'
  sourceLabel: string | null
  canStart: boolean
  isRunning: boolean
  onPick: () => void
  onStart: () => void
  onPause: () => void
  onReset: () => void
}

export function Workspace({
  inputMode,
  sourceLabel,
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
      <p className="workspace-path">
        {sourceLabel ??
          (inputMode === 'system-audio'
            ? 'System audio mode is armed. Press start to begin loopback capture.'
            : 'No media file selected yet.')}
      </p>
      <p className="workspace-hint">
        {inputMode === 'system-audio'
          ? 'Start System Audio will request display capture so Electron can read the current system mix.'
          : 'Select a local media file to keep the original file-to-subtitle workflow.'}
      </p>
      <div className="task-buttons">
        {inputMode === 'file' ? (
          <button type="button" onClick={onPick}>
            Select File
          </button>
        ) : null}
        <button type="button" onClick={onStart} disabled={!canStart}>
          {inputMode === 'system-audio' ? 'Start System Audio' : 'Start Processing'}
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
