import { FINISH_Y, JUMP } from './constants'
import { type Horse, MAX_X, MIN_X } from './horse'
import { type Obstacle, inLane } from './obstacles'
import { mulberry32 } from './pixel'
import { NO_INTENT } from './types'

/**
 * Run styles give each rival a readable personality:
 * - front:  breaks fast and leads, then fades late
 * - closer: sits back conserving stamina, then kicks hard in the final quarter
 * - steady: even pace with a mid-race move and a late sprint
 */
export type RunStyle = 'front' | 'closer' | 'steady'

export interface AIProfile {
  style: RunStyle
  /** 0-1: how often the rival ignores a blocked lane and leans on its neighbour. */
  aggression: number
}

const THINK_INTERVAL = 0.2
const RUBBER_BAND_PX = 600
const RUBBER_BAND_SPEED = 8
const OBSTACLE_LOOKAHEAD = 200
const AVOID_RANGE = 160

/** How a rival will take one particular obstacle, decided when it first sees it. */
interface JumpPlan {
  /** px added to the ideal take-off distance; large values mean a misjudged jump. */
  offset: number
  /** Didn't spot it at all. */
  ignore: boolean
}

export class AIController {
  readonly horse: Horse
  readonly profile: AIProfile
  private readonly rng: () => number
  private thinkTimer: number
  private laneTimer: number
  private targetX: number
  private noisePhase: number
  private readonly plans = new Map<Obstacle, JumpPlan>()

  constructor(horse: Horse, profile: AIProfile, seed: number) {
    this.horse = horse
    this.profile = profile
    this.rng = mulberry32(seed)
    this.thinkTimer = this.rng() * THINK_INTERVAL
    this.laneTimer = 1.5 + this.rng() * 2
    this.targetX = horse.x
    this.noisePhase = this.rng() * Math.PI * 2
  }

  update(dt: number, horses: Horse[], player: Horse, difficultyBias: number, obstacles: Obstacle[], missChance: number) {
    const h = this.horse
    if (h.finished) {
      h.intent = { ...NO_INTENT }
      h.speedBias = -30
      h.speedCap = Infinity
      h.steerX = h.x
      return
    }

    this.planSpeed(dt, player, difficultyBias)

    this.thinkTimer -= dt
    if (this.thinkTimer <= 0) {
      this.thinkTimer += THINK_INTERVAL
      this.think(horses, obstacles)
    }
    h.steerX = this.targetX
    h.intent.jump = this.wantsJump(obstacles, missChance)
  }

  private planSpeed(dt: number, player: Horse, difficultyBias: number) {
    const h = this.horse
    const p = Math.max(0, Math.min(1, h.y / FINISH_Y))
    let bias = 0
    let sprint = false
    switch (this.profile.style) {
      case 'front':
        bias = p < 0.6 ? 2 : -9
        sprint = (p < 0.07 && h.stamina > 50) || p > 0.9
        break
      case 'closer':
        bias = p < 0.7 ? -12 : 6
        sprint = p > 0.76
        break
      case 'steady':
        bias = -4
        sprint = (p > 0.45 && p < 0.52 && h.stamina > 40) || p > 0.87
        break
    }

    this.noisePhase += dt * 0.7
    bias += Math.sin(this.noisePhase) * 3

    // Mild rubber band so the pack stays in reach without deciding the race.
    if (!player.finished) {
      const gap = (player.y - h.y) / RUBBER_BAND_PX
      bias += Math.max(-1, Math.min(1, gap)) * RUBBER_BAND_SPEED
    }

    h.intent = { left: false, right: false, up: true, down: false, sprint, jump: false }
    h.speedBias = bias + difficultyBias
  }

  private think(horses: Horse[], obstacles: Obstacle[]) {
    const h = this.horse
    h.speedCap = Infinity

    // 0. Steer round a bale or puddle when there's room; otherwise it gets jumped.
    const hazard = obstacles.find(
      (o) => o.kind !== 'hedge' && !o.knocked && o.y0 - h.noseY > 10 && o.y0 - h.noseY < AVOID_RANGE && inLane(o, this.targetX),
    )
    if (hazard) {
      const sides = [clampX(hazard.x0 - 11), clampX(hazard.x1 + 11)]
        .filter((x) => !inLane(hazard, x, 4) && this.laneIsClear(horses, x, -30, 60))
        .sort((a, b) => Math.abs(a - h.x) - Math.abs(b - h.x))
      if (sides.length) {
        this.targetX = sides[0]
        return
      }
    }

    // 1. Is someone directly ahead and in the way?
    let blocker: Horse | null = null
    for (const o of horses) {
      if (o === h) continue
      const dy = o.y - h.y
      if (dy > 0 && dy < 64 && Math.abs(o.x - h.x) < 15 && (!blocker || dy < blocker.y - h.y)) blocker = o
    }
    if (blocker && (blocker.speed < h.speed + 10 || blocker.y - h.y < 40)) {
      const lane = this.findFreeLane(horses)
      if (lane !== null) {
        this.targetX = lane
      } else if (this.rng() > this.profile.aggression) {
        // Boxed in: tuck in behind until a gap opens.
        const dy = blocker.y - h.y
        h.speedCap = blocker.speed + (dy - 36) * 0.8
      }
    }

    // 2. Occasional lane drift keeps the pack from looking robotic.
    this.laneTimer -= THINK_INTERVAL
    if (this.laneTimer <= 0) {
      this.laneTimer = 2 + this.rng() * 3
      const candidate = clampX(h.x + (this.rng() - 0.5) * 50)
      if (this.laneIsClear(horses, candidate, -30, 50)) this.targetX = candidate
    }

    // 3. Don't steer into a horse running alongside (unless feeling pushy).
    const dir = Math.sign(this.targetX - h.x)
    if (Math.abs(this.targetX - h.x) > 2) {
      const neighbour = horses.some(
        (o) => o !== h && Math.abs(o.y - h.y) < 30 && Math.sign(o.x - h.x) === dir && Math.abs(o.x - h.x) < 18,
      )
      if (neighbour && this.rng() > this.profile.aggression) this.targetX = h.x
    }
  }

  private wantsJump(obstacles: Obstacle[], missChance: number): boolean {
    const h = this.horse
    if (h.airborne) return false
    for (const o of obstacles) {
      if (o.knocked) continue
      const ahead = (o.y0 + o.y1) / 2 - h.y
      if (ahead < 0) continue
      if (ahead > OBSTACLE_LOOKAHEAD) break
      if (!inLane(o, h.x)) continue
      let plan = this.plans.get(o)
      if (!plan) {
        const miss = this.rng() < missChance
        plan = {
          offset: miss ? (this.rng() < 0.5 ? 1 : -1) * (30 + this.rng() * 25) : (this.rng() - 0.5) * 12,
          ignore: miss && this.rng() < 0.3,
        }
        this.plans.set(o, plan)
      }
      if (plan.ignore) return false
      // Take off so the top of the arc lands over the obstacle's middle.
      return ahead <= (h.speed * JUMP.duration) / 2 + plan.offset
    }
    return false
  }

  private findFreeLane(horses: Horse[]): number | null {
    const h = this.horse
    const offsets = this.rng() < 0.5 ? [-18, 18, -32, 32] : [18, -18, 32, -32]
    for (const off of offsets) {
      const cand = clampX(h.x + off)
      if (Math.abs(cand - h.x) < 8) continue
      if (this.laneIsClear(horses, cand, -30, 80)) return cand
    }
    return null
  }

  private laneIsClear(horses: Horse[], x: number, dyMin: number, dyMax: number) {
    const h = this.horse
    return !horses.some((o) => {
      if (o === h) return false
      const dy = o.y - h.y
      return dy > dyMin && dy < dyMax && Math.abs(o.x - x) < 14
    })
  }
}

function clampX(x: number) {
  return Math.max(MIN_X, Math.min(MAX_X, x))
}
