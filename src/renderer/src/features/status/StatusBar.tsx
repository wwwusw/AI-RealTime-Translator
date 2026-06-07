type StatusBarProps = {
  inputMode: 'file' | 'system-audio'
  liveTranslateModel: string
  refinerModel: string
  asrProvider: string
  stageLabel: string
  lastRevisionSummary: string
}

export function StatusBar({
  inputMode,
  liveTranslateModel,
  refinerModel,
  asrProvider,
  stageLabel,
  lastRevisionSummary
}: StatusBarProps) {
  const inputModeLabel = inputMode === 'file' ? '本地文件' : '系统声音'

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
          <dt>语音识别服务</dt>
          <dd>{asrProvider}</dd>
        </div>
        <div>
          <dt>输入模式</dt>
          <dd>{inputModeLabel}</dd>
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
