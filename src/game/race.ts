import { type AIProfile, AIController } from './ai'
import { checkObstacles, resolveCollisions } from './collision'
import {
  CAMERA_SPEED_LEAD,
  COUNTDOWN_SECONDS,
  FINISH_Y,
  OUTRO_SECONDS,
  TRACK_LEFT,
  TRACK_RIGHT,
} from './constants'
import { Horse } from './horse'
import { type Obstacle, generateObstacles } from './obstacles'
import { Particles } from './particles'
import { type Difficulty, type HorseLook, type Intent, NO_INTENT, type RaceEvent, type RacePhase } from './types'

export interface Entrant {
  look: HorseLook
  ai?: AIProfile
}

// Lane order on the starting line, inside to outside.
export const FIELD: Entrant[] = [
  {
    look: { name: 'BLUE THUNDER', number: 2, coat: '#a3a7b2', mane: '#4b4e5c', silk: '#2f6fe0', silk2: '#f5d33b', pattern: 'hoops', cloth: '#c0392b', socks: false },
    ai: { style: 'front', aggression: 0.35 },
  },
  {
    look: { name: 'RED COMET', number: 1, coat: '#b8562c', mane: '#4a2312', silk: '#d8323c', silk2: '#f4efe6', pattern: 'sash', cloth: '#2f4fbf', socks: true },
  },
  {
    look: { name: 'GREEN WIND', number: 3, coat: '#6e3b1e', mane: '#1d120c', silk: '#2ea84a', silk2: '#f4efe6', pattern: 'stripe', cloth: '#f1c40f', socks: true },
    ai: { style: 'closer', aggression: 0.2 },
  },
  {
    look: { name: 'GOLD STORM', number: 4, coat: '#d9a647', mane: '#f4e6bf', silk: '#8e44c9', silk2: '#ff9f1c', pattern: 'halves', cloth: '#16a085', socks: false },
    ai: { style: 'steady', aggression: 0.5 },
  },
]

const DIFFICULTY_BIAS: Record<Difficulty, number> = { easy: -9, normal: -2, hard: 5 }
/** Chance a rival misjudges an obstacle. */
const AI_MISS_CHANCE: Record<Difficulty, number> = { easy: 0.3, normal: 0.15, hard: 0.06 }

export class Race {
  readonly horses: Horse[]
  readonly player: Horse
  readonly ai: AIController[]
  readonly particles = new Particles()
  readonly difficulty: Difficulty
  readonly obstacles: Obstacle[]
  /** horse id + obstacle index pairs already struck, so one obstacle trips a horse only once. */
  private readonly struck = new Set<string>()

  phase: RacePhase = 'grid'
  countdown = COUNTDOWN_SECONDS
  /** Race clock; only advances while racing, so pausing never affects it. */
  time = 0
  outro = 0
  /** Free-running clock for idle animation on the grid. */
  clock = 0
  camY: number

  finishOrder: Horse[] = []
  playerPosition: number | null = null
  playerTime: number | null = null
  events: RaceEvent[] = []

  constructor(difficulty: Difficulty, seed = Date.now()) {
    this.difficulty = difficulty
    this.obstacles = generateObstacles(seed)
    const laneW = (TRACK_RIGHT - TRACK_LEFT) / FIELD.length
    this.horses = FIELD.map((e, i) => new Horse(i, e.look, !e.ai, TRACK_LEFT + laneW * (i + 0.5), 0))
    this.player = this.horses.find((h) => h.isPlayer)!
    this.ai = FIELD.flatMap((e, i) => (e.ai ? [new AIController(this.horses[i], e.ai, seed + i * 977)] : []))
    this.camY = this.player.y
  }

  startCountdown() {
    if (this.phase !== 'grid') return
    this.phase = 'countdown'
    this.countdown = COUNTDOWN_SECONDS
    this.events.push({ type: 'countdown', value: COUNTDOWN_SECONDS })
  }

  update(dt: number, controls: Intent) {
    this.clock += dt
    switch (this.phase) {
      case 'grid':
      case 'done':
        break
      case 'countdown': {
        const before = Math.ceil(this.countdown)
        this.countdown -= dt
        const after = Math.ceil(this.countdown)
        if (this.countdown <= 0) {
          this.phase = 'racing'
          this.events.push({ type: 'go' })
        } else if (after !== before) {
          this.events.push({ type: 'countdown', value: after })
        }
        break
      }
      case 'racing':
      case 'finishing':
        this.simulate(dt, controls)
        if (this.phase === 'finishing') {
          this.outro -= dt
          if (this.outro <= 0) this.phase = 'done'
        }
        break
    }
    this.particles.update(dt)
  }

  private simulate(dt: number, controls: Intent) {
    this.time += dt
    const p = this.player
    if (p.finished) {
      p.intent = { ...NO_INTENT }
      p.speedBias = -30
    } else {
      p.intent = controls
    }

    const bias = DIFFICULTY_BIAS[this.difficulty]
    const miss = AI_MISS_CHANCE[this.difficulty]
    for (const ai of this.ai) ai.update(dt, this.horses, p, bias, this.obstacles, miss)

    for (const h of this.horses) {
      if (h.intent.jump && h.tryJump()) this.events.push({ type: 'jump', player: h.isPlayer })
      const before = h.frame
      h.update(dt)
      if (h.justLanded) {
        this.particles.dust(h.x - 4, h.y - 12, 4, h.speed, 1.3)
        this.particles.dust(h.x + 4, h.y - 12, 4, h.speed, 1.3)
        this.events.push({ type: 'land', player: h.isPlayer })
      }
      const hit = checkObstacles(h, this.obstacles)
      if (hit && hit.kind !== 'mud') {
        const key = `${h.id}:${this.obstacles.indexOf(hit)}`
        if (!this.struck.has(key)) {
          this.struck.add(key)
          h.stumble(hit.kind)
          if (hit.kind === 'bale') hit.knocked = true
          this.particles.dust(h.x, hit.y0, 10, h.speed, 1.8)
          this.events.push({ type: 'stumble', player: h.isPlayer })
        }
      }
      if (h.inMud && h.frame !== before) this.particles.mud(h.x, h.y - 14)
      const frame = h.frame
      if (frame !== before && (frame === 0 || frame === 2)) {
        // A hind hoof just struck the ground.
        const side = frame === 0 ? -4 : 4
        this.particles.dust(h.x + side, h.y - 14, h.sprinting ? 5 : 3, h.speed, h.sprinting ? 1.4 : 1)
        if (h.isPlayer) this.events.push({ type: 'hoof', player: true })
      }
    }

    for (const bump of resolveCollisions(this.horses)) {
      this.particles.dust(bump.x, bump.y, bump.heavy ? 8 : 5, bump.b.speed, 1.6)
      this.events.push({ type: 'bump', player: bump.a.isPlayer || bump.b.isPlayer, heavy: bump.heavy })
    }

    let crossed = false
    for (const h of this.horses) {
      if (h.finished || h.noseY < FINISH_Y) continue
      h.finished = true
      // Interpolate the exact crossing moment inside this step.
      h.finishTime = this.time - (h.speed > 0 ? (h.noseY - FINISH_Y) / h.speed : 0)
      this.finishOrder.push(h)
      crossed = true
    }
    if (crossed) {
      this.finishOrder.sort((a, b) => a.finishTime! - b.finishTime!)
      if (p.finished && this.playerPosition === null) {
        this.playerPosition = this.finishOrder.indexOf(p) + 1
        this.playerTime = p.finishTime
        this.phase = 'finishing'
        this.outro = OUTRO_SECONDS
        this.events.push({ type: 'finish', player: true })
      }
    }

    const target = p.y + p.speed * CAMERA_SPEED_LEAD
    this.camY += (target - this.camY) * Math.min(1, dt * 6)
  }

  /** Current running order: finishers by time, then everyone else by distance. */
  standings(): Horse[] {
    const running = this.horses.filter((h) => !h.finished).sort((a, b) => b.y - a.y)
    return [...this.finishOrder, ...running]
  }

  livePosition(): number {
    if (this.playerPosition !== null) return this.playerPosition
    return this.standings().indexOf(this.player) + 1
  }

  /** Finish time, or a projection for horses still running when results are shown. */
  projectedTime(h: Horse): number {
    if (h.finishTime !== null) return h.finishTime
    return this.time + (FINISH_Y - h.noseY) / Math.max(h.speed, 60)
  }
}
