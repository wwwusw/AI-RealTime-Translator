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
import { prepareNormalizedAudio } from '../services/pipeline-media-prep'
import { createFilePipelineSession } from '../services/file-pipeline-session'
import {
  createOpenAiChatRefinementProvider
} from '../services/providers/openai-chat-translation-provider'
import { createQwenLiveTranslateRealtimeProvider } from '../services/providers/qwen-live-translate-realtime-provider'
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
  summary = '尚未运行任务。',
  inputMode: PipelineInputMode = 'file'
): PipelineTaskStatus =>
  buildTaskStatus({
    filePath: null,
    inputMode,
    sourceLabel: null,
    stage: 'idle',
    lastRevisionSummary: summary
  })

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
        return '正在等待下一段实时翻译。'
      }

      return `实时字幕：${
        latestBlock.refinedTranslation ||
        latestBlock.liveTranslation ||
        latestBlock.sourceTranscript
      }`
    }
    case 'subtitle-pending':
      return '正在等待下一段字幕。'
    case 'subtitle-added':
      return `字幕草稿：${event.subtitle.english}`
    case 'subtitle-revised':
      return `最新精翻：${event.subtitle.chinese}`
    case 'pipeline-completed':
      return event.subtitles.length > 0
        ? '处理已完成。'
        : '处理已完成，但没有生成字幕。'
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
  const refinementProvider = createOpenAiChatRefinementProvider(config.refiner)
  const liveTranslateProvider = createQwenLiveTranslateRealtimeProvider(config.liveTranslate)

  setTaskStatus(
    buildTaskStatus({
      filePath,
      inputMode: 'file',
      sourceLabel: filePath,
      stage: 'running',
      lastRevisionSummary: '任务已启动，正在等待第一段字幕。'
    })
  )

  let cleanupPreparedMedia: (() => Promise<void>) | null = null

  const promise = (async () => {
    const prepared = await prepareNormalizedAudio(filePath)
    cleanupPreparedMedia = prepared.cleanup

    if (controller.signal.aborted) {
      return
    }

    const fileSession = await createFilePipelineSession({
      wavFilePath: prepared.normalizedFilePath,
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
            inputMode: 'file',
            sourceLabel: currentTaskStatus.sourceLabel,
            stage: currentTaskStatus.stage,
            lastRevisionSummary: nextSummary
          })
        )
      }
    })

    await fileSession.run()
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

      const message = error instanceof Error ? error.message : '未知处理错误'
      setTaskStatus(
        buildTaskStatus({
          filePath,
          inputMode: 'file',
          sourceLabel: filePath,
          stage: 'ready',
          lastRevisionSummary: `任务失败：${message}`
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
  const sourceLabel = '系统声音采集'

  setTaskStatus(
    buildTaskStatus({
      filePath: null,
      inputMode: 'system-audio',
      sourceLabel,
      stage: 'running',
      lastRevisionSummary: '系统声音采集已开始，正在等待第一段音频。'
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
    const message = error instanceof Error ? error.message : '未知处理错误'
    return setTaskStatus(
      buildTaskStatus({
        filePath: null,
        inputMode: 'system-audio',
        sourceLabel,
        stage: 'paused',
        lastRevisionSummary: `任务失败：${message}`
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
      lastRevisionSummary: `任务失败：${message}`
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
          lastRevisionSummary: '文件已选择，可以开始处理。'
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
        const message = error instanceof Error ? error.message : '未知处理错误'
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
      const message = error instanceof Error ? error.message : '未知处理错误'
      await liveTask.session.abort()
      return setTaskStatus(
        buildTaskStatus({
          filePath: null,
          inputMode: 'system-audio',
          sourceLabel: currentTaskStatus.sourceLabel,
          stage: 'paused',
          lastRevisionSummary: `任务失败：${message}`
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
        lastRevisionSummary: '任务已暂停，当前处理流程已终止。'
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

    return setTaskStatus(createIdleTaskStatus('任务已重置，请选择文件。', loadConfig().inputMode))
  })
}
