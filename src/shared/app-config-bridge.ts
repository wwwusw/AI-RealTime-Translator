import type { AppConfig } from './config'

export type AppConfigBridge = {
  load: () => Promise<AppConfig>
  save: (config: AppConfig) => Promise<AppConfig>
}
