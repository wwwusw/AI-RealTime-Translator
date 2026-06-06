# AI RealTime Translator

An Electron MVP for local media translation. The app now normalizes local audio/video files, prepares real pipeline chunks, and updates the renderer timeline from live subtitle events emitted by the main process.

## Current capabilities

- Import a local audio or video file and run the desktop translation task flow
- Normalize media to mono 16 kHz WAV, split it into overlapping chunks, and send each chunk through the pipeline
- Show task status, revision summary, and provider settings
- Render Chinese-first subtitles in the renderer from real `subtitle-added` and `subtitle-revised` events
- Highlight revised rows so users can see when the latest context corrected an earlier subtitle

## Tech stack

- Electron
- React
- TypeScript
- ffmpeg-static
- OpenAI-compatible audio transcription provider
- DeepSeek API for translation and correction via an OpenAI-compatible format

## Configuration

- `translation.baseUrl`: base URL for the OpenAI-compatible translation endpoint
- `translation.apiKey`: API key for translation/correction requests
- `translation.model`: model name for translation/correction requests
- `asr.provider`: current transcription provider selection
- `asr.baseUrl`: base URL for the OpenAI-compatible ASR endpoint when `openai-audio` is selected
- `asr.apiKey`: API key for ASR requests
- `asr.model`: model name for ASR requests

## Run locally

```bash
npm install
npm run dev
```

## Known limitations

- Phase 1 supports local file input only
- The current UI is still a task workspace, not a floating caption overlay
- System audio capture will be implemented in a later phase
- Exporting subtitles is not implemented yet

## Future notes

If we later introduce another framework or reuse historical code snippets, we will append that note here.
