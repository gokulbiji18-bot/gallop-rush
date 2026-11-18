import { Sound } from './audio'
import { FINISH_Y, FIXED_DT, MAX_FRAME_DT, PX_PER_METER, RACE_METERS, kmh } from './constants'
import { Race } from './race'
import { Renderer } from './renderer'
import { Input } from './input'
import { type Difficulty, NO_INTENT, type RacePhase } from './types'

export type Screen = 'menu' | 'race' | 'paused' | 'results'

export interface RacerDot {
  id: number
  name: string
  color: string
  progress: number
  rank: number
  isPlayer: boolean
}

export interface HudSnapshot {
  phase: RacePhase
  countdown: number
  position: number
  total: number
  time: number
  speedKmh: number
  stamina: number
  winded: boolean
  sprinting: boolean
  airborne: boolean
  stumbled: boolean
  inMud: boolean
  metersLeft: number
  progress: number
  racers: RacerDot[]
}

export interface ResultRow {
  name: string
  color: string
  time: number
  projected: boolean
  isPlayer: boolean
}

export interface RaceResult {
  position: number
  time: number
  best: number | null
  newBest: boolean
  difficulty: Difficulty
  field: ResultRow[]
}

export interface EngineCallbacks {
  onScreen: (screen: Screen) => void
  onHud: (hud: HudSnapshot) => void
  onResult: (result: RaceResult) => void
  onMuted: (muted: boolean) => void
}

const HUD_INTERVAL = 1 / 20
const BEST_KEY = 'gallop-rush:best'
const MUTE_KEY = 'gallop-rush:muted'

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode etc.) – best times just won't persist.
  }
}

/**
 * Owns the requestAnimationFrame loop and the screen state machine.
 * Simulation runs on a fixed 120 Hz step with an accumulator, so physics and
 * collisions behave the same at any display refresh rate; rendering happens
 * once per animation frame.
 */
export class GameEngine {
  private race: Race
  private readonly renderer: Renderer
  private readonly input = new Input()
  private readonly sound = new Sound()
  private readonly cb: EngineCallbacks
  private screen: Screen = 'menu'
  private difficulty: Difficulty = 'normal'
  private raf = 0
  private last = 0
  private acc = 0
  private hudTimer = 0

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.cb = cb
    this.renderer = new Renderer(canvas)
    this.race = new Race(this.difficulty)
    this.sound.muted = readStore(MUTE_KEY, false)
    cb.onMuted(this.sound.muted)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.input.destroy()
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  /** Exposed for automated play-testing from the browser console. */
  get debugRace() {
    return this.race
  }

  getBest(difficulty: Difficulty): number | null {
    return readStore<Partial<Record<Difficulty, number>>>(BEST_KEY, {})[difficulty] ?? null
  }

  setDifficulty(d: Difficulty) {
    this.difficulty = d
    if (this.screen === 'menu') this.race = new Race(d)
  }

  toggleMute() {
    this.sound.muted = !this.sound.muted
    writeStore(MUTE_KEY, this.sound.muted)
    this.cb.onMuted(this.sound.muted)
  }

  startRace() {
    if (this.screen !== 'menu' && this.screen !== 'results') return
    this.beginRace()
  }

  restart() {
    if (this.screen === 'menu') return
    this.beginRace()
  }

  pause() {
    if (this.screen !== 'race' || this.race.phase === 'done') return
    this.setScreen('paused')
  }

  resume() {
    if (this.screen !== 'paused') return
    this.acc = 0
    this.setScreen('race')
  }

  toMenu() {
    this.race = new Race(this.difficulty)
    this.setScreen('menu')
  }

  private beginRace() {
    this.sound.unlock()
    this.race = new Race(this.difficulty)
    this.race.startCountdown()
    this.acc = 0
    this.input.takePressed()
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    this.setScreen('race')
    this.emitHud()
  }

  private setScreen(s: Screen) {
    this.screen = s
    this.cb.onScreen(s)
  }

  private onVisibility = () => {
    if (document.hidden) this.pause()
  }

  private handleKeys() {
    const pressed = this.input.takePressed()
    const focusOnButton = document.activeElement instanceof HTMLButtonElement
    if (pressed.has('KeyM')) this.toggleMute()
    if (pressed.has('KeyP') || pressed.has('Escape')) {
      if (this.screen === 'race') this.pause()
      else if (this.screen === 'paused') this.resume()
    }
    if (pressed.has('KeyR') && (this.screen === 'paused' || this.screen === 'results')) this.restart()
    if (pressed.has('Enter') && !focusOnButton) {
      if (this.screen === 'menu' || this.screen === 'results') this.startRace()
      else if (this.screen === 'paused') this.resume()
    }
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const dt = this.last ? Math.min((now - this.last) / 1000, MAX_FRAME_DT) : 0
    this.last = now

    this.handleKeys()

    if (this.screen !== 'paused') {
      this.acc += dt
      while (this.acc >= FIXED_DT) {
        this.step(FIXED_DT)
        this.acc -= FIXED_DT
      }
    }

    this.renderer.render(this.race)

    this.hudTimer += dt
    if (this.screen === 'race' && this.hudTimer >= HUD_INTERVAL) {
      this.hudTimer = 0
      this.emitHud()
    }
  }

  private step(dt: number) {
    const race = this.race
    race.update(dt, this.screen === 'race' ? this.input.intent() : NO_INTENT)
    for (const e of race.events) this.sound.play(e)
    race.events.length = 0
    if (race.phase === 'done' && this.screen === 'race') this.finishRace()
  }

  private emitHud() {
    const race = this.race
    const p = race.player
    const metersLeft = Math.max(0, (FINISH_Y - p.noseY) / PX_PER_METER)
    const standings = race.standings()
    this.cb.onHud({
      phase: race.phase,
      countdown: Math.ceil(race.countdown),
      position: race.livePosition(),
      total: race.horses.length,
      time: race.playerTime ?? race.time,
      speedKmh: Math.round(kmh(p.speed)),
      stamina: p.stamina,
      winded: p.winded,
      sprinting: p.sprinting,
      airborne: p.airborne,
      stumbled: p.stumbleTimer > 0,
      inMud: p.inMud,
      metersLeft: Math.ceil(metersLeft),
      progress: 1 - metersLeft / RACE_METERS,
      racers: race.horses.map((h) => ({
        id: h.id,
        name: h.look.name,
        color: h.look.silk,
        progress: Math.max(0, Math.min(1, h.noseY / FINISH_Y)),
        rank: standings.indexOf(h) + 1,
        isPlayer: h.isPlayer,
      })),
    })
  }

  private finishRace() {
    const race = this.race
    const position = race.playerPosition ?? race.livePosition()
    const time = race.playerTime ?? race.time
    const bests = readStore<Partial<Record<Difficulty, number>>>(BEST_KEY, {})
    const prev = bests[this.difficulty] ?? null
    const newBest = prev === null || time < prev
    if (newBest) writeStore(BEST_KEY, { ...bests, [this.difficulty]: time })

    const field = race.horses
      .map((h) => ({
        name: h.look.name,
        color: h.look.silk,
        time: race.projectedTime(h),
        projected: h.finishTime === null,
        isPlayer: h.isPlayer,
      }))
      .sort((a, b) => a.time - b.time)

    this.sound.fanfare(position === 1)
    this.emitHud()
    this.cb.onResult({ position, time, best: newBest ? time : prev, newBest, difficulty: this.difficulty, field })
    this.setScreen('results')
  }
}
