# AI RealTime Translator

An Electron MVP for bilingual subtitles from either local media files or live Windows system audio. The app keeps the renderer timeline updated from `subtitle-pending`, `subtitle-added`, and `subtitle-revised` events emitted by the main process.

## Current capabilities

- Import a local audio or video file and run the desktop translation task flow
- Start a live Windows loopback capture session for system audio and stream chunks into the same subtitle pipeline
- Normalize media to mono 16 kHz WAV before ASR so file and live inputs share the same processing path
- Show task status, revision summary, provider settings, and input mode in the renderer
- Render Chinese-first subtitles from real `subtitle-pending`, `subtitle-added`, and `subtitle-revised` events
- Highlight revised rows so users can see when the latest context corrected an earlier subtitle

## Tech stack

- Electron
- React
- TypeScript
- ffmpeg-static
- OpenAI-compatible audio transcription providers
- DeepSeek API for translation and correction via an OpenAI-compatible format

## Configuration

- `inputMode`: choose `file` or `system-audio`
- `translation.baseUrl`: base URL for the OpenAI-compatible translation endpoint
- `translation.apiKey`: API key for translation and correction requests
- `translation.model`: model name for translation and correction requests
- `asr.provider`: current transcription provider selection
- `asr.baseUrl`: base URL for the selected ASR endpoint
- `asr.apiKey`: API key for ASR requests
- `asr.model`: model name for ASR requests

## Run locally

```bash
npm install
npm run dev
```

## Known limitations

- System audio capture currently depends on Electron loopback capture on Windows
- The current UI is still a task workspace, not a floating caption overlay
- local file input remains the safest fallback when display-audio sharing is blocked by the OS
- Exporting subtitles is not implemented yet

## Future notes

If we later introduce another framework or reuse historical code snippets, we will append that note here.
