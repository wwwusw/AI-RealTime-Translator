# UI Finalization Design

## Goal

Complete the desktop MVP UI by simplifying user-facing runtime settings, restoring reliable File mode behavior, and translating all visible renderer text into Chinese.

## Scope

This change covers three connected renderer concerns:

1. Reduce the settings panel to options an end user needs during normal operation.
2. Keep the selected input mode and the main-process task state synchronized.
3. Replace visible English UI copy, status labels, summaries, and accessibility labels with Chinese.

Provider defaults and persisted configuration compatibility remain intact. This change does not redesign the realtime pipeline or remove provider capabilities.

## Runtime Configuration

The settings panel will expose only:

- Input mode
- Subtitle block duration
- Source language
- Target language
- DashScope API key
- DeepSeek API key

The following advanced fields will no longer appear in the UI:

- ASR provider
- ASR base URL
- ASR model
- Live translation base URL
- Live translation model
- Refiner base URL
- Refiner model

These fields remain in `AppConfig`, keep their current defaults, and continue to be persisted. File mode still needs the ASR configuration and both modes need provider model/base URL values, so deleting them from the schema would break working behavior and old saved configurations.

The settings panel will use Chinese labels and Chinese option names. API keys remain password inputs.

## Input Mode Synchronization

The root cause of the File mode issue is duplicated mode state:

- The renderer chooses its UI from `config.inputMode`.
- The main process keeps the previous task's `PipelineTaskStatus`, including its input mode, source label, and start state.

Saving a different input mode currently updates only the config. The previous system-audio task status can therefore continue to supply stale source and status information.

When the saved input mode changes:

1. Persist the new configuration so the main process recognizes the selected mode.
2. Stop or reset any active task through the pipeline bridge.
3. Rebuild renderer task state from the reset status.
4. Clear the subtitle window.

The selected mode becomes visible immediately after saving. In File mode, the file selection button is always present. Starting processing remains disabled until a file is selected. In system-audio mode, the start button is available without a file.

If config persistence is unavailable in a browser-only preview, the renderer still updates local config and resets its local task state.

## Chinese Localization

All user-visible renderer strings will be Chinese, including:

- Hero title and description
- Workspace headings, instructions, buttons, and selected-source fallback text
- Status field names and stage labels
- Settings headings, labels, options, and save button
- Subtitle region accessibility label
- Renderer-generated success, cancellation, reset, bridge, and error summaries

Provider identifiers, model identifiers, URLs, file paths, and raw external error details remain unchanged because they are technical values rather than UI copy. Chinese prefixes will provide context around raw errors.

Main-process task summaries returned to the renderer will also be translated so the status panel does not regress to English after an IPC response.

## Testing

Tests will verify:

- The settings panel contains only the six approved user-facing controls.
- File mode renders a file selection control and system-audio mode does not.
- Changing from system audio to File mode resets stale task state and restores file selection behavior.
- The app's visible static text and accessibility labels are Chinese.
- Stage labels and renderer-generated summaries are Chinese.
- Existing config values for hidden advanced fields still merge and persist.
- Full unit tests and production build pass.

The Electron renderer will be opened after implementation for a visual smoke test of both input modes.
