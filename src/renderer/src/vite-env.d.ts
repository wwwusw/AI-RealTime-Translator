/// <reference types="vite/client" />

import type { AppConfigBridge } from '../../shared/app-config-bridge'

declare global {
  interface Window {
    appConfig?: AppConfigBridge
  }
}

export {}
