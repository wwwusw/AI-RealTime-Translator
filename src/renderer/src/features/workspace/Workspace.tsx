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
    <section className="workspace-card" aria-label="任务控制">
      <p className="eyebrow">工作区</p>
      <h2>任务控制</h2>
      <p className="workspace-path">
        {sourceLabel ??
          (inputMode === 'system-audio'
            ? '系统声音模式已就绪，点击开始后选择要采集的系统音频。'
            : '尚未选择媒体文件。')}
      </p>
      <p className="workspace-hint">
        {inputMode === 'system-audio'
          ? '开始采集后，系统会请求共享屏幕声音，用于实时识别和翻译。'
          : '请选择本地音频或视频文件，开始生成翻译字幕。'}
      </p>
      <div className="task-buttons">
        {inputMode === 'file' ? (
          <button type="button" onClick={onPick}>
            选择文件
          </button>
        ) : null}
        <button type="button" onClick={onStart} disabled={!canStart}>
          {inputMode === 'system-audio' ? '开始采集系统声音' : '开始处理'}
        </button>
        <button type="button" onClick={onPause} disabled={!isRunning}>
          暂停
        </button>
        <button type="button" onClick={onReset}>
          重置任务
        </button>
      </div>
    </section>
  )
}
