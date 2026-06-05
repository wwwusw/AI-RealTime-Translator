type SettingsPanelProps = {
  asrProvider: string
  translationBaseUrl: string
  translationModel: string
  hasTranslationApiKey: boolean
}

export function SettingsPanel({
  asrProvider,
  translationBaseUrl,
  translationModel,
  hasTranslationApiKey
}: SettingsPanelProps) {
  return (
    <section className="settings-panel" aria-label="Settings summary">
      <p className="eyebrow">Settings Summary</p>
      <h2>Translation Settings</h2>
      <dl className="settings-grid">
        <dt>ASR Provider</dt>
        <dd>{asrProvider}</dd>
        <dt>Translation Base URL</dt>
        <dd>{translationBaseUrl}</dd>
        <dt>Translation Model</dt>
        <dd>{translationModel}</dd>
        <dt>Translation API Key</dt>
        <dd>{hasTranslationApiKey ? 'Configured' : 'Not set'}</dd>
      </dl>
    </section>
  )
}
