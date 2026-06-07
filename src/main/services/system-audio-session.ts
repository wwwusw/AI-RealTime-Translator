import {
  SUBTITLE_BLOCK_PENDING_BATCH_SIZE,
  SUBTITLE_BLOCK_REFINED_CONTEXT_SIZE,
  SUBTITLE_BLOCK_WINDOW_SIZE,
  type PipelineEvent,
  type SubtitleBlock,
  type SubtitleBlockStatus,
  type SystemAudioChunkPayload
} from '../../shared/pipeline'
import type {
  LiveTranslateProvider,
  LiveTranslateStreamEvent,
  LiveTranslateSession,
  RefinementProvider,
  SubtitleBlockRefinementInput,
  SubtitleBlockRefinementResult
} from '../../shared/providers'

type SystemAudioSessionOptions = {
  liveTranslateProvider: LiveTranslateProvider
  refinementProvider: RefinementProvider
  emitEvent: (event: PipelineEvent) => void
  blockDurationMs: number
  sourceLanguage?: string
  targetLanguage: string
  signal?: AbortSignal
}

export type SystemAudioPipelineSession = {
  appendChunk: (chunk: SystemAudioChunkPayload) => Promise<void>
  complete: () => Promise<void>
  abort: () => Promise<void>
}

type ManagedBlock = SubtitleBlock & {
  itemOrder: string[]
  itemTextById: Map<string, { sourceTranscript: string; liveTranslation: string }>
}

type ManagedItemBinding = {
  blockId: string
}

const createManagedBlock = ({
  index,
  startMs,
  endMs
}: {
  index: number
  startMs: number
  endMs: number
}): ManagedBlock => ({
  id: `block-${index}`,
  index,
  startMs,
  endMs,
  sourceTranscript: '',
  liveTranslation: '',
  refinedTranslation: '',
  status: 'live',
  updatedAt: Date.now(),
  itemOrder: [],
  itemTextById: new Map()
})

const toPublicBlock = ({
  itemOrder: _itemOrder,
  itemTextById: _itemTextById,
  ...block
}: ManagedBlock): SubtitleBlock => block

const buildRefinementInput = (block: ManagedBlock): SubtitleBlockRefinementInput => ({
  id: block.id,
  sourceTranscript: block.sourceTranscript,
  liveTranslation: block.liveTranslation,
  refinedTranslation: block.refinedTranslation
})

const createBlocksUpdatedEvent = (blocks: ManagedBlock[]): PipelineEvent => ({
  type: 'subtitle-blocks-updated',
  blocks: blocks.map(toPublicBlock)
})

const trimBlocksWindow = (blocks: ManagedBlock[], itemBindings: Map<string, ManagedItemBinding>) => {
  while (blocks.length > SUBTITLE_BLOCK_WINDOW_SIZE) {
    const removedBlock = blocks.shift()

    if (!removedBlock) {
      return
    }

    for (const itemId of removedBlock.itemOrder) {
      itemBindings.delete(itemId)
    }
  }
}

const updateBlockText = (block: ManagedBlock) => {
  const orderedText = block.itemOrder
    .map((itemId) => block.itemTextById.get(itemId))
    .filter((value): value is NonNullable<typeof value> => value !== undefined)

  block.sourceTranscript = orderedText
    .map((value) => value.sourceTranscript.trim())
    .filter(Boolean)
    .join(' ')
    .trim()
  block.liveTranslation = orderedText
    .map((value) => value.liveTranslation.trim())
    .filter(Boolean)
    .join(' ')
    .trim()
  block.updatedAt = Date.now()
}

const applyRefinementResults = (
  blocks: ManagedBlock[],
  results: SubtitleBlockRefinementResult[]
): boolean => {
  let changed = false
  const translatedTextById = new Map(results.map((result) => [result.id, result.translatedText]))

  for (const block of blocks) {
    const translatedText = translatedTextById.get(block.id)

    if (!translatedText) {
      continue
    }

    block.refinedTranslation = translatedText
    block.status = 'refined'
    block.updatedAt = Date.now()
    changed = true
  }

  return changed
}

export const createSystemAudioPipelineSession = async ({
  liveTranslateProvider,
  refinementProvider,
  emitEvent,
  blockDurationMs,
  sourceLanguage,
  targetLanguage,
  signal
}: SystemAudioSessionOptions): Promise<SystemAudioPipelineSession> => {
  const blocks: ManagedBlock[] = []
  const itemBindings = new Map<string, ManagedItemBinding>()
  let nextBlockIndex = 0
  let totalAudioDurationMs = 0
  let queue = Promise.resolve()
  let refinementInFlight = false
  let finished = false
  let activeRefinementPromise: Promise<void> | null = null

  const emitBlocks = () => {
    emitEvent(createBlocksUpdatedEvent(blocks))
  }

  const findBlockById = (blockId: string): ManagedBlock | undefined =>
    blocks.find((block) => block.id === blockId)

  const appendNewLiveBlock = () => {
    const previousBlock = blocks.at(-1)
    const startMs = previousBlock?.endMs ?? 0
    const nextBlock = createManagedBlock({
      index: nextBlockIndex,
      startMs,
      endMs: startMs + blockDurationMs
    })
    nextBlockIndex += 1
    blocks.push(nextBlock)

    const liveBlocks = blocks.filter((block) => block.status === 'live')
    if (liveBlocks.length > 2) {
      const oldestLive = liveBlocks[0]
      oldestLive.status = 'pending_refine'
      oldestLive.updatedAt = Date.now()
    }

    trimBlocksWindow(blocks, itemBindings)
    emitBlocks()
  }

  const ensureWritableLiveBlock = () => {
    if (blocks.length === 0) {
      appendNewLiveBlock()
      return
    }

    while (true) {
      const latestBlock = blocks.at(-1)

      if (!latestBlock) {
        appendNewLiveBlock()
        return
      }

      if (totalAudioDurationMs < latestBlock.endMs) {
        return
      }

      appendNewLiveBlock()
    }
  }

  const chooseTargetBlockForNewItem = (): ManagedBlock => {
    const liveBlocks = blocks.filter((block) => block.status === 'live')
    const emptyLiveBlock = liveBlocks.find(
      (block) => block.itemOrder.length === 0 && block.liveTranslation.length === 0
    )

    if (emptyLiveBlock) {
      return emptyLiveBlock
    }

    const latestLiveBlock = liveBlocks.at(-1)

    if (!latestLiveBlock) {
      appendNewLiveBlock()
      return blocks.at(-1) as ManagedBlock
    }

    return latestLiveBlock
  }

  const tryRefinePendingBlocks = async () => {
    if (refinementInFlight) {
      return
    }

    const pendingBlocks = blocks.filter((block) => block.status === 'pending_refine')

    if (pendingBlocks.length < SUBTITLE_BLOCK_PENDING_BATCH_SIZE && !finished) {
      return
    }

    const pendingBatch = pendingBlocks.slice(
      0,
      finished ? pendingBlocks.length : SUBTITLE_BLOCK_PENDING_BATCH_SIZE
    )

    if (pendingBatch.length === 0) {
      return
    }

    refinementInFlight = true

    try {
      const firstPendingIndex = blocks.findIndex((block) => block.id === pendingBatch[0]?.id)
      const refinedContextBlocks = blocks
        .slice(0, Math.max(firstPendingIndex, 0))
        .filter((block) => block.status === 'refined')
        .slice(-SUBTITLE_BLOCK_REFINED_CONTEXT_SIZE)
        .map(buildRefinementInput)

      const results = await refinementProvider.refineBlocks(
        {
          refinedContextBlocks,
          pendingBlocks: pendingBatch.map(buildRefinementInput)
        },
        signal
      )

      if (applyRefinementResults(blocks, results)) {
        emitBlocks()
      }
    } finally {
      refinementInFlight = false
    }

    if (blocks.some((block) => block.status === 'pending_refine')) {
      await tryRefinePendingBlocks()
    }
  }

  const scheduleRefinement = () => {
    if (refinementInFlight || activeRefinementPromise) {
      return
    }

    const nextPromise = tryRefinePendingBlocks()
      .catch((error) => {
        console.error('Realtime subtitle refinement failed.', error)
      })
      .finally(() => {
        if (activeRefinementPromise === nextPromise) {
          activeRefinementPromise = null
        }
      })

    activeRefinementPromise = nextPromise
  }

  const handleLiveTranslateEvent = (event: LiveTranslateStreamEvent) => {
    let binding = itemBindings.get(event.itemId)

    if (!binding) {
      const targetBlock = chooseTargetBlockForNewItem()
      targetBlock.itemOrder.push(event.itemId)
      targetBlock.itemTextById.set(event.itemId, {
        sourceTranscript: '',
        liveTranslation: ''
      })
      binding = {
        blockId: targetBlock.id
      }
      itemBindings.set(event.itemId, binding)
    }

    const block = findBlockById(binding.blockId)

    if (!block) {
      return
    }

    const nextItemText = block.itemTextById.get(event.itemId) ?? {
      sourceTranscript: '',
      liveTranslation: ''
    }

    if (event.type === 'source-partial' || event.type === 'source-final') {
      nextItemText.sourceTranscript = event.fullText
    } else {
      nextItemText.liveTranslation = event.fullText
    }

    block.itemTextById.set(event.itemId, nextItemText)
    updateBlockText(block)
    emitBlocks()
  }

  const liveTranslateSession = await liveTranslateProvider.startSession({
    targetLanguage,
    sourceLanguage,
    signal,
    onEvent: handleLiveTranslateEvent
  })

  return {
    appendChunk: async (payload) => {
      queue = queue.then(async () => {
        signal?.throwIfAborted?.()
        ensureWritableLiveBlock()
        await liveTranslateSession.appendAudioChunk(payload, signal)
        totalAudioDurationMs += Math.max(1, Math.round(payload.durationMs))
        scheduleRefinement()
      })

      await queue
    },
    complete: async () => {
      finished = true
      await queue
      await activeRefinementPromise
      await liveTranslateSession.finish(signal)

      for (const block of blocks) {
        if (block.status === 'live') {
          block.status = 'pending_refine'
          block.updatedAt = Date.now()
        }
      }

      emitBlocks()
      await tryRefinePendingBlocks()
    },
    abort: async () => {
      finished = true
      await queue.catch(() => undefined)
      await liveTranslateSession.abort()
    }
  }
}
