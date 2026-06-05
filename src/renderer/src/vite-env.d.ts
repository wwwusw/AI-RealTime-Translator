/// <reference types="vite/client" />

import type { AppConfig } from '../../shared/config'

declare global {
  interface Window {
    appConfig?: {
      load: () => Promise<AppConfig>
      save: (config: AppConfig) => Promise<AppConfig>
    }
  }
}

export {}
