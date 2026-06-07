# Single Caption Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the subtitle block list with one Windows Live Captions-inspired card that continuously displays the latest 50 translated Unicode code points.

**Architecture:** Keep the main-process six-block correction window unchanged. In the renderer, merge incoming block snapshots into a bounded display buffer, derive one translated string with refined text taking precedence, and retain only the final 50 code points. Render that string inside one fixed-height dark caption surface with no block metadata or placeholders.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, React DOM server rendering, CSS

---

## File Map

- Create `src/renderer/src/features/subtitles/compose-caption-text.ts`: Select block text, merge display history, and compose the final 50-character caption.
- Create `tests/renderer/compose-caption-text.test.ts`: Unit coverage for composition and bounded display history.
- Modify `src/renderer/src/state/useAppStore.ts`: Merge realtime block snapshots instead of replacing display history with the main six-block window.
- Modify `tests/renderer/use-app-store.test.ts`: Verify partial replacement and short-block retention.
- Modify `src/renderer/src/features/subtitles/SubtitleTimeline.tsx`: Render one translated text region.
- Modify `tests/renderer/subtitle-timeline.test.ts`: Verify single-surface rendering and empty translation behavior.
- Modify `src/renderer/src/styles.css`: Replace block-list styles with the fixed Windows-inspired caption surface.
- Modify `tests/renderer/app.test.ts`: Update application-level rendering and CSS assertions.

### Task 1: Build The Caption Composition Utilities

**Files:**
- Create: `src/renderer/src/features/subtitles/compose-caption-text.ts`
- Test: `tests/renderer/compose-caption-text.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `tests/renderer/compose-caption-text.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { TimelineSubtitleBlock } from '../../src/renderer/src/state/useAppStore'
import {
  composeCaptionText,
  mergeCaptionBlocks
} from '../../src/renderer/src/features/subtitles/compose-caption-text'

const createBlock = (
  index: number,
  liveTranslation: string,
  refinedTranslation = ''
): TimelineSubtitleBlock => ({
  id: `block-${index}`,
  index,
  startMs: index * 2000,
  endMs: (index + 1) * 2000,
  sourceTranscript: `source ${index}`,
  liveTranslation,
  refinedTranslation,
  status: refinedTranslation ? 'refined' : 'live',
  updatedAt: index
})

describe('composeCaptionText', () => {
  it('joins translated blocks without exposing block boundaries', () => {
    expect(
      composeCaptionText([
        createBlock(0, 'First translated sentence.'),
        createBlock(1, 'Second translated sentence.')
      ])
    ).toBe('First translated sentence.Second translated sentence.')
  })

  it('prefers refined text and ignores empty translations', () => {
    expect(
      composeCaptionText([
        createBlock(0, 'live text', 'refined text'),
        createBlock(1, '   '),
        createBlock(2, 'next text')
      ])
    ).toBe('refined textnext text')
  })

  it('keeps only the final 50 Unicode code points', () => {
    const text = `${'o'.repeat(10)}${'n'.repeat(50)}`
    expect(composeCaptionText([createBlock(0, text)])).toBe('n'.repeat(50))
  })

  it('does not split surrogate-pair characters', () => {
    const text = `${'x'.repeat(5)}${'😀'.repeat(50)}`
    const result = composeCaptionText([createBlock(0, text)])

    expect(Array.from(result)).toHaveLength(50)
    expect(result).toBe('😀'.repeat(50))
  })
})

describe('mergeCaptionBlocks', () => {
  it('retains an older short block when the total is still below 50 characters', () => {
    const existing = Array.from({ length: 6 }, (_, index) =>
      createBlock(index, String(index).repeat(5))
    )
    const incoming = Array.from({ length: 6 }, (_, index) =>
      createBlock(index + 1, String(index + 1).repeat(5))
    )

    expect(mergeCaptionBlocks(existing, incoming).map((block) => block.id)).toEqual([
      'block-0',
      'block-1',
      'block-2',
      'block-3',
      'block-4',
      'block-5',
      'block-6'
    ])
  })

  it('drops complete old blocks once newer text supplies at least 50 characters', () => {
    const existing = [
      createBlock(0, 'old'),
      createBlock(1, 'a'.repeat(25)),
      createBlock(2, 'b'.repeat(25))
    ]
    const incoming = [
      createBlock(1, 'a'.repeat(25)),
      createBlock(2, 'b'.repeat(25))
    ]

    expect(mergeCaptionBlocks(existing, incoming).map((block) => block.id)).toEqual([
      'block-1',
      'block-2'
    ])
  })

  it('does not retain obsolete empty blocks', () => {
    expect(
      mergeCaptionBlocks(
        [createBlock(0, ''), createBlock(1, 'visible')],
        [createBlock(1, 'visible')]
      ).map((block) => block.id)
    ).toEqual(['block-1'])
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm test -- tests/renderer/compose-caption-text.test.ts
```

Expected: FAIL because `compose-caption-text.ts` does not exist.

- [ ] **Step 3: Implement the utilities**

Create `src/renderer/src/features/subtitles/compose-caption-text.ts`:

```ts
import type { TimelineSubtitleBlock } from '../../state/useAppStore'

export const DEFAULT_CAPTION_CHARACTER_LIMIT = 50

export const getBlockTranslation = (block: TimelineSubtitleBlock): string =>
  block.refinedTranslation.trim() || block.liveTranslation.trim()

export const composeCaptionText = (
  blocks: TimelineSubtitleBlock[],
  characterLimit = DEFAULT_CAPTION_CHARACTER_LIMIT
): string => {
  const joinedText = blocks
    .map(getBlockTranslation)
    .filter(Boolean)
    .join('')

  return Array.from(joinedText)
    .slice(-Math.max(0, characterLimit))
    .join('')
}

export const mergeCaptionBlocks = (
  existingBlocks: TimelineSubtitleBlock[],
  incomingBlocks: TimelineSubtitleBlock[],
  characterLimit = DEFAULT_CAPTION_CHARACTER_LIMIT
): TimelineSubtitleBlock[] => {
  const incomingIds = new Set(incomingBlocks.map((block) => block.id))
  const blockById = new Map(
    existingBlocks
      .filter((block) => incomingIds.has(block.id) || getBlockTranslation(block))
      .map((block) => [block.id, block])
  )

  for (const block of incomingBlocks) {
    blockById.set(block.id, block)
  }

  const merged = [...blockById.values()].sort((left, right) => left.index - right.index)
  let firstRetainedIndex = 0

  while (firstRetainedIndex < merged.length - 1) {
    const remainingText = merged
      .slice(firstRetainedIndex + 1)
      .map(getBlockTranslation)
      .join('')

    if (Array.from(remainingText).length < characterLimit) {
      break
    }

    firstRetainedIndex += 1
  }

  return merged.slice(firstRetainedIndex)
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
npm test -- tests/renderer/compose-caption-text.test.ts
```

Expected: PASS with 7 tests.

- [ ] **Step 5: Commit**

```powershell
git add src/renderer/src/features/subtitles/compose-caption-text.ts tests/renderer/compose-caption-text.test.ts
git commit -m "feat: compose bounded continuous captions"
```

### Task 2: Merge Realtime Snapshots Into Display History

**Files:**
- Modify: `src/renderer/src/state/useAppStore.ts`
- Modify: `tests/renderer/use-app-store.test.ts`

- [ ] **Step 1: Add a failing display-history regression test**

Use the existing bridge-listener setup in `tests/renderer/use-app-store.test.ts`. Send six blocks
with five translated characters each, then send the next six-block main snapshot that omits
`block-0` and adds `block-6`.

Assert:

```ts
expect(useAppStore.getState().subtitleBlocks.map((block) => block.id)).toEqual([
  'block-0',
  'block-1',
  'block-2',
  'block-3',
  'block-4',
  'block-5',
  'block-6'
])
```

- [ ] **Step 2: Run the store test and verify RED**

Run:

```powershell
npm test -- tests/renderer/use-app-store.test.ts
```

Expected: FAIL because the current `subtitle-blocks-updated` branch replaces state with the latest
six blocks.

- [ ] **Step 3: Use `mergeCaptionBlocks` for realtime block events**

Import:

```ts
import { mergeCaptionBlocks } from '../features/subtitles/compose-caption-text'
```

Change the event branch in `applyPipelineEventToBlocks`:

```ts
case 'subtitle-blocks-updated':
  return mergeCaptionBlocks(blocks, event.blocks)
```

Keep the legacy file-mode event behavior unchanged.

- [ ] **Step 4: Add a partial replacement assertion**

Send two events for `block-0`, first with `liveTranslation: 'Today'`, then with
`liveTranslation: 'Today we'`.

Assert:

```ts
expect(useAppStore.getState().subtitleBlocks[0]?.liveTranslation).toBe('Today we')
```

- [ ] **Step 5: Run the store tests and verify GREEN**

Run:

```powershell
npm test -- tests/renderer/use-app-store.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/renderer/src/state/useAppStore.ts tests/renderer/use-app-store.test.ts
git commit -m "feat: retain bounded caption display history"
```

### Task 3: Render One Caption Surface

**Files:**
- Modify: `src/renderer/src/features/subtitles/SubtitleTimeline.tsx`
- Modify: `tests/renderer/subtitle-timeline.test.ts`

- [ ] **Step 1: Replace component tests with single-surface expectations**

The tests must assert:

```ts
expect(html).toContain('aria-live="polite"')
expect(html).toContain('aria-atomic="true"')
expect(html).toContain('class="live-caption-text"')
expect(html).not.toContain('<ol')
expect(html).not.toContain('<li')
expect(html).not.toContain('Refined')
expect(html).not.toContain('Pending')
expect(html).not.toContain('Waiting')
expect(html).not.toContain('Listening')
expect(html).not.toContain('00:00')
```

Add one test with live and refined blocks and assert the text is one continuous string. Add another
test containing only empty translations and assert the text region is empty.

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
npm test -- tests/renderer/subtitle-timeline.test.ts
```

Expected: FAIL because the component still renders block cards, metadata, transcripts, and
placeholders.

- [ ] **Step 3: Replace the list component**

Implement `SubtitleTimeline.tsx`:

```tsx
import type { TimelineMode, TimelineSubtitleBlock } from '../../state/useAppStore'
import { composeCaptionText } from './compose-caption-text'

type SubtitleTimelineProps = {
  subtitleBlocks: TimelineSubtitleBlock[]
  timelineMode: TimelineMode
}

export function SubtitleTimeline({
  subtitleBlocks,
  timelineMode: _timelineMode
}: SubtitleTimelineProps) {
  const captionText = composeCaptionText(subtitleBlocks)

  return (
    <section className="timeline-card live-caption-card" aria-label="Live translated captions">
      <div className="live-caption-surface">
        <p className="live-caption-text" aria-live="polite" aria-atomic="true">
          {captionText}
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npm test -- tests/renderer/compose-caption-text.test.ts tests/renderer/subtitle-timeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/renderer/src/features/subtitles/SubtitleTimeline.tsx tests/renderer/subtitle-timeline.test.ts
git commit -m "feat: render one live caption surface"
```

### Task 4: Apply Windows-Inspired Styling

**Files:**
- Modify: `src/renderer/src/styles.css`
- Modify: `tests/renderer/app.test.ts`

- [ ] **Step 1: Add failing CSS source assertions**

Extend `tests/renderer/app.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

it('uses a fixed caption surface without a scrolling block feed', () => {
  const styles = readFileSync(resolve('src/renderer/src/styles.css'), 'utf8')

  expect(styles).toContain('.live-caption-surface')
  expect(styles).toContain('height: 132px')
  expect(styles).toContain('overflow: hidden')
  expect(styles).not.toContain('.subtitle-window-feed')
  expect(styles).not.toContain('.subtitle-window-block')
})
```

Remove the old `Single-box rolling captions` app assertion.

- [ ] **Step 2: Run the app test and verify RED**

Run:

```powershell
npm test -- tests/renderer/app.test.ts
```

Expected: FAIL because old block-feed CSS remains.

- [ ] **Step 3: Replace obsolete block styles**

Remove `.subtitle-window-*`, `.timeline-state-*`, `.timeline-time`, and block metadata styles.
Add:

```css
.live-caption-card {
  padding: 22px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.72);
}

.live-caption-surface {
  height: 132px;
  display: flex;
  align-items: center;
  padding: 22px 28px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  background: rgba(12, 14, 17, 0.9);
  box-shadow:
    0 16px 44px rgba(0, 0, 0, 0.28),
    inset 0 1px rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
}

.live-caption-text {
  width: 100%;
  margin: 0;
  color: #fff;
  font-family: "Segoe UI Variable", "Microsoft YaHei UI", sans-serif;
  font-size: 24px;
  font-weight: 590;
  line-height: 1.55;
  letter-spacing: 0.012em;
  text-wrap: pretty;
}
```

Inside the existing mobile media query add:

```css
.live-caption-card {
  padding: 14px;
}

.live-caption-surface {
  height: 144px;
  padding: 20px;
}

.live-caption-text {
  font-size: 21px;
}
```

- [ ] **Step 4: Run renderer tests and verify GREEN**

Run:

```powershell
npm test -- tests/renderer
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/renderer/src/styles.css tests/renderer/app.test.ts
git commit -m "style: match Windows live caption presentation"
```

### Task 5: Full Verification

**Files:**
- No planned source changes.

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run the production build**

Run:

```powershell
npm run build
```

Expected: main, preload, and renderer bundles build successfully.

- [ ] **Step 3: Run a visual smoke test**

Run:

```powershell
npm run dev
```

Verify:

- One dark caption surface is visible.
- No subtitle list or block card appears.
- Realtime partial text replaces itself and grows at the end.
- New block text appends to existing text.
- More than 50 code points removes text from the left.
- DeepSeek refinement silently replaces the corresponding text.
- Silent audio shows no waiting placeholder.
- The surface remains usable at the mobile breakpoint.

- [ ] **Step 4: Check the final diff**

Run:

```powershell
git status --short
git diff --check
```

Expected: no whitespace errors and no unrelated file changes.
