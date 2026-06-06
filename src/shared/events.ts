export const appConfigEvents = {
  load: 'app-config:load',
  save: 'app-config:save'
} as const

export type AppConfigEventName = (typeof appConfigEvents)[keyof typeof appConfigEvents]
