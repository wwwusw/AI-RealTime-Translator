import type { SystemAudioChunkPayload } from '../../shared/pipeline'

const TARGET_SAMPLE_RATE = 16_000

export type SystemAudioStopMode = 'complete' | 'pause' | 'reset'

export type SystemAudioCaptureHandle = {
  stop: (mode?: SystemAudioStopMode) => Promise<void>
}

type StartSystemAudioCaptureOptions = {
  chunkDurationMs: number
  onChunk: (chunk: SystemAudioChunkPayload) => Promise<void> | void
  onStop: (mode: SystemAudioStopMode) => Promise<void> | void
  onError: (error: Error) => Promise<void> | void
}

const clampSample = (value: number): number => {
  if (value > 1) {
    return 1
  }

  if (value < -1) {
    return -1
  }

  return value
}

const downmixToMono = (event: AudioProcessingEvent): Float32Array => {
  const { inputBuffer } = event
  const { numberOfChannels, length } = inputBuffer

  if (numberOfChannels === 1) {
    return inputBuffer.getChannelData(0).slice()
  }

  const mono = new Float32Array(length)

  for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
    const channelData = inputBuffer.getChannelData(channelIndex)

    for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
      mono[sampleIndex] += channelData[sampleIndex] / numberOfChannels
    }
  }

  return mono
}

const resampleToTargetRate = (
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number
): Int16Array => {
  if (input.length === 0) {
    return new Int16Array(0)
  }

  if (inputSampleRate === targetSampleRate) {
    const pcm = new Int16Array(input.length)

    for (let index = 0; index < input.length; index += 1) {
      const sample = clampSample(input[index] ?? 0)
      pcm[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff)
    }

    return pcm
  }

  const outputLength = Math.max(1, Math.round((input.length * targetSampleRate) / inputSampleRate))
  const pcm = new Int16Array(outputLength)

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const position = (outputIndex * inputSampleRate) / targetSampleRate
    const lowerIndex = Math.floor(position)
    const upperIndex = Math.min(lowerIndex + 1, input.length - 1)
    const weight = position - lowerIndex
    const interpolated =
      (input[lowerIndex] ?? 0) * (1 - weight) + (input[upperIndex] ?? 0) * weight
    const sample = clampSample(interpolated)

    pcm[outputIndex] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff)
  }

  return pcm
}

const encodeMono16BitWav = (pcmSamples: Int16Array, sampleRate: number): Uint8Array => {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = pcmSamples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  let offset = 0

  const writeAscii = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index))
      offset += 1
    }
  }

  writeAscii('RIFF')
  view.setUint32(offset, 36 + dataSize, true)
  offset += 4
  writeAscii('WAVE')
  writeAscii('fmt ')
  view.setUint32(offset, 16, true)
  offset += 4
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint32(offset, sampleRate, true)
  offset += 4
  view.setUint32(offset, byteRate, true)
  offset += 4
  view.setUint16(offset, blockAlign, true)
  offset += 2
  view.setUint16(offset, 16, true)
  offset += 2
  writeAscii('data')
  view.setUint32(offset, dataSize, true)
  offset += 4

  for (let index = 0; index < pcmSamples.length; index += 1) {
    view.setInt16(offset, pcmSamples[index] ?? 0, true)
    offset += 2
  }

  return new Uint8Array(buffer)
}

export const startSystemAudioCapture = async ({
  chunkDurationMs,
  onChunk,
  onStop,
  onError
}: StartSystemAudioCaptureOptions): Promise<SystemAudioCaptureHandle> => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('System audio capture is unavailable in this renderer.')
  }

  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true
  })
  const audioTracks = displayStream.getAudioTracks()

  if (audioTracks.length === 0) {
    displayStream.getTracks().forEach((track) => track.stop())
    throw new Error('No system audio track was returned. Check Windows audio-sharing permissions.')
  }

  const audioStream = new MediaStream(audioTracks)
  const audioContext = new AudioContext()
  const sourceNode = audioContext.createMediaStreamSource(audioStream)
  const processorNode = audioContext.createScriptProcessor(4096, sourceNode.channelCount, 1)
  const silenceNode = audioContext.createGain()
  silenceNode.gain.value = 0

  const targetChunkSamples = Math.max(
    1,
    Math.round((TARGET_SAMPLE_RATE * Math.max(500, chunkDurationMs)) / 1000)
  )

  let stopMode: SystemAudioStopMode = 'complete'
  let stopPromise: Promise<void> | null = null
  let pendingSamples: number[] = []
  let processingQueue = Promise.resolve()
  let stopping = false

  const emitChunk = async (chunkSamples: Int16Array) => {
    if (chunkSamples.length === 0) {
      return
    }

    await onChunk({
      bytes: encodeMono16BitWav(chunkSamples, TARGET_SAMPLE_RATE),
      durationMs: Math.round((chunkSamples.length / TARGET_SAMPLE_RATE) * 1000),
      mimeType: 'audio/wav'
    })
  }

  const flushPendingSamples = async () => {
    while (pendingSamples.length >= targetChunkSamples) {
      const chunkSamples = Int16Array.from(pendingSamples.splice(0, targetChunkSamples))
      await emitChunk(chunkSamples)
    }
  }

  const stopTracks = () => {
    displayStream.getTracks().forEach((track) => track.stop())
    audioStream.getTracks().forEach((track) => {
      if (track.readyState !== 'ended') {
        track.stop()
      }
    })
  }

  const teardownAudioGraph = async () => {
    processorNode.disconnect()
    sourceNode.disconnect()
    silenceNode.disconnect()
    stopTracks()
    await audioContext.close()
  }

  const stop = async (mode: SystemAudioStopMode = 'complete') => {
    if (stopPromise) {
      return stopPromise
    }

    stopMode = mode
    stopping = true
    stopPromise = (async () => {
      try {
        await processingQueue.catch(() => undefined)

        if (pendingSamples.length > 0 && mode === 'complete') {
          await emitChunk(Int16Array.from(pendingSamples))
        }

        pendingSamples = []
      } finally {
        await teardownAudioGraph()
        await onStop(stopMode)
      }
    })()

    return stopPromise
  }

  audioTracks.forEach((track) => {
    track.addEventListener(
      'ended',
      () => {
        void stop('complete')
      },
      { once: true }
    )
  })

  processorNode.onaudioprocess = (event) => {
    if (stopping) {
      return
    }

    processingQueue = processingQueue
      .then(async () => {
        const monoSamples = downmixToMono(event)
        const pcmSamples = resampleToTargetRate(
          monoSamples,
          event.inputBuffer.sampleRate,
          TARGET_SAMPLE_RATE
        )

        for (let index = 0; index < pcmSamples.length; index += 1) {
          pendingSamples.push(pcmSamples[index] ?? 0)
        }

        await flushPendingSamples()
      })
      .catch(async (error) => {
        if (stopping) {
          return
        }

        await stop('pause')
        await onError(error instanceof Error ? error : new Error('unknown system audio capture error'))
      })
  }

  sourceNode.connect(processorNode)
  processorNode.connect(silenceNode)
  silenceNode.connect(audioContext.destination)
  await audioContext.resume()

  return { stop }
}
