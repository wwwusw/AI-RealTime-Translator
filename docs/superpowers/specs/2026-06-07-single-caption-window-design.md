# Single Caption Window Design

**Date:** 2026-06-07

## Objective

Replace the visible block list with one Windows Live Captions-inspired subtitle surface. The user
sees only a continuous translated string; block boundaries remain internal implementation details
for realtime updates and DeepSeek refinement.

This scope covers the confirmed behaviors:

1. Display translated subtitles inside one card with no list.
2. Append realtime translation continuously to the existing displayed text.
3. Keep at most 50 visible characters and discard overflow from the left.
4. Display no placeholder when translation is empty.

## Confirmed Product Decisions

- The UI contains one fixed-height subtitle card.
- The card displays translated text only. Source transcripts remain internal.
- The visible text contains at most 50 characters, including punctuation and whitespace.
- When visible text exceeds 50 characters, characters are removed from the left.
- Realtime translation is appended to the existing translated text.
- Updates to the same live block replace that block's previous partial text instead of appending
  duplicate partials.
- DeepSeek refinement silently replaces the corresponding realtime block text in place.
- Refinement causes no color change, animation, badge, status label, timestamp, or layout shift.
- Blocks with no effective translation contribute no visible text.
- The card never displays `Waiting for live translation...` or another placeholder.
- The card has no list, scrollbar, block boundary, timestamp, source transcript, or status indicator.

## Visual Direction

The subtitle surface follows the visual restraint of Windows Live Captions:

- Dark, nearly opaque translucent background.
- Light translated text with strong contrast.
- Modest corner radius and subtle border.
- Fixed height of approximately three lines.
- Text vertically centered when shorter than the available height.
- No internal scrolling. Overflow is controlled by the 50-character text window.
- Responsive width, with the existing application layout retained around it.

The rest of the application may continue using the existing light theme. The subtitle surface is
intentionally distinct because it represents the content the user reads continuously.

## Main And Renderer State

The main process keeps its existing six-block window for realtime translation and DeepSeek
refinement. The renderer maintains a small display buffer keyed by block ID so visible text is
discarded by the 50-character rule rather than by the six-block correction window.

The display buffer is updated whenever a `subtitle-blocks-updated` event arrives:

1. Upsert incoming blocks by ID.
2. Preserve older translated blocks that are absent from the latest main-process event while they
   still contribute to the visible 50-character tail.
3. Remove empty obsolete blocks immediately.
4. Remove complete oldest blocks when the remaining translated text still contains at least
   50 Unicode code points.
5. Let the caption composer trim the boundary block to exactly 50 code points.

This keeps the renderer buffer bounded to roughly 50 characters plus one boundary block while the
main process retains its independent six-block refinement policy.

## Caption Composition

For each block, display text is selected as:

```ts
const displayText =
  block.refinedTranslation.trim() ||
  block.liveTranslation.trim()
```

Blocks with an empty `displayText` are excluded.

Eligible block texts are joined in chronological order:

```ts
const joinedText = blocks
  .map(getBlockDisplayText)
  .filter(Boolean)
  .join('')
```

Joining inserts no automatic space. The translation provider owns punctuation and spacing. This
avoids introducing incorrect spaces between Chinese segments.

The visible 50-character window is derived from Unicode code points:

```ts
const visibleText = Array.from(joinedText).slice(-50).join('')
```

Using `Array.from` prevents truncation inside a surrogate pair. The limit is a code-point limit,
not a grapheme-cluster or pixel-width limit.

## Realtime Update Behavior

The realtime provider sends the full current translation for an item. The main-process block
aggregator replaces the item's previous `fullText`, then emits the current block state.

The renderer merges that state into its bounded display buffer and derives the caption again.
Therefore:

- `Today` followed by `Today we` renders `Today we`, not `TodayToday we`.
- A new translated block appends naturally after earlier blocks.
- Old text leaves the visible window only after combined text exceeds 50 characters.
- Short or silent blocks do not cause text to disappear merely because the main correction window
  advanced to a seventh block.

No renderer-side delta concatenation is required.

## Refinement Behavior

When a block receives `refinedTranslation`, that text becomes the display text for the block.
Rebuilding the continuous caption places refined text in the same chronological position.

Because the visible window is derived after replacement:

- A longer refined translation may remove more characters from the left.
- A shorter refined translation may reveal slightly older text retained in the display buffer.
- Replacement is visually silent.

## Empty And Silent Audio Behavior

Empty blocks remain valid internal timing and refinement objects but are invisible.

When all retained blocks have empty translation:

- Render the subtitle card with an empty text region while a task is active.
- Do not render placeholder text.
- Do not accumulate obsolete empty blocks in the renderer display buffer.

## Component Boundary

Create pure caption utilities responsible for:

- Selecting refined text over live text.
- Filtering empty translations.
- Joining block text.
- Applying the 50-character limit.
- Merging incoming block snapshots into the bounded display buffer.

`SubtitleTimeline.tsx` becomes a presentation component that renders the composed string inside
one subtitle card.

## Accessibility

- Label the section `Live translated captions`.
- Use `aria-live="polite"` and `aria-atomic="true"` on the translated text region.
- Do not announce empty block updates.
- Do not use rapidly blinking status elements.

## Testing

Unit tests must cover:

- Refined translation takes precedence over live translation.
- Empty translations are omitted.
- Consecutive block translations are joined without block markup.
- A partial update replaces previous text for the same block.
- Older short blocks remain visible after leaving the main six-block event until display text
  exceeds 50 characters.
- Obsolete empty blocks do not accumulate in the renderer buffer.
- Text longer than 50 Unicode code points retains only the final 50.
- Surrogate-pair characters are not split incorrectly.

Component tests must verify:

- Exactly one caption text container is rendered.
- No list items, timestamps, state badges, source transcript, or waiting placeholder are rendered.
- Empty translations produce an empty caption text region.
- Refined text appears instead of previous live text.

## Out Of Scope

- A detached always-on-top subtitle window.
- Font size, opacity, and position customization.
- Source-language display.
- Automatic source-language detection.
- Changing the main-process six-block retention and two-block refinement policy.
- Pixel-width-based truncation.
