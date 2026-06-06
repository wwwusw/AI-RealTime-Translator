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
          <span>Subtitle Block Duration</span>
          <select
            name="block-duration-ms"
            value={String(draftConfig.blockDurationMs)}
            onChange={(event) => {
              const blockDurationMs = Number(event.target.value)
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                blockDurationMs
              }))
            }}
          >
            <option value="2000">2 seconds</option>
            <option value="3000">3 seconds</option>
            <option value="4000">4 seconds</option>
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
          <span>Live Translate Base URL</span>
          <input
            name="live-translate-base-url"
            type="url"
            value={draftConfig.liveTranslate.baseUrl}
            onChange={(event) => {
              const baseUrl = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                liveTranslate: {
                  ...currentConfig.liveTranslate,
                  baseUrl
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>Live Translate API Key</span>
          <input
            name="live-translate-api-key"
            type="password"
            value={draftConfig.liveTranslate.apiKey}
            onChange={(event) => {
              const apiKey = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                liveTranslate: {
                  ...currentConfig.liveTranslate,
                  apiKey
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>Live Translate Model</span>
          <input
            name="live-translate-model"
            type="text"
            value={draftConfig.liveTranslate.model}
            onChange={(event) => {
              const model = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                liveTranslate: {
                  ...currentConfig.liveTranslate,
                  model
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>Source Language</span>
          <input
            name="source-language"
            type="text"
            value={draftConfig.liveTranslate.sourceLanguage}
            onChange={(event) => {
              const sourceLanguage = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                liveTranslate: {
                  ...currentConfig.liveTranslate,
                  sourceLanguage
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>Target Language</span>
          <input
            name="target-language"
            type="text"
            value={draftConfig.liveTranslate.targetLanguage}
            onChange={(event) => {
              const targetLanguage = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                liveTranslate: {
                  ...currentConfig.liveTranslate,
                  targetLanguage
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>Refiner Base URL</span>
          <input
            name="refiner-base-url"
            type="url"
            value={draftConfig.refiner.baseUrl}
            onChange={(event) => {
              const baseUrl = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                refiner: {
                  ...currentConfig.refiner,
                  baseUrl
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>Refiner API Key</span>
          <input
            name="refiner-api-key"
            type="password"
            value={draftConfig.refiner.apiKey}
            onChange={(event) => {
              const apiKey = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                refiner: {
                  ...currentConfig.refiner,
                  apiKey
                }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>Refiner Model</span>
          <input
            name="refiner-model"
            type="text"
            value={draftConfig.refiner.model}
            onChange={(event) => {
              const model = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                refiner: {
                  ...currentConfig.refiner,
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
