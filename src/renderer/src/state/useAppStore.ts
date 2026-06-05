import { create } from 'zustand'
import type { AppConfigBridge } from '../../../shared/app-config-bridge'
import { defaultAppConfig, type AppConfig } from '../../../shared/config'
import type { PipelineTaskStage, PipelineTaskStatus, PipelineTasksBridge } from '../../../shared/pipeline'

type AppStoreTaskState = {
  filePath: string | null
  stage: PipelineTaskStage
  stageLabel: string
  isRunning: boolean
  canStart: boolean
  lastRevisionSummary: string
}

type AppStore = {
  config: AppConfig
  filePath: string | null
  stage: PipelineTaskStage
  stageLabel: string
  isRunning: boolean
  canStart: boolean
  lastRevisionSummary: string
  hydrateConfig: () => Promise<void>
  saveConfig: (config: AppConfig) => Promise<void>
  pick: () => Promise<void>
  start: () => Promise<void>
  pause: () => Promise<void>
  reset: () => Promise<void>
}

const getAppConfigBridge = (): AppConfigBridge | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.appConfig
}

const getPipelineTasksBridge = (): PipelineTasksBridge | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.pipelineTasks
}

const getStageLabel = (stage: PipelineTaskStage): string => {
  switch (stage) {
    case 'ready':
      return 'Ready'
    case 'running':
      return 'Running'
    case 'paused':
      return 'Paused'
    case 'idle':
    default:
      return 'Idle'
  }
}

const createTaskState = (status?: PipelineTaskStatus): AppStoreTaskState => ({
  filePath: status?.filePath ?? null,
  stage: status?.stage ?? 'idle',
  stageLabel: getStageLabel(status?.stage ?? 'idle'),
  isRunning: status?.isRunning ?? false,
  canStart: status?.canStart ?? false,
  lastRevisionSummary: status?.lastRevisionSummary ?? 'No task has run yet.'
})

export const useAppStore = create<AppStore>((set, get) => ({
  config: defaultAppConfig,
  ...createTaskState(),
  hydrateConfig: async () => {
    const appConfigBridge = getAppConfigBridge()
    const pipelineTasksBridge = getPipelineTasksBridge()

    if (!appConfigBridge) {
      return
    }

    const config = await appConfigBridge.load()
    const taskStatus = pipelineTasksBridge
      ? await pipelineTasksBridge.getTaskStatus()
      : undefined
    set({
      config,
      ...createTaskState(taskStatus)
    })
  },
  saveConfig: async (config) => {
    const bridge = getAppConfigBridge()
    if (!bridge) {
      set({ config })
      return
    }

    const next = await bridge.save(config)
    set({ config: next })
  },
  pick: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      return
    }

    const file = await bridge.pickMediaFile()

    if (!file) {
      return
    }

    set({
      ...createTaskState({
        filePath: file.filePath,
        stage: 'ready',
        isRunning: false,
        canStart: true,
        lastRevisionSummary: 'File selected. Ready to start the MVP task flow.'
      })
    })
  },
  start: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      return
    }

    const status = await bridge.startTask(get().filePath)
    set({
      ...createTaskState(status)
    })
  },
  pause: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      return
    }

    const status = await bridge.pauseTask()
    set({
      ...createTaskState(status)
    })
  },
  reset: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      set({
        ...createTaskState()
      })
      return
    }

    const status = await bridge.resetTask()
    set({
      ...createTaskState(status)
    })
  }
}))
