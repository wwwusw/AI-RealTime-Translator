import { basename } from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import type { AppConfig } from '../../shared/config'
import {
  type PipelineInputMode,
  pipelineTaskChannels,
  type PipelineEvent,
  type PipelineTaskStage,
  type PipelineTaskStatus,
  type SystemAudioChunkPayload
} from '../../shared/pipeline'
import { loadConfig } from '../services/config-store'
import { pickMediaFile } from '../services/file-picker'
import { preparePipelineChunks } from '../services/pipeline-media-prep'
import { runPipeline } from '../services/pipeline-runner'
import { createDashScopeRealtimeAsrProvider } from '../services/providers/dashscope-realtime-asr-provider'
import { createOpenAiAudioAsrProvider } from '../services/providers/openai-audio-asr-provider'
import {
  createOpenAiChatRefinementProvider,
  createOpenAiChatTranslationProvider
} from '../services/providers/openai-chat-translation-provider'
import { createQwenLiveTranslateRealtimeProvider } from '../services/providers/qwen-live-translate-realtime-provider'
import { createScriptedAsrProvider } from '../services/providers/scripted-asr-provider'
import {
  createSystemAudioPipelineSession,
  type SystemAudioPipelineSession
} from '../services/system-audio-session'

type FileRunningTask = {
  kind: 'file'
  controller: AbortController
  promise: Promise<void>
}

type SystemAudioRunningTask = {
  kind: 'system-audio'
  controller: AbortController
  session: SystemAudioPipelineSession
}

type RunningTask = FileRunningTask | SystemAudioRunningTask

const buildTaskStatus = ({
  filePath,
  inputMode,
  sourceLabel,
  stage,
  lastRevisionSummary
}: {
  filePath: string | null
  inputMode: PipelineInputMode
  sourceLabel: string | null
  stage: PipelineTaskStage
  lastRevisionSummary: string
}): PipelineTaskStatus => ({
  filePath,
  inputMode,
  sourceLabel,
  stage,
  isRunning: stage === 'running',
  canStart: (inputMode === 'system-audio' || filePath !== null) && stage !== 'running',
  lastRevisionSummary
})

const createIdleTaskStatus = (
  summary = 'No task has run yet.',
  inputMode: PipelineInputMode = 'file'
): PipelineTaskStatus =>
  buildTaskStatus({
    filePath: null,
    inputMode,
    sourceLabel: null,
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
    case 'subtitle-blocks-updated': {
      const latestBlock = [...event.blocks]
        .reverse()
        .find(
          (block) =>
            block.refinedTranslation.trim().length > 0 ||
            block.liveTranslation.trim().length > 0 ||
            block.sourceTranscript.trim().length > 0
        )

      if (!latestBlock) {
        return 'Listening for the next live translation block.'
      }

      return `Live subtitle: ${
        latestBlock.refinedTranslation ||
        latestBlock.liveTranslation ||
        latestBlock.sourceTranscript
      }`
    }
    case 'subtitle-revised':
      return `Latest revision: ${event.subtitle.chinese}`
    case 'subtitle-pending':
      return 'Listening for the next subtitle chunk.'
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

const isSystemAudioTask = (task: RunningTask | null): task is SystemAudioRunningTask =>
  task?.kind === 'system-audio'

const broadcastPipelineEvent = (event: PipelineEvent) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(pipelineTaskChannels.pipelineEvent, event)
  }
}

const startPipelineRun = (filePath: string, config: AppConfig): PipelineTaskStatus => {
  const controller = new AbortController()
  const translationProvider = createOpenAiChatTranslationProvider(config.refiner)
  const asrProvider = createAsrProvider(config)

  setTaskStatus(
    buildTaskStatus({
      filePath,
      inputMode: 'file',
      sourceLabel: filePath,
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
            inputMode: 'file',
            sourceLabel: currentTaskStatus.sourceLabel,
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
          inputMode: 'file',
          sourceLabel: filePath,
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
          inputMode: 'file',
          sourceLabel: filePath,
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
    kind: 'file',
    controller,
    promise
  }

  return currentTaskStatus
}

const startSystemAudioRun = async (config: AppConfig): Promise<PipelineTaskStatus> => {
  const controller = new AbortController()
  const refinementProvider = createOpenAiChatRefinementProvider(config.refiner)
  const liveTranslateProvider = createQwenLiveTranslateRealtimeProvider(config.liveTranslate)
  const sourceLabel = 'System audio capture'

  setTaskStatus(
    buildTaskStatus({
      filePath: null,
      inputMode: 'system-audio',
      sourceLabel,
      stage: 'running',
      lastRevisionSummary: 'System audio capture is live. Waiting for the first chunk.'
    })
  )

  try {
    const session = await createSystemAudioPipelineSession({
      liveTranslateProvider,
      refinementProvider,
      blockDurationMs: config.blockDurationMs,
      sourceLanguage: config.liveTranslate.sourceLanguage,
      targetLanguage: config.liveTranslate.targetLanguage,
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
            inputMode: 'system-audio',
            sourceLabel,
            stage: currentTaskStatus.stage,
            lastRevisionSummary: nextSummary
          })
        )
      }
    })

    runningTask = {
      kind: 'system-audio',
      controller,
      session
    }

    return currentTaskStatus
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown pipeline error'
    return setTaskStatus(
      buildTaskStatus({
        filePath: null,
        inputMode: 'system-audio',
        sourceLabel,
        stage: 'paused',
        lastRevisionSummary: `Task failed: ${message}`
      })
    )
  }
}

const failRunningTask = async (message: string) => {
  const nextStatus = setTaskStatus(
    buildTaskStatus({
      filePath: currentTaskStatus.filePath,
      inputMode: currentTaskStatus.inputMode,
      sourceLabel: currentTaskStatus.sourceLabel,
      stage: currentTaskStatus.inputMode === 'system-audio' ? 'paused' : 'ready',
      lastRevisionSummary: `Task failed: ${message}`
    })
  )

  if (isSystemAudioTask(runningTask)) {
    const liveTask = runningTask
    runningTask = null
    liveTask.controller.abort()
    await liveTask.session.abort()
  }

  return nextStatus
}

export const registerTaskHandlers = () => {
  ipcMain.handle(pipelineTaskChannels.pickMediaFile, async (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    const file = await pickMediaFile(parentWindow)

    if (file) {
      setTaskStatus(
        buildTaskStatus({
          filePath: file.filePath,
          inputMode: 'file',
          sourceLabel: file.filePath,
          stage: 'ready',
          lastRevisionSummary: 'File selected. Ready to start the task.'
        })
      )
    }

    return file
  })

  ipcMain.handle(pipelineTaskChannels.getTaskStatus, async () => {
    if (
      currentTaskStatus.stage === 'idle' &&
      currentTaskStatus.filePath === null &&
      currentTaskStatus.sourceLabel === null
    ) {
      const inputMode = loadConfig().inputMode
      return setTaskStatus(createIdleTaskStatus(currentTaskStatus.lastRevisionSummary, inputMode))
    }

    return currentTaskStatus
  })

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

  ipcMain.handle(pipelineTaskChannels.startSystemAudioTask, async () => {
    if (runningTask) {
      return currentTaskStatus
    }

    const config = loadConfig()
    return startSystemAudioRun(config)
  })

  ipcMain.handle(
    pipelineTaskChannels.pushSystemAudioChunk,
    async (_event, chunkPayload: SystemAudioChunkPayload) => {
      if (!isSystemAudioTask(runningTask)) {
        return
      }

      try {
        await runningTask.session.appendChunk(chunkPayload)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown pipeline error'
        await failRunningTask(message)
        throw error
      }
    }
  )

  ipcMain.handle(pipelineTaskChannels.completeSystemAudioTask, async () => {
    if (!isSystemAudioTask(runningTask)) {
      return currentTaskStatus
    }

    const liveTask = runningTask
    runningTask = null

    try {
      await liveTask.session.complete()

      return setTaskStatus(
        buildTaskStatus({
          filePath: null,
          inputMode: 'system-audio',
          sourceLabel: currentTaskStatus.sourceLabel,
          stage: 'completed',
          lastRevisionSummary: currentTaskStatus.lastRevisionSummary
        })
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown pipeline error'
      await liveTask.session.abort()
      return setTaskStatus(
        buildTaskStatus({
          filePath: null,
          inputMode: 'system-audio',
          sourceLabel: currentTaskStatus.sourceLabel,
          stage: 'paused',
          lastRevisionSummary: `Task failed: ${message}`
        })
      )
    }
  })

  ipcMain.handle(pipelineTaskChannels.pauseTask, async () => {
    if (currentTaskStatus.stage !== 'running' || !runningTask) {
      return currentTaskStatus
    }

    const taskToPause = runningTask
    runningTask = null
    taskToPause.controller.abort()

    if (isSystemAudioTask(taskToPause)) {
      await taskToPause.session.abort()
    }

    return setTaskStatus(
      buildTaskStatus({
        filePath: currentTaskStatus.filePath,
        inputMode: currentTaskStatus.inputMode,
        sourceLabel: currentTaskStatus.sourceLabel,
        stage: 'paused',
        lastRevisionSummary: 'Task paused. The current pipeline run was aborted.'
      })
    )
  })

  ipcMain.handle(pipelineTaskChannels.resetTask, async () => {
    if (runningTask) {
      const taskToReset = runningTask
      runningTask = null
      taskToReset.controller.abort()

      if (isSystemAudioTask(taskToReset)) {
        await taskToReset.session.abort()
      }
    }

    return setTaskStatus(createIdleTaskStatus('Task reset. No file is selected.', loadConfig().inputMode))
  })
}
