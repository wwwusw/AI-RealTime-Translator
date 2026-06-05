# AI RealTime Translator

An Electron MVP for local media translation. The current renderer page includes a mock timeline so we can validate layout, status copy, and subtitle styling before the real subtitle event stream is connected.

## Current capabilities

- Import a local media file and show the workspace/task controls
- Show task status, revision summary, and provider settings
- Render a mock timeline in the renderer when a file is selected but real subtitle events are still unavailable
- Show Chinese as the primary subtitle line and English as supporting text
- Highlight revised draft rows without pretending the renderer is already showing live subtitle events

## Tech stack

- Electron
- React
- TypeScript
- ffmpeg-static
- DeepSeek API for translation and correction via an OpenAI-compatible format

## Configuration

- `baseUrl`: base URL for the OpenAI-compatible translation endpoint
- `apiKey`: API key for translation/correction requests
- `model`: model name for translation/correction requests

## Run locally

```bash
npm install
npm run dev
```

## Known limitations

- Phase 1 supports local file input only
- The current timeline is still a mock timeline
- The real subtitle event stream is not wired yet
- System audio capture will be implemented in a later phase

## Future notes

If we later introduce another framework or reuse historical code snippets, we will append that note here.
