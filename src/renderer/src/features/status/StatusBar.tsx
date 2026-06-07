type StatusBarProps = {
  liveTranslateModel: string
  refinerModel: string
  stageLabel: string
  lastRevisionSummary: string
}

export function StatusBar({
  liveTranslateModel,
  refinerModel,
  stageLabel,
  lastRevisionSummary
}: StatusBarProps) {
  return (
    <section className="status-bar" aria-label="任务状态">
      <dl className="status-grid">
        <div>
          <dt>实时翻译模型</dt>
          <dd>{liveTranslateModel}</dd>
        </div>
        <div>
          <dt>精翻模型</dt>
          <dd>{refinerModel}</dd>
        </div>
        <div>
          <dt>任务阶段</dt>
          <dd>{stageLabel}</dd>
        </div>
        <div>
          <dt>最新状态</dt>
          <dd>{lastRevisionSummary}</dd>
        </div>
      </dl>
    </section>
  )
}
