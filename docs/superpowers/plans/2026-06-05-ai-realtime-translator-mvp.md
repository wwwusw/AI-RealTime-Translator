# AI RealTime Translator MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows-friendly Electron desktop MVP that imports local audio/video files, extracts audio, runs chunked English transcription, translates to Chinese, and revises the most recent subtitles as new context arrives.

**Architecture:** Use `electron-vite` to keep the Electron main process, preload bridge, and React renderer in one TypeScript workspace. Put pipeline logic in focused main-process services, keep subtitle state and DTOs in `src/shared`, and expose only small IPC methods to the renderer so the later move from file input to system-audio input stays localized.

**Tech Stack:** Electron, React, TypeScript, electron-vite, Vitest, Zustand, Zod, electron-store, ffmpeg-static, OpenAI-compatible HTTP clients for ASR and DeepSeek translation/revision.

---

## File Structure

### Root files

- `package.json`
  Project scripts, dependencies, and package metadata.
- `tsconfig.json`
  Shared TypeScript compiler settings.
- `tsconfig.node.json`
  Node/Electron-specific TypeScript settings.
- `electron.vite.config.ts`
  Build configuration for main, preload, and renderer bundles.
- `vitest.config.ts`
  Test runner configuration.
- `README.md`
  Setup, configuration, demo flow, architecture notes, and competition disclosure.

### Shared contract files

- `src/shared/config.ts`
  Config schema, defaults, and helper functions for persisted settings.
- `src/shared/subtitles.ts`
  Subtitle DTOs, statuses, revision-window rules, and pure state transitions.
- `src/shared/pipeline.ts`
  Task DTOs, chunk metadata, pipeline progress events, and error shapes.
- `src/shared/providers.ts`
  Provider interfaces for ASR and translation/revision.
- `src/shared/events.ts`
  IPC channel names and payload typings.

### Main-process files

- `src/main/index.ts`
  App startup, BrowserWindow creation, IPC registration.
- `src/main/ipc/config.ts`
  IPC handlers for loading and saving settings.
- `src/main/ipc/tasks.ts`
  IPC handlers for file import, start, pause, reset, and event fan-out.
- `src/main/services/config-store.ts`
  Persistence wrapper around `electron-store`.
- `src/main/services/file-picker.ts`
  File dialog helper and accepted extensions.
- `src/main/services/ffmpeg-service.ts`
  Audio normalization and chunk extraction using `ffmpeg-static`.
- `src/main/services/chunk-planner.ts`
  Pure chunk range calculation with overlap.
- `src/main/services/pipeline-runner.ts`
  Orchestrates chunking, ASR, translation, revision, and progress events.
- `src/main/services/providers/scripted-asr-provider.ts`
  Deterministic local provider for tests and UI development.
- `src/main/services/providers/openai-audio-asr-provider.ts`
  OpenAI-compatible `/audio/transcriptions` provider.
- `src/main/services/providers/openai-chat-translation-provider.ts`
  DeepSeek/OpenAI-compatible chat provider for translation and revision.

### Preload files

- `src/preload/index.ts`
  Safe bridge from renderer to main IPC.

### Renderer files

- `src/renderer/src/main.tsx`
  React entry.
- `src/renderer/src/App.tsx`
  Page layout and feature composition.
- `src/renderer/src/state/useAppStore.ts`
  UI state, subtitle list, progress state, and config forms.
- `src/renderer/src/features/settings/SettingsPanel.tsx`
  Config form for translation and ASR settings.
- `src/renderer/src/features/workspace/Workspace.tsx`
  File selection, start/pause/reset controls, and progress summary.
- `src/renderer/src/features/subtitles/SubtitleTimeline.tsx`
  Rolling subtitle UI with revision highlight.
- `src/renderer/src/features/status/StatusBar.tsx`
  Provider, model, and connection summary.
- `src/renderer/src/styles.css`
  Core layout and legible subtitle styling.

### Test files

- `tests/shared/config.test.ts`
  Config defaults and validation.
- `tests/shared/subtitles.test.ts`
  Revision window and freeze behavior.
- `tests/main/chunk-planner.test.ts`
  Chunk timing rules.
- `tests/main/pipeline-runner.test.ts`
  Pipeline orchestration with scripted providers.
- `tests/main/openai-chat-translation-provider.test.ts`
  Translation request formatting and JSON parsing.
- `tests/main/openai-audio-asr-provider.test.ts`
  ASR multipart request formatting.

## Implementation Notes Before Coding

1. Keep subtitle revision pure. The renderer should not decide which subtitles can still change.
2. Do not hardcode DeepSeek-specific field names outside the provider settings defaults. Business logic should only know `baseUrl`, `apiKey`, and `model`.
3. Because DeepSeek official docs expose OpenAI-compatible chat completions but do not document audio transcription endpoints as of `2026-06-05`, the ASR provider must stay separate from the translation provider.
4. Use `ffmpeg-static` so the app can run without requiring users to install `ffmpeg` globally.
5. Keep the first runnable milestone as early as possible: file import + scripted ASR + fake subtitles is better than waiting for all real providers before seeing the UI.

## Task 1: Bootstrap Electron Workspace And Config Schema

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `electron.vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/shared/config.ts`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/styles.css`
- Test: `tests/shared/config.test.ts`

- [ ] **Step 1: Write the bootstrap files and install dependencies**

```json
{
  "name": "ai-realtime-translator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist-electron/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "electron-store": "^10.0.0",
    "ffmpeg-static": "^5.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.25.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "electron": "^36.0.0",
    "electron-vite": "^3.0.0",
    "jsdom": "^26.0.0",
    "typescript": "^5.8.0",
    "vite": "^6.3.0",
    "vitest": "^3.2.0"
  }
}
```

```ts
// src/shared/config.ts
import { z } from 'zod'

export const providerConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1)
})

export const appConfigSchema = z.object({
  translation: providerConfigSchema.extend({
    baseUrl: z.string().url().default('https://api.deepseek.com'),
    model: z.string().min(1).default('deepseek-v4-flash')
  }),
  asr: z.object({
    provider: z.enum(['scripted', 'openai-audio']).default('scripted'),
    baseUrl: z.string().url().default('https://api.openai.com/v1'),
    apiKey: z.string().default(''),
    model: z.string().default('gpt-4o-mini-transcribe')
  }),
  revisionWindowSize: z.number().int().min(1).max(6).default(4),
  chunkDurationMs: z.number().int().min(1000).max(10000).default(5000),
  chunkOverlapMs: z.number().int().min(0).max(2000).default(1000)
})

export type AppConfig = z.infer<typeof appConfigSchema>

export const defaultAppConfig: AppConfig = appConfigSchema.parse({
  translation: { apiKey: '' }
})

export const mergeConfig = (value: unknown): AppConfig =>
  appConfigSchema.parse({
    ...defaultAppConfig,
    ...(typeof value === 'object' && value ? value : {})
  })
```

Run: `npm install`  
Expected: install completes with a new `package-lock.json`.

- [ ] **Step 2: Write the failing config test**

```ts
// tests/shared/config.test.ts
import { describe, expect, it } from 'vitest'
import { defaultAppConfig, mergeConfig } from '../../src/shared/config'

describe('config defaults', () => {
  it('uses DeepSeek defaults for translation and scripted ASR for local development', () => {
    expect(defaultAppConfig.translation.baseUrl).toBe('https://api.deepseek.com')
    expect(defaultAppConfig.translation.model).toBe('deepseek-v4-flash')
    expect(defaultAppConfig.asr.provider).toBe('scripted')
  })

  it('merges a partial persisted config without dropping defaults', () => {
    const merged = mergeConfig({
      translation: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'demo-key',
        model: 'deepseek-v4-pro'
      }
    })

    expect(merged.translation.model).toBe('deepseek-v4-pro')
    expect(merged.chunkDurationMs).toBe(5000)
    expect(merged.asr.provider).toBe('scripted')
  })
})
```

- [ ] **Step 3: Run the test to verify the schema behaves as expected**

Run: `npm test -- tests/shared/config.test.ts`  
Expected: PASS with `2 passed`.

- [ ] **Step 4: Add the minimal Electron shell**

```ts
// src/main/index.ts
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

```ts
// src/renderer/src/App.tsx
import './styles.css'

export default function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">AI RealTime Translator</p>
        <h1>准备开始本地文件同传</h1>
        <p>首个里程碑先打通桌面骨架、设置模型配置和字幕状态流。</p>
      </section>
    </main>
  )
}
```

```css
/* src/renderer/src/styles.css */
:root {
  color-scheme: light;
  font-family: "Segoe UI", "PingFang SC", sans-serif;
  background: linear-gradient(180deg, #f4efe5 0%, #f9f7f2 100%);
  color: #1b1a18;
}

body {
  margin: 0;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
}

.hero-card {
  max-width: 860px;
  border-radius: 24px;
  padding: 32px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 60px rgba(51, 41, 24, 0.12);
}

.eyebrow {
  margin: 0 0 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a5c2d;
}
```

- [ ] **Step 5: Smoke-test the app shell**

Run: `npm run dev`  
Expected: Electron window opens and shows the heading `准备开始本地文件同传`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json electron.vite.config.ts vitest.config.ts src tests
git commit -m "feat: bootstrap electron workspace"
```

## Task 2: Build Subtitle Domain And Config Persistence

**Files:**
- Create: `src/shared/subtitles.ts`
- Create: `src/shared/events.ts`
- Create: `src/main/services/config-store.ts`
- Create: `src/main/ipc/config.ts`
- Modify: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/src/state/useAppStore.ts`
- Create: `src/renderer/src/features/settings/SettingsPanel.tsx`
- Modify: `src/renderer/src/App.tsx`
- Test: `tests/shared/subtitles.test.ts`

- [ ] **Step 1: Write the failing subtitle-state test**

```ts
// tests/shared/subtitles.test.ts
import { describe, expect, it } from 'vitest'
import {
  applySubtitleRevision,
  createSubtitle,
  freezeExpiredDrafts
} from '../../src/shared/subtitles'

describe('subtitle revision window', () => {
  it('revises only the last draft subtitles', () => {
    const first = createSubtitle({ id: '1', english: 'hello world', chinese: '你好世界' })
    const second = createSubtitle({ id: '2', english: 'deep learning', chinese: '深度学习' })
    const revised = applySubtitleRevision([first, second], [
      { id: '2', chinese: '深度学习模型' }
    ])

    expect(revised[0].chinese).toBe('你好世界')
    expect(revised[1].chinese).toBe('深度学习模型')
    expect(revised[1].revisionCount).toBe(1)
  })

  it('freezes subtitles outside the revision window', () => {
    const subtitles = Array.from({ length: 5 }, (_, index) =>
      createSubtitle({
        id: String(index + 1),
        english: `line ${index + 1}`,
        chinese: `第 ${index + 1} 行`
      })
    )

    const frozen = freezeExpiredDrafts(subtitles, 4)
    expect(frozen[0].status).toBe('final')
    expect(frozen[4].status).toBe('draft')
  })
})
```

- [ ] **Step 2: Run the test to confirm the domain functions are still missing**

Run: `npm test -- tests/shared/subtitles.test.ts`  
Expected: FAIL with missing exports from `src/shared/subtitles.ts`.

- [ ] **Step 3: Implement the pure subtitle helpers**

```ts
// src/shared/subtitles.ts
export type SubtitleStatus = 'draft' | 'final'

export type SubtitleLine = {
  id: string
  english: string
  chinese: string
  status: SubtitleStatus
  revisionCount: number
  updatedAt: number
}

export const createSubtitle = ({
  id,
  english,
  chinese
}: Pick<SubtitleLine, 'id' | 'english' | 'chinese'>): SubtitleLine => ({
  id,
  english,
  chinese,
  status: 'draft',
  revisionCount: 0,
  updatedAt: Date.now()
})

export const applySubtitleRevision = (
  subtitles: SubtitleLine[],
  revisions: Array<{ id: string; chinese: string }>
) =>
  subtitles.map((line) => {
    const revision = revisions.find((item) => item.id === line.id)
    if (!revision) return line

    return {
      ...line,
      chinese: revision.chinese,
      revisionCount: line.revisionCount + 1,
      updatedAt: Date.now()
    }
  })

export const freezeExpiredDrafts = (subtitles: SubtitleLine[], windowSize: number) =>
  subtitles.map((line, index) => ({
    ...line,
    status: index < subtitles.length - windowSize ? 'final' : line.status
  }))
```

- [ ] **Step 4: Add persisted settings IPC and a basic settings form**

```ts
// src/main/services/config-store.ts
import Store from 'electron-store'
import { AppConfig, defaultAppConfig, mergeConfig } from '../../shared/config'

type PersistedShape = { config: AppConfig }

const store = new Store<PersistedShape>({
  name: 'ai-realtime-translator',
  defaults: { config: defaultAppConfig }
})

export const loadConfig = (): AppConfig => mergeConfig(store.get('config'))
export const saveConfig = (config: AppConfig): AppConfig => {
  const next = mergeConfig(config)
  store.set('config', next)
  return next
}
```

```ts
// src/renderer/src/features/settings/SettingsPanel.tsx
type SettingsPanelProps = {
  translationBaseUrl: string
  translationModel: string
  translationApiKey: string
}

export function SettingsPanel(props: SettingsPanelProps) {
  return (
    <section className="panel">
      <h2>模型设置</h2>
      <dl>
        <dt>翻译 Base URL</dt>
        <dd>{props.translationBaseUrl}</dd>
        <dt>翻译 Model</dt>
        <dd>{props.translationModel}</dd>
        <dt>翻译 API Key</dt>
        <dd>{props.translationApiKey ? '已填写' : '未填写'}</dd>
      </dl>
    </section>
  )
}
```

- [ ] **Step 5: Run the tests and the app**

Run: `npm test -- tests/shared/subtitles.test.ts tests/shared/config.test.ts`  
Expected: PASS with `4 passed`.

Run: `npm run dev`  
Expected: The window shows a settings summary panel with DeepSeek defaults.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add subtitle domain and config store"
```

## Task 3: Add File Intake, Audio Normalization, And Chunk Planning

**Files:**
- Create: `src/shared/pipeline.ts`
- Create: `src/main/services/file-picker.ts`
- Create: `src/main/services/chunk-planner.ts`
- Create: `src/main/services/ffmpeg-service.ts`
- Create: `src/main/ipc/tasks.ts`
- Modify: `src/main/index.ts`
- Create: `tests/main/chunk-planner.test.ts`

- [ ] **Step 1: Write the failing chunk-planner test**

```ts
// tests/main/chunk-planner.test.ts
import { describe, expect, it } from 'vitest'
import { planChunks } from '../../src/main/services/chunk-planner'

describe('planChunks', () => {
  it('creates overlapping chunks until the duration is exhausted', () => {
    const chunks = planChunks({
      totalDurationMs: 12_000,
      chunkDurationMs: 5_000,
      chunkOverlapMs: 1_000
    })

    expect(chunks).toEqual([
      { index: 0, startMs: 0, endMs: 5_000 },
      { index: 1, startMs: 4_000, endMs: 9_000 },
      { index: 2, startMs: 8_000, endMs: 12_000 }
    ])
  })
})
```

- [ ] **Step 2: Run the chunk-planner test to verify the missing implementation**

Run: `npm test -- tests/main/chunk-planner.test.ts`  
Expected: FAIL because `planChunks` does not exist yet.

- [ ] **Step 3: Implement chunk planning and ffmpeg normalization**

```ts
// src/main/services/chunk-planner.ts
export type PlannedChunk = {
  index: number
  startMs: number
  endMs: number
}

export const planChunks = ({
  totalDurationMs,
  chunkDurationMs,
  chunkOverlapMs
}: {
  totalDurationMs: number
  chunkDurationMs: number
  chunkOverlapMs: number
}): PlannedChunk[] => {
  const chunks: PlannedChunk[] = []
  const strideMs = chunkDurationMs - chunkOverlapMs

  for (let startMs = 0, index = 0; startMs < totalDurationMs; startMs += strideMs, index += 1) {
    chunks.push({
      index,
      startMs,
      endMs: Math.min(startMs + chunkDurationMs, totalDurationMs)
    })
  }

  return chunks
}
```

```ts
// src/main/services/ffmpeg-service.ts
import ffmpegPath from 'ffmpeg-static'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const normalizeAudio = async (sourcePath: string, outputName: string) => {
  const outputPath = join(tmpdir(), outputName)

  await new Promise<void>((resolve, reject) => {
    const child = spawn(String(ffmpegPath), [
      '-y',
      '-i',
      sourcePath,
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      'wav',
      outputPath
    ])

    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))))
  })

  return outputPath
}
```

- [ ] **Step 4: Expose a file-open IPC entry point**

```ts
// src/main/services/file-picker.ts
import { dialog, BrowserWindow } from 'electron'

export const pickMediaFile = async (win: BrowserWindow) => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Media', extensions: ['mp3', 'wav', 'm4a', 'mp4', 'mov', 'mkv'] }
    ]
  })

  return result.canceled ? null : result.filePaths[0]
}
```

- [ ] **Step 5: Run the planner test and a manual smoke test**

Run: `npm test -- tests/main/chunk-planner.test.ts`  
Expected: PASS with `1 passed`.

Run: `npm run dev`  
Expected: Selecting a file returns its path to the renderer and no Electron crash occurs.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add media import and chunk planning"
```

## Task 4: Build The Pipeline Runner With Scripted ASR

**Files:**
- Create: `src/shared/providers.ts`
- Create: `src/main/services/providers/scripted-asr-provider.ts`
- Create: `src/main/services/pipeline-runner.ts`
- Modify: `src/main/ipc/tasks.ts`
- Modify: `src/shared/pipeline.ts`
- Create: `tests/main/pipeline-runner.test.ts`

- [ ] **Step 1: Write the failing pipeline orchestration test**

```ts
// tests/main/pipeline-runner.test.ts
import { describe, expect, it } from 'vitest'
import { createPipelineRunner } from '../../src/main/services/pipeline-runner'

describe('pipeline runner', () => {
  it('emits English and Chinese subtitles for each chunk', async () => {
    const events: string[] = []

    const runner = createPipelineRunner({
      asrProvider: {
        transcribeChunk: async ({ chunkIndex }) => ({
          text: `english line ${chunkIndex + 1}`
        })
      },
      translationProvider: {
        translateBatch: async ({ subtitles }) =>
          subtitles.map((item) => ({
            id: item.id,
            chinese: `中文 ${item.english}`
          })),
        reviseBatch: async ({ subtitles }) =>
          subtitles.map((item) => ({
            id: item.id,
            chinese: `修订 ${item.english}`
          }))
      },
      emit: (event) => events.push(event.type)
    })

    await runner.run({
      chunks: [
        { index: 0, startMs: 0, endMs: 5000, filePath: 'chunk-0.wav' },
        { index: 1, startMs: 4000, endMs: 9000, filePath: 'chunk-1.wav' }
      ],
      revisionWindowSize: 2
    })

    expect(events).toContain('subtitle-added')
    expect(events).toContain('subtitle-revised')
    expect(events.at(-1)).toBe('pipeline-completed')
  })
})
```

- [ ] **Step 2: Run the pipeline test and confirm it fails**

Run: `npm test -- tests/main/pipeline-runner.test.ts`  
Expected: FAIL because `createPipelineRunner` does not exist yet.

- [ ] **Step 3: Implement provider interfaces and the runner**

```ts
// src/shared/providers.ts
export type AsrChunkInput = {
  chunkIndex: number
  filePath: string
}

export type AsrChunkOutput = {
  text: string
}

export type TranslationInput = {
  subtitles: Array<{ id: string; english: string; chinese: string }>
}

export interface AsrProvider {
  transcribeChunk(input: AsrChunkInput): Promise<AsrChunkOutput>
}

export interface TranslationProvider {
  translateBatch(input: TranslationInput): Promise<Array<{ id: string; chinese: string }>>
  reviseBatch(input: TranslationInput): Promise<Array<{ id: string; chinese: string }>>
}
```

```ts
// src/main/services/providers/scripted-asr-provider.ts
import type { AsrProvider } from '../../../shared/providers'

export const createScriptedAsrProvider = (): AsrProvider => ({
  async transcribeChunk({ chunkIndex }) {
    return { text: `scripted english line ${chunkIndex + 1}` }
  }
})
```

```ts
// src/main/services/pipeline-runner.ts
import { applySubtitleRevision, createSubtitle, freezeExpiredDrafts } from '../../shared/subtitles'
import type { AsrProvider, TranslationProvider } from '../../shared/providers'

export const createPipelineRunner = ({
  asrProvider,
  translationProvider,
  emit
}: {
  asrProvider: AsrProvider
  translationProvider: TranslationProvider
  emit: (event: { type: string; payload?: unknown }) => void
}) => ({
  async run({
    chunks,
    revisionWindowSize
  }: {
    chunks: Array<{ index: number; startMs: number; endMs: number; filePath: string }>
    revisionWindowSize: number
  }) {
    let subtitles = []

    for (const chunk of chunks) {
      const asr = await asrProvider.transcribeChunk({
        chunkIndex: chunk.index,
        filePath: chunk.filePath
      })

      const draft = createSubtitle({
        id: `subtitle-${chunk.index}`,
        english: asr.text,
        chinese: ''
      })

      subtitles = [...subtitles, draft]
      const translated = await translationProvider.translateBatch({
        subtitles: subtitles.map(({ id, english, chinese }) => ({ id, english, chinese }))
      })

      subtitles = applySubtitleRevision(subtitles, translated)
      emit({ type: 'subtitle-added', payload: subtitles.at(-1) })

      const revisable = subtitles.slice(-revisionWindowSize)
      const revised = await translationProvider.reviseBatch({
        subtitles: revisable.map(({ id, english, chinese }) => ({ id, english, chinese }))
      })

      subtitles = freezeExpiredDrafts(applySubtitleRevision(subtitles, revised), revisionWindowSize)
      emit({ type: 'subtitle-revised', payload: subtitles })
    }

    emit({ type: 'pipeline-completed' })
  }
})
```

- [ ] **Step 4: Run the pipeline test to verify the orchestration**

Run: `npm test -- tests/main/pipeline-runner.test.ts`  
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: add pipeline runner with scripted asr"
```

## Task 5: Add DeepSeek Translation And Revision Provider

**Files:**
- Create: `src/main/services/providers/openai-chat-translation-provider.ts`
- Modify: `src/main/services/pipeline-runner.ts`
- Modify: `src/renderer/src/features/settings/SettingsPanel.tsx`
- Create: `tests/main/openai-chat-translation-provider.test.ts`

- [ ] **Step 1: Write the failing translation-provider test**

```ts
// tests/main/openai-chat-translation-provider.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createOpenAiChatTranslationProvider } from '../../src/main/services/providers/openai-chat-translation-provider'

describe('openai chat translation provider', () => {
  it('posts an OpenAI-compatible chat request and returns parsed subtitles', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                subtitles: [{ id: 'subtitle-0', chinese: '你好，世界' }]
              })
            }
          }
        ]
      })
    })

    const provider = createOpenAiChatTranslationProvider({
      fetchImpl: fetchMock,
      config: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'demo-key',
        model: 'deepseek-v4-flash'
      }
    })

    const result = await provider.translateBatch({
      subtitles: [{ id: 'subtitle-0', english: 'hello world', chinese: '' }]
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result[0].chinese).toBe('你好，世界')
  })
})
```

- [ ] **Step 2: Run the provider test and verify the missing implementation**

Run: `npm test -- tests/main/openai-chat-translation-provider.test.ts`  
Expected: FAIL because the provider file does not exist yet.

- [ ] **Step 3: Implement the OpenAI-compatible translation provider**

```ts
// src/main/services/providers/openai-chat-translation-provider.ts
import type { TranslationProvider, TranslationInput } from '../../../shared/providers'

const toJsonPrompt = (mode: 'translate' | 'revise', input: TranslationInput) => ({
  subtitles: input.subtitles,
  mode
})

export const createOpenAiChatTranslationProvider = ({
  fetchImpl = fetch,
  config
}: {
  fetchImpl?: typeof fetch
  config: { baseUrl: string; apiKey: string; model: string }
}): TranslationProvider => {
  const call = async (mode: 'translate' | 'revise', input: TranslationInput) => {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content:
              'Return valid JSON with the shape {"subtitles":[{"id":"...","chinese":"..."}]}. Keep Chinese concise and natural.'
          },
          {
            role: 'user',
            content: JSON.stringify(toJsonPrompt(mode, input))
          }
        ],
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) throw new Error(`Translation request failed with ${response.status}`)
    const payload = await response.json()
    const content = payload.choices?.[0]?.message?.content ?? '{"subtitles":[]}'
    return JSON.parse(content).subtitles as Array<{ id: string; chinese: string }>
  }

  return {
    translateBatch: (input) => call('translate', input),
    reviseBatch: (input) => call('revise', input)
  }
}
```

- [ ] **Step 4: Wire the provider into the pipeline and settings screen**

```ts
// src/renderer/src/features/settings/SettingsPanel.tsx
type SettingsPanelProps = {
  translationBaseUrl: string
  translationModel: string
  translationApiKey: string
  asrProvider: string
}

// Add one new row:
// <dt>ASR Provider</dt>
// <dd>{props.asrProvider}</dd>
```

- [ ] **Step 5: Run provider tests and the full suite**

Run: `npm test -- tests/main/openai-chat-translation-provider.test.ts tests/main/pipeline-runner.test.ts tests/shared/config.test.ts tests/shared/subtitles.test.ts tests/main/chunk-planner.test.ts`  
Expected: PASS with all tests green.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add deepseek translation provider"
```

## Task 6: Add Real OpenAI-Compatible ASR And End-To-End Task Controls

**Files:**
- Create: `src/main/services/providers/openai-audio-asr-provider.ts`
- Modify: `src/main/ipc/tasks.ts`
- Modify: `src/main/services/pipeline-runner.ts`
- Modify: `src/renderer/src/state/useAppStore.ts`
- Modify: `src/renderer/src/features/workspace/Workspace.tsx`
- Modify: `src/renderer/src/features/status/StatusBar.tsx`
- Create: `tests/main/openai-audio-asr-provider.test.ts`

- [ ] **Step 1: Write the failing ASR provider test**

```ts
// tests/main/openai-audio-asr-provider.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createOpenAiAudioAsrProvider } from '../../src/main/services/providers/openai-audio-asr-provider'

describe('openai audio asr provider', () => {
  it('posts multipart form data to the transcription endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hello conference' })
    })

    const provider = createOpenAiAudioAsrProvider({
      fetchImpl: fetchMock,
      config: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'demo-key',
        model: 'gpt-4o-mini-transcribe'
      }
    })

    const result = await provider.transcribeChunk({
      chunkIndex: 0,
      filePath: 'fixtures/chunk-0.wav'
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result.text).toBe('hello conference')
  })
})
```

- [ ] **Step 2: Run the ASR test to confirm the provider is missing**

Run: `npm test -- tests/main/openai-audio-asr-provider.test.ts`  
Expected: FAIL because the provider file does not exist yet.

- [ ] **Step 3: Implement the OpenAI-compatible audio provider**

```ts
// src/main/services/providers/openai-audio-asr-provider.ts
import { readFile } from 'node:fs/promises'
import type { AsrProvider } from '../../../shared/providers'

export const createOpenAiAudioAsrProvider = ({
  fetchImpl = fetch,
  config
}: {
  fetchImpl?: typeof fetch
  config: { baseUrl: string; apiKey: string; model: string }
}): AsrProvider => ({
  async transcribeChunk({ filePath }) {
    const audio = await readFile(filePath)
    const form = new FormData()
    form.set('model', config.model)
    form.set('file', new Blob([audio], { type: 'audio/wav' }), 'chunk.wav')

    const response = await fetchImpl(`${config.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form
    })

    if (!response.ok) throw new Error(`ASR request failed with ${response.status}`)
    const payload = await response.json()
    return { text: String(payload.text ?? '') }
  }
})
```

- [ ] **Step 4: Add start, pause, and reset state transitions**

```ts
// src/renderer/src/features/workspace/Workspace.tsx
type WorkspaceProps = {
  filePath: string | null
  canStart: boolean
  isRunning: boolean
  onPickFile: () => void
  onStart: () => void
  onPause: () => void
  onReset: () => void
}

// Render buttons:
// 选择文件 / 开始处理 / 暂停处理 / 重置任务
```

```ts
// src/renderer/src/features/status/StatusBar.tsx
type StatusBarProps = {
  translationModel: string
  asrProvider: string
  stageLabel: string
  lastRevisionSummary: string
}
```

- [ ] **Step 5: Run targeted tests and a manual end-to-end pass**

Run: `npm test -- tests/main/openai-audio-asr-provider.test.ts tests/main/pipeline-runner.test.ts`  
Expected: PASS.

Run: `npm run dev`  
Expected: With `scripted` ASR selected, importing a file and pressing start shows rolling subtitles; with `openai-audio` selected and valid credentials, English text should come from real transcription.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add asr provider and task controls"
```

## Task 7: Polish The Timeline UI, Error States, And README

**Files:**
- Create: `src/renderer/src/features/subtitles/SubtitleTimeline.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles.css`
- Modify: `src/renderer/src/state/useAppStore.ts`
- Create: `README.md`

- [ ] **Step 1: Write the renderer behavior as a small manual acceptance checklist**

```md
1. Empty state shows how to configure DeepSeek translation and pick a file.
2. Draft subtitles have a visible "处理中" state.
3. Revised subtitles briefly highlight after updates.
4. Final subtitles stop changing once they leave the revision window.
5. Status bar shows ASR provider, translation model, and the latest revision summary.
```

- [ ] **Step 2: Implement the subtitle timeline and highlight styling**

```tsx
// src/renderer/src/features/subtitles/SubtitleTimeline.tsx
import type { SubtitleLine } from '../../../shared/subtitles'

export function SubtitleTimeline({ subtitles }: { subtitles: SubtitleLine[] }) {
  return (
    <section className="panel timeline">
      <h2>实时字幕</h2>
      {subtitles.map((line) => (
        <article
          key={line.id}
          className={`subtitle-card ${line.revisionCount > 0 ? 'subtitle-card--revised' : ''}`}
        >
          <p className="subtitle-card__zh">{line.chinese || '处理中...'}</p>
          <p className="subtitle-card__en">{line.english}</p>
          <p className="subtitle-card__meta">
            {line.status === 'draft' ? '处理中' : '已稳定'} · 修订 {line.revisionCount} 次
          </p>
        </article>
      ))}
    </section>
  )
}
```

```css
.timeline {
  display: grid;
  gap: 14px;
}

.subtitle-card {
  border-radius: 18px;
  padding: 18px;
  background: #fffdf8;
  border: 1px solid rgba(138, 92, 45, 0.14);
  transition: transform 160ms ease, background-color 160ms ease;
}

.subtitle-card--revised {
  background: #fff3d8;
  transform: translateY(-2px);
}

.subtitle-card__zh {
  margin: 0 0 8px;
  font-size: 22px;
  line-height: 1.5;
}

.subtitle-card__en,
.subtitle-card__meta {
  margin: 0;
  color: #6b6256;
}
```

- [ ] **Step 3: Write the README**

```md
# AI RealTime Translator

一个基于 Electron + React 的桌面版 AI 同声传译助手 MVP。

## 当前能力

- 导入本地音频或视频文件
- 本地抽取音频并切片
- 使用独立 ASR Provider 转写英文
- 使用 DeepSeek OpenAI 兼容接口翻译并回改最近几条字幕
- 在桌面界面中滚动显示字幕

## 技术栈

- Electron
- React
- TypeScript
- ffmpeg-static
- DeepSeek API（翻译与纠错，OpenAI 兼容格式）

## 配置说明

- 翻译配置需要 `baseUrl`、`apiKey`、`model`
- 默认翻译 `baseUrl` 为 `https://api.deepseek.com`
- ASR 可先用 `scripted` 模式进行 UI 演示，再切换到 `openai-audio`

## 运行方式

```bash
npm install
npm run dev
```

## 已知限制

- 第一阶段仅支持本地文件输入
- 系统音频实时采集将在下一阶段实现

## 说明

- 如果后续引入其他框架，会在此文档追加说明
- 如果复用历史代码片段，会在此文档追加来源说明
```

- [ ] **Step 4: Run the full verification pass**

Run: `npm test`  
Expected: all Vitest suites pass.

Run: `npm run build`  
Expected: Electron main, preload, and renderer bundles build without type errors.

- [ ] **Step 5: Commit**

```bash
git add src README.md
git commit -m "feat: polish subtitle ui and docs"
```

## Suggested PR Sequence

1. PR 1: Task 1
2. PR 2: Task 2
3. PR 3: Task 3
4. PR 4: Task 4
5. PR 5: Task 5
6. PR 6: Task 6
7. PR 7: Task 7

If a task gets too large in practice, split it before opening the PR. Favor smaller PRs over perfect PR count symmetry.

## Spec Coverage Self-Review

### Covered requirements from the approved spec

1. Desktop product shape: Tasks 1, 2, 7.
2. Local file import: Tasks 3 and 6.
3. Local audio extraction and chunking: Task 3.
4. English transcription: Tasks 4 and 6.
5. Chinese translation: Task 5.
6. Automatic correction of recent subtitles: Tasks 2, 4, and 5.
7. Start, pause, reset workflow: Task 6.
8. Settings page with OpenAI-compatible model config: Tasks 2 and 5.
9. Basic testing strategy: all tasks include targeted tests and Task 7 includes full verification.
10. README disclosure requirements: Task 7.

### Placeholder scan

No `TODO`, `TBD`, or “implement later” placeholders remain in the task list. All planned files, commands, and commit messages are explicit.

### Type consistency check

The plan uses the same names across tasks:

- `AppConfig`
- `SubtitleLine`
- `AsrProvider`
- `TranslationProvider`
- `createPipelineRunner`
- `createOpenAiChatTranslationProvider`
- `createOpenAiAudioAsrProvider`

These names should stay unchanged during implementation unless the plan is updated first.
