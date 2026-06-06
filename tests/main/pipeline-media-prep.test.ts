import { describe, expect, it } from 'vitest'
import { readNormalizedWavDurationMs } from '../../src/main/services/pipeline-media-prep'

const createMono16kWavBuffer = (sampleCount: number): Buffer => {
  const bytesPerSecond = 16_000 * 2
  const dataSize = sampleCount * 2
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(16_000, 24)
  buffer.writeUInt32LE(bytesPerSecond, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)

  return buffer
}

describe('readNormalizedWavDurationMs', () => {
  it('reads the duration from a mono 16k PCM WAV buffer', () => {
    const wav = createMono16kWavBuffer(32_000)

    expect(readNormalizedWavDurationMs(wav)).toBe(2_000)
  })

  it('rejects files without a WAV data header', () => {
    expect(() => readNormalizedWavDurationMs(Buffer.from('not-a-wav'))).toThrow(
      'normalized audio is not a supported WAV file'
    )
  })
})
