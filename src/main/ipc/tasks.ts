import { basename } from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import type { AppConfig } from '../../shared/config'
import {
  pipelineTaskChannels,
  type PipelineEvent,
  type PipelineTaskStage,
  type PipelineTaskStatus
} from '../../shared/pipeline'
import { loadConfig } from '../services/config-store'
import { pickMediaFile } from '../services/file-picker'
import { preparePipelineChunks } from '../services/pipeline-media-prep'
import { runPipeline } from '../services/pipeline-runner'
import { createDashScopeRealtimeAsrProvider } from '../services/providers/dashscope-realtime-asr-provider'
import { createOpenAiAudioAsrProvider } from '../services/providers/openai-audio-asr-provider'
import { createOpenAiChatTranslationProvider } from '../services/providers/openai-chat-translation-provider'
import { createScriptedAsrProvider } from '../services/providers/scripted-asr-provider'

type RunningTask = {
  controller: AbortController
  promise: Promise<void>
}

const buildTaskStatus = ({
  filePath,
  stage,
  lastRevisionSummary
}: {
  filePath: string | null
  stage: PipelineTaskStage
  lastRevisionSummary: string
}): PipelineTaskStatus => ({
  filePath,
  stage,
  isRunning: stage === 'running',
  canStart: filePath !== null && stage !== 'running',
  lastRevisionSummary
})

const createIdleTaskStatus = (summary = 'No task has run yet.'): PipelineTaskStatus =>
  buildTaskStatus({
    filePath: null,
    stage: 'idle',
    lastRevisionSummary: summary
  })

const createAsrProvider = (config: AppConfig) => {
  switch (config.asr.provider) {
    case 'openai-audio':
      return createOpenAiAudioAsrProvider({
        baseUrl: config.asr.baseUrl,
        apiKey: config.asr.apiKey,
        model: config.asr.model
      })
    case 'dashscope-realtime':
      return createDashScopeRealtimeAsrProvider({
        baseUrl: config.asr.baseUrl,
        apiKey: config.asr.apiKey,
        model: config.asr.model
      })
    case 'scripted':
    default:
      return createScriptedAsrProvider({
        getEnglishByChunk: async ({ chunkIndex, filePath }) =>
          `Scripted transcript ${chunkIndex + 1} from ${basename(filePath)}`
      })
  }
}

const createRevisionSummary = (event: PipelineEvent): string | null => {
  switch (event.type) {
    case 'subtitle-revised':
      return `Latest revision: ${event.subtitle.chinese}`
    case 'subtitle-added':
      return `Draft subtitle: ${event.subtitle.english}`
    case 'pipeline-completed':
      return event.subtitles.length > 0
        ? null
        : 'Pipeline completed without emitting subtitles.'
    default:
      return null
  }
}

let currentTaskStatus = createIdleTaskStatus()
let runningTask: RunningTask | null = null

const setTaskStatus = (status: PipelineTaskStatus) => {
  currentTaskStatus = status
  return currentTaskStatus
}

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError'

const broadcastPipelineEvent = (event: PipelineEvent) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(pipelineTaskChannels.pipelineEvent, event)
  }
}

const startPipelineRun = (filePath: string, config: AppConfig): PipelineTaskStatus => {
  const controller = new AbortController()
  const translationProvider = createOpenAiChatTranslationProvider(config.translation)
  const asrProvider = createAsrProvider(config)

  setTaskStatus(
    buildTaskStatus({
      filePath,
      stage: 'running',
      lastRevisionSummary: 'Task started. Waiting for pipeline events.'
    })
  )

  let cleanupPreparedMedia: (() => Promise<void>) | null = null

  const promise = (async () => {
    const preparedPipeline = await preparePipelineChunks(filePath, {
      chunkDurationMs: config.chunkDurationMs,
      chunkOverlapMs: config.chunkOverlapMs
    })
    cleanupPreparedMedia = preparedPipeline.cleanup

    if (controller.signal.aborted) {
      return
    }

    await runPipeline({
      chunks: preparedPipeline.chunks,
      asrProvider,
      translationProvider,
      revisionWindowSize: config.revisionWindowSize,
      signal: controller.signal,
      emitEvent: (event) => {
        broadcastPipelineEvent(event)

        const nextSummary = createRevisionSummary(event)
        if (!nextSummary) {
          return
        }

        setTaskStatus(
          buildTaskStatus({
            filePath: currentTaskStatus.filePath,
            stage: currentTaskStatus.stage,
            lastRevisionSummary: nextSummary
          })
        )
      }
    })
  })()
    .then(() => {
      if (runningTask?.controller !== controller || controller.signal.aborted) {
        return
      }

      setTaskStatus(
        buildTaskStatus({
          filePath,
          stage: 'completed',
          lastRevisionSummary: currentTaskStatus.lastRevisionSummary
        })
      )
    })
    .catch((error: unknown) => {
      if (runningTask?.controller !== controller) {
        return
      }

      if (controller.signal.aborted || isAbortError(error)) {
        return
      }

      const message = error instanceof Error ? error.message : 'unknown pipeline error'
      setTaskStatus(
        buildTaskStatus({
          filePath,
          stage: 'ready',
          lastRevisionSummary: `Task failed: ${message}`
        })
      )
    })
    .finally(() => {
      void cleanupPreparedMedia?.()
      if (runningTask?.controller === controller) {
        runningTask = null
      }
    })

  runningTask = {
    controller,
    promise
  }

  return currentTaskStatus
}

export const registerTaskHandlers = () => {
  ipcMain.handle(pipelineTaskChannels.pickMediaFile, async (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    const file = await pickMediaFile(parentWindow)

    if (file) {
      setTaskStatus(
        buildTaskStatus({
          filePath: file.filePath,
          stage: 'ready',
          lastRevisionSummary: 'File selected. Ready to start the task.'
        })
      )
    }

    return file
  })

  ipcMain.handle(pipelineTaskChannels.getTaskStatus, async () => currentTaskStatus)

  ipcMain.handle(pipelineTaskChannels.startTask, async (_event, filePath: string | null) => {
    if (runningTask) {
      return currentTaskStatus
    }

    const nextFilePath = filePath ?? currentTaskStatus.filePath

    if (!nextFilePath) {
      return currentTaskStatus
    }

    const config = loadConfig()
    return startPipelineRun(nextFilePath, config)
  })

  ipcMain.handle(pipelineTaskChannels.pauseTask, async () => {
    if (currentTaskStatus.stage !== 'running' || !runningTask || !currentTaskStatus.filePath) {
      return currentTaskStatus
    }

    runningTask.controller.abort()
    runningTask = null

    return setTaskStatus(
      buildTaskStatus({
        filePath: currentTaskStatus.filePath,
        stage: 'paused',
        lastRevisionSummary: 'Task paused. The current pipeline run was aborted.'
      })
    )
  })

  ipcMain.handle(pipelineTaskChannels.resetTask, async () => {
    if (runningTask) {
      runningTask.controller.abort()
      runningTask = null
    }

    return setTaskStatus(createIdleTaskStatus('Task reset. No file is selected.'))
  })
}
