type SettingsPanelProps = {
  translationBaseUrl: string
  translationModel: string
  hasTranslationApiKey: boolean
}

export function SettingsPanel({
  translationBaseUrl,
  translationModel,
  hasTranslationApiKey
}: SettingsPanelProps) {
  return (
    <section className="settings-panel" aria-label="Settings summary">
      <p className="eyebrow">Settings Summary</p>
      <h2>Translation Settings</h2>
      <dl className="settings-grid">
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
