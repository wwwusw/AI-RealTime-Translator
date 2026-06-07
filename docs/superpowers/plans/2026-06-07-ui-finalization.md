# UI Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify runtime settings, restore reliable File mode switching, and translate the complete desktop UI into Chinese.

**Architecture:** Keep advanced provider values in `AppConfig` for pipeline compatibility while reducing only the renderer form. Treat an input-mode change as a task-context boundary: reset the previous pipeline state, save the new config, and rebuild renderer state. Centralize Chinese task-stage and summary generation at the existing renderer/main-process boundaries.

**Tech Stack:** Electron, React, TypeScript, Zustand, Zod, Vitest, React server rendering tests

---

### Task 1: Lock Down the Simplified Chinese Settings UI

**Files:**
- Modify: `tests/renderer/app.test.ts`
- Modify: `src/renderer/src/features/settings/SettingsPanel.tsx`

- [ ] **Step 1: Write the failing settings assertions**

Update the renderer test to require these visible controls:

```ts
expect(html).toContain('运行配置')
expect(html).toContain('输入模式')
expect(html).toContain('字幕块时长')
expect(html).toContain('源语言')
expect(html).toContain('目标语言')
expect(html).toContain('通义 API Key')
expect(html).toContain('DeepSeek API Key')
```

Also assert that advanced labels are absent:

```ts
expect(html).not.toContain('ASR Base URL')
expect(html).not.toContain('ASR Model')
expect(html).not.toContain('Live Translate Base URL')
expect(html).not.toContain('Live Translate Model')
expect(html).not.toContain('Refiner Base URL')
expect(html).not.toContain('Refiner Model')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/renderer/app.test.ts`

Expected: FAIL because the current panel uses English labels and renders advanced fields.

- [ ] **Step 3: Implement the minimal settings form**

Keep the component's full `AppConfig` draft but render only:

```tsx
inputMode
blockDurationMs
liveTranslate.sourceLanguage
liveTranslate.targetLanguage
liveTranslate.apiKey
refiner.apiKey
```

Use Chinese labels and option names. Do not modify hidden config values.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/renderer/app.test.ts`

Expected: PASS.

### Task 2: Synchronize Input Mode and Task State

**Files:**
- Modify: `tests/renderer/use-app-store.test.ts`
- Modify: `src/renderer/src/state/useAppStore.ts`

- [ ] **Step 1: Write a failing mode-switch regression test**

Set the store to a stale system-audio task state, save a config with `inputMode: 'file'`, and assert:

```ts
expect(window.pipelineTasks.resetTask).toHaveBeenCalledOnce()
expect(useAppStore.getState().config.inputMode).toBe('file')
expect(useAppStore.getState().filePath).toBe(null)
expect(useAppStore.getState().sourceLabel).toBe(null)
expect(useAppStore.getState().canStart).toBe(false)
expect(useAppStore.getState().subtitleBlocks).toEqual([])
```

Add the inverse assertion that switching to system audio uses the reset status and leaves `canStart` enabled.

- [ ] **Step 2: Run the store test and verify RED**

Run: `npm test -- tests/renderer/use-app-store.test.ts`

Expected: FAIL because `saveConfig` currently persists config without resetting task context.

- [ ] **Step 3: Implement mode-change synchronization**

In `saveConfig`:

```ts
const modeChanged = config.inputMode !== get().config.inputMode
```

When the mode changes, save the config first so `resetTask()` reads the new input mode. Then stop an active capture with reset semantics or call `pipelineTasks.resetTask()`, rebuild local task state for the newly selected mode, and clear subtitles. Browser-only preview falls back to `createTaskState()` with the correct `canStart` value for system audio.

- [ ] **Step 4: Run the store test and verify GREEN**

Run: `npm test -- tests/renderer/use-app-store.test.ts`

Expected: PASS.

### Task 3: Translate Renderer Components and Store Messages

**Files:**
- Modify: `tests/renderer/app.test.ts`
- Modify: `tests/renderer/subtitle-timeline.test.ts`
- Modify: `tests/renderer/use-app-store.test.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/features/workspace/Workspace.tsx`
- Modify: `src/renderer/src/features/status/StatusBar.tsx`
- Modify: `src/renderer/src/features/subtitles/SubtitleTimeline.tsx`
- Modify: `src/renderer/src/state/useAppStore.ts`

- [ ] **Step 1: Write failing Chinese UI assertions**

Require Chinese hero, workspace controls, status labels, subtitle accessibility text, stage labels, and renderer error prefixes. Assert obsolete visible English phrases are absent.

- [ ] **Step 2: Run renderer tests and verify RED**

Run: `npm test -- tests/renderer`

Expected: FAIL on English UI and store messages.

- [ ] **Step 3: Translate renderer-visible text**

Translate static component text and map task stages as:

```ts
idle -> 空闲
ready -> 就绪
running -> 运行中
paused -> 已暂停
completed -> 已完成
```

Translate renderer-owned summaries while preserving raw file paths, provider identifiers, and external error details.

- [ ] **Step 4: Run renderer tests and verify GREEN**

Run: `npm test -- tests/renderer`

Expected: PASS.

### Task 4: Translate Main-Process Task Summaries

**Files:**
- Modify: `tests/main/tasks.test.ts`
- Modify: `src/main/ipc/tasks.ts`

- [ ] **Step 1: Write failing summary assertions**

Update task-handler expectations to require Chinese idle, file-selected, running, paused, reset, completion-without-subtitles, and failure prefixes.

- [ ] **Step 2: Run the focused main-process test and verify RED**

Run: `npm test -- tests/main/tasks.test.ts`

Expected: FAIL because task summaries are currently English.

- [ ] **Step 3: Translate task summaries**

Translate only user-facing status strings emitted through `PipelineTaskStatus`. Keep exception messages and provider protocol errors unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/main/tasks.test.ts`

Expected: PASS.

### Task 5: Verify Compatibility and UI Behavior

**Files:**
- Verify: `tests/shared/config.test.ts`
- Verify: `tests/main/config-store.test.ts`
- Verify: `src/renderer/src/styles.css`

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: main, preload, and renderer bundles build successfully.

- [ ] **Step 3: Start the desktop development server**

Run: `npm run dev`

Expected: Electron renderer opens without startup errors.

- [ ] **Step 4: Visually verify both modes**

Confirm:

- File mode shows `选择文件`, hides system-audio-only instructions, and disables processing before selection.
- System audio mode shows `开始采集系统声音` and no file picker.
- The settings panel contains only six approved controls.
- No visible English headings, buttons, hints, or status labels remain.
- The single subtitle surface remains unchanged.

- [ ] **Step 5: Inspect the final diff**

Run: `git diff --check`

Expected: no whitespace errors.
