type StatusBarProps = {
  translationModel: string
  asrProvider: string
  stageLabel: string
  lastRevisionSummary: string
}

export function StatusBar({
  translationModel,
  asrProvider,
  stageLabel,
  lastRevisionSummary
}: StatusBarProps) {
  return (
    <section className="status-bar" aria-label="Task status">
      <dl className="status-grid">
        <div>
          <dt>Translation Model</dt>
          <dd>{translationModel}</dd>
        </div>
        <div>
          <dt>ASR Provider</dt>
          <dd>{asrProvider}</dd>
        </div>
        <div>
          <dt>Stage</dt>
          <dd>{stageLabel}</dd>
        </div>
        <div>
          <dt>Last Revision</dt>
          <dd>{lastRevisionSummary}</dd>
        </div>
      </dl>
    </section>
  )
}
