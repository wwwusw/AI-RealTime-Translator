/// <reference types="vite/client" />

import type { AppConfigBridge } from '../../shared/app-config-bridge'
import type { PipelineTasksBridge } from '../../shared/pipeline'

declare global {
  interface Window {
    appConfig?: AppConfigBridge
    pipelineTasks?: PipelineTasksBridge
  }
}

export {}
