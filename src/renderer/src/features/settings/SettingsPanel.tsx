import { useEffect, useState } from 'react'
import type { AppConfig } from '../../../../shared/config'

type SettingsPanelProps = {
  config: AppConfig
  onSave: (config: AppConfig) => Promise<void> | void
}

export function SettingsPanel({ config, onSave }: SettingsPanelProps) {
  const [draftConfig, setDraftConfig] = useState(config)

  useEffect(() => {
    setDraftConfig(config)
  }, [config])

  return (
    <section className="settings-panel" aria-label="Provider settings">
      <p className="eyebrow">Provider Settings</p>
      <h2>Runtime Configuration</h2>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onSave(draftConfig)
        }}
      >
        <label className="settings-field">
          <span>Input Mode</span>
          <select
            name="input-mode"
            value={draftConfig.inputMode}
            onChange={(event) => {
              const inputMode = event.target.value as AppConfig['inputMode']
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                inputMode
              }))
            }}
          >
            <option value="file">file</option>
            <option value="system-audio">system-audio</option>
          </select>
        </label>

        <label className="settings-field">
          <span>ASR Provider</span>
          <select
            name="asr-provider"
            value={draftConfig.asr.provider}
            onChange={(event) => {
              const provider = event.target.value as AppConfig['asr']['provider']
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                asr: {
                  ...currentConfig.asr,
                  provider
                }
              }))
            }}
          >
            <option value="scripted">scripted</option>
            <option value="dashscope-realtime">dashscope-realtime</option>
            <option value="openai-audio">openai-audio</option>
          </select>
        </label>

        <label className="settings-field">
          <span>ASR Base URL</span>
          <input
            name="asr-base-url"
            type="url"
            value={draftConfig.asr.baseUrl}
            onChange={(event) => {
              const baseUrl = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                asr: {
                  ...currentConfig.asr,
                  baseUrl
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>ASR API Key</span>
          <input
            name="asr-api-key"
            type="password"
            value={draftConfig.asr.apiKey}
            onChange={(event) => {
              const apiKey = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                asr: {
                  ...currentConfig.asr,
                  apiKey
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>ASR Model</span>
          <input
            name="asr-model"
            type="text"
            value={draftConfig.asr.model}
            onChange={(event) => {
              const model = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                asr: {
                  ...currentConfig.asr,
                  model
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>Translation Base URL</span>
          <input
            name="translation-base-url"
            type="url"
            value={draftConfig.translation.baseUrl}
            onChange={(event) => {
              const baseUrl = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                translation: {
                  ...currentConfig.translation,
                  baseUrl
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>Translation API Key</span>
          <input
            name="translation-api-key"
            type="password"
            value={draftConfig.translation.apiKey}
            onChange={(event) => {
              const apiKey = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                translation: {
                  ...currentConfig.translation,
                  apiKey
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>Translation Model</span>
          <input
            name="translation-model"
            type="text"
            value={draftConfig.translation.model}
            onChange={(event) => {
              const model = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                translation: {
                  ...currentConfig.translation,
                  model
                }
              }))
            }}
          />
        </label>

        <button className="settings-save-button" type="submit">
          Save Settings
        </button>
      </form>
    </section>
  )
}
