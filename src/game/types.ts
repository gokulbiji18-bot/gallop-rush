export type SilkPattern = 'sash' | 'stripe' | 'hoops' | 'halves'

export interface HorseLook {
  name: string
  number: number
  coat: string
  mane: string
  silk: string
  silk2: string
  pattern: SilkPattern
  cloth: string
  socks: boolean
}

export interface Intent {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  sprint: boolean
  /** Buffered jump request; the horse takes off as soon as it is on the ground. */
  jump: boolean
}

export const NO_INTENT: Intent = { left: false, right: false, up: false, down: false, sprint: false, jump: false }

export type Difficulty = 'easy' | 'normal' | 'hard'

export type RacePhase = 'grid' | 'countdown' | 'racing' | 'finishing' | 'done'

export type RaceEvent =
  | { type: 'countdown'; value: number }
  | { type: 'go' }
  | { type: 'hoof'; player: boolean }
  | { type: 'bump'; player: boolean; heavy: boolean }
  | { type: 'finish'; player: boolean }
  | { type: 'jump'; player: boolean }
  | { type: 'land'; player: boolean }
  | { type: 'stumble'; player: boolean }
