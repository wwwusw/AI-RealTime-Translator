/// <reference types="vite/client" />

import type { AppConfigBridge } from '../../shared/app-config-bridge'
import type { FloatingWindowBridge, PipelineTasksBridge } from '../../shared/pipeline'

declare global {
  interface Window {
    appConfig?: AppConfigBridge
    pipelineTasks?: PipelineTasksBridge
    floatingWindow?: FloatingWindowBridge
  }
}

export {}
