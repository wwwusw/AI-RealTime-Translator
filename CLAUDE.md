# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI RealTime Translator — a Windows desktop MVP that imports local audio/video files, extracts audio via `ffmpeg`, runs chunked English ASR transcription, translates to Chinese via DeepSeek (OpenAI-compatible API), and revises recent subtitles as new context arrives ("sliding window revision"). The project targets a 2026-06-07 deadline and prioritizes functional completeness over polish.

## Commands

```bash
npm install                          # Install dependencies
npm run dev                          # Start Electron dev server (hot-reload for renderer)
npm run build                        # Production build (main, preload, renderer)
npm run preview                      # Preview production build
npm test                             # Run all Vitest suites
npm test -- tests/<path>.test.ts     # Run a single test file
npm test -- --reporter=verbose       # Run tests with verbose output
```

Tests use `jsdom` environment (configured in `vitest.config.ts`). Test files live under `tests/` and match `*.test.ts`.

## Architecture

### Three-Bundle Electron Structure (electron-vite)

The app is built by `electron-vite` which produces three bundles:

| Bundle | Entry | Purpose |
|--------|-------|---------|
| **Main** | `src/main/index.ts` | Node.js process — window lifecycle, IPC handlers, ffmpeg calls, pipeline orchestration, file system access |
| **Preload** | `src/preload/index.ts` | Sandboxed bridge — exposes typed IPC methods to the renderer via `contextBridge` |
| **Renderer** | `src/renderer/src/main.tsx` | React 19 SPA — UI rendering, state management (Zustand), settings forms, subtitle timeline |

The build config in [electron.vite.config.ts](electron.vite.config.ts) externalizes Node deps for main/preload bundles and enables React fast-refresh for the renderer.

### Directory Organisation

```
src/
├── shared/          # Pure TypeScript — NO Node.js or DOM imports allowed
│   ├── config.ts    # Zod schemas for AppConfig, defaults, mergeConfig helper
│   ├── subtitles.ts # SubtitleLine DTO, status transitions, revision-window logic
│   ├── pipeline.ts  # Task DTOs, chunk metadata, progress event shapes
│   ├── providers.ts # AsrProvider and TranslationProvider interfaces
│   └── events.ts    # IPC channel name constants and payload types
├── main/
│   ├── index.ts     # Electron app entry, BrowserWindow creation, IPC registration
│   ├── ipc/         # IPC handler modules (config.ts, tasks.ts)
│   └── services/    # Main-process business logic
│       ├── config-store.ts       # electron-store wrapper for persisting settings
│       ├── file-picker.ts        # Native file dialog for media selection
│       ├── ffmpeg-service.ts     # Audio normalization + chunk extraction
│       ├── chunk-planner.ts      # Pure math — overlapping chunk time ranges
│       ├── pipeline-runner.ts    # Orchestrates chunk→ASR→translate→revise loops
│       └── providers/            # ASR and translation provider implementations
├── preload/
│   └── index.ts     # contextBridge exposing IPC to renderer
└── renderer/src/
    ├── main.tsx      # React entry point
    ├── App.tsx       # Root layout composing features
    ├── styles.css    # Global styles
    ├── state/        # Zustand stores
    └── features/     # Feature folders (settings, workspace, subtitles, status)
```

### Key Design Rules

1. **`src/shared/` is pure TypeScript.** No imports from `electron`, `fs`, `path`, `react`, or DOM APIs. It defines contracts consumed by both main and renderer.
2. **Provider abstraction.** Business logic uses `AsrProvider` and `TranslationProvider` interfaces from `src/shared/providers.ts`. Never hardcode DeepSeek-specific field names outside the provider config defaults.
3. **Subtitle revision is pure.** The renderer should not decide which subtitles can still change — `freezeExpiredDrafts()` and `applySubtitleRevision()` in `src/shared/subtitles.ts` are the single source of truth.
4. **ASR and translation are separate concerns.** DeepSeek exposes OpenAI-compatible chat completions but does not document audio transcription — so the ASR provider (`openai-audio`) uses a different endpoint from the translation provider (`openai-chat`).
5. **Use `ffmpeg-static`** so users don't need to install ffmpeg globally.

### Data Flow

```
User imports file → ffmpeg normalizes audio → planChunks() computes time ranges
→ For each chunk:
   1. ASR provider transcribes English text
   2. Translation provider generates Chinese from recent English segments
   3. Recent ~4 subtitles are revised (sliding window), older ones freeze to 'final'
→ Renderer receives events via IPC and updates subtitle timeline
```

### Configuration

Settings are persisted via `electron-store` with Zod validation. Defaults:
- Translation: `https://api.deepseek.com` with `deepseek-v4-flash`
- ASR: `scripted` (fake local provider for UI dev), switchable to `openai-audio`
- Chunk: 5s duration, 1s overlap, 4-item revision window

## Project State

The project was bootstrapped with the electron-vite skeleton, config schema, and one passing test (`tests/shared/config.test.ts`). The `src/` directory structure and all services/features are yet to be implemented per the MVP plan in [docs/superpowers/plans/](docs/superpowers/plans/2026-06-05-ai-realtime-translator-mvp.md). The design spec is at [docs/superpowers/specs/](docs/superpowers/specs/2026-06-05-ai-realtime-translator-design.md).

Implementation follows 7 tasks (8 suggested PRs), each adding a vertical slice with tests written first. The suggested PR sequence:
1. Bootstrap workspace + config schema
2. Subtitle domain + config persistence
3. File intake + audio normalization + chunk planning
4. Pipeline runner with scripted ASR
5. DeepSeek translation/revision provider
6. Real OpenAI-compatible ASR + end-to-end task controls
7. Timeline UI, error states, README

## Commit Conventions

- High commit frequency — commit after each small functional increment
- Each commit focuses on a single action
- Do not mix unrelated changes in one commit
- Commit messages follow `feat:`, `fix:`, `chore:`, `docs:` prefixes
- 开发新功能之前创建新的分支，在新的分支上开发，开发完成后创建PR，合并到main分支