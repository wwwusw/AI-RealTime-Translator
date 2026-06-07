export const appConfigEvents = {
  load: 'app-config:load',
  save: 'app-config:save'
} as const

export type AppConfigEventName = (typeof appConfigEvents)[keyof typeof appConfigEvents]

export const floatingWindowChannels = {
  open: 'floating-window:open',
  close: 'floating-window:close',
  toggle: 'floating-window:toggle',
  getState: 'floating-window:get-state',
  stateChanged: 'floating-window:state-changed'
} as const

export type FloatingWindowChannelName = (typeof floatingWindowChannels)[keyof typeof floatingWindowChannels]
