import {
  ACCEL,
  BRAKE,
  BUMP,
  DECEL,
  HORSE_HALF_W,
  JUMP,
  LATERAL_ACCEL,
  LATERAL_FRICTION,
  LATERAL_MAX,
  MUD_SPEED_FACTOR,
  NOSE_OFFSET,
  SPEED,
  SPRINT_ACCEL,
  STAMINA,
  STRIDE_PX,
  STUMBLE,
  TRACK_LEFT,
  TRACK_RIGHT,
} from './constants'
import { type HorseLook, type Intent, NO_INTENT } from './types'

export const MIN_X = TRACK_LEFT + HORSE_HALF_W + 1
export const MAX_X = TRACK_RIGHT - HORSE_HALF_W - 1

/** One horse + jockey. Pure simulation state; rendering reads from it. */
export class Horse {
  readonly id: number
  readonly look: HorseLook
  readonly isPlayer: boolean

  x: number
  y: number
  vx = 0
  speed = 0
  stamina: number = STAMINA.max
  winded = false
  sprinting = false

  intent: Intent = { ...NO_INTENT }
  /** AI only: lateral target the horse steers towards instead of using left/right. */
  steerX: number | null = null
  /** AI only: small px/s adjustment on top of the intent's target speed. */
  speedBias = 0
  /** AI only: hard ceiling used to tuck in behind a slower horse. */
  speedCap = Infinity

  bumpTimer = 0
  bumpCooldown = 0
  gallop = 0

  /** Seconds into the current jump, or null when on the ground. */
  jumpT: number | null = null
  /** Height above the track in px, derived from jumpT. */
  z = 0
  stumbleTimer = 0
  inMud = false
  /** Set for one step when the horse touches down, so the race can kick up dust. */
  justLanded = false

  finished = false
  finishTime: number | null = null

  constructor(id: number, look: HorseLook, isPlayer: boolean, x: number, y: number) {
    this.id = id
    this.look = look
    this.isPlayer = isPlayer
    this.x = x
    this.y = y
  }

  get noseY() {
    return this.y + NOSE_OFFSET
  }

  get airborne() {
    return this.jumpT !== null
  }

  /** Normalised jump progress 0-1 (0 when grounded). */
  get jumpProgress() {
    return this.jumpT === null ? 0 : this.jumpT / JUMP.duration
  }

  /** Gallop animation frame 0-3, derived from distance travelled. */
  get frame() {
    return Math.floor(this.gallop * 4) % 4
  }

  targetSpeed(): number {
    const c = this.intent
    let target = SPEED.cruise
    if (c.down) target = SPEED.slow
    else if (c.up) target = this.winded ? SPEED.windedPush : SPEED.push
    if (this.sprinting) target = SPEED.sprint
    target += this.speedBias
    if (this.bumpTimer > 0) target *= BUMP.slowedTarget
    if (this.stumbleTimer > 0) target *= STUMBLE.slowedTarget
    if (this.inMud && !this.airborne) target *= MUD_SPEED_FACTOR
    return Math.min(target, this.speedCap, SPEED.max)
  }

  /** Starts a jump if the horse is on the ground and steady. Returns true on take-off. */
  tryJump(): boolean {
    if (this.airborne || this.stumbleTimer > 0 || this.speed < 30) return false
    this.jumpT = 0
    this.stamina = Math.max(0, this.stamina - JUMP.staminaCost)
    return true
  }

  stumble(kind: 'hedge' | 'bale') {
    const s = STUMBLE[kind]
    this.speed *= s.speedFactor
    this.stumbleTimer = s.duration
    this.sprinting = false
  }

  update(dt: number) {
    const c = this.intent
    this.justLanded = false

    this.sprinting = c.sprint && !c.down && !this.winded && this.stamina > 0 && this.stumbleTimer === 0

    // Momentum carries through a jump: speed only changes on the ground.
    if (!this.airborne) {
      const target = this.targetSpeed()
      if (this.speed < target) {
        this.speed = Math.min(target, this.speed + (this.sprinting ? SPRINT_ACCEL : ACCEL) * dt)
      } else {
        this.speed = Math.max(target, this.speed - (c.down ? BRAKE : DECEL) * dt)
      }
    }

    if (this.sprinting) {
      this.stamina -= STAMINA.sprintDrain * dt
      if (this.stamina <= 0) {
        this.stamina = 0
        this.winded = true
        this.sprinting = false
      }
    } else {
      const regen = c.down ? STAMINA.regenSlow : c.up ? STAMINA.regenPush : STAMINA.regenCruise
      this.stamina = Math.min(STAMINA.max, this.stamina + regen * dt)
      if (this.winded && this.stamina >= STAMINA.recoverAt) this.winded = false
    }

    // Lateral movement: steer towards a target (AI) or follow left/right (player).
    const lateralMax = LATERAL_MAX * (this.speed < 40 ? this.speed / 40 : 1) * (this.airborne ? JUMP.airControl : 1)
    let desiredVx: number
    if (this.steerX !== null) {
      desiredVx = Math.max(-lateralMax * 0.7, Math.min(lateralMax * 0.7, (this.steerX - this.x) * 4))
    } else {
      desiredVx = ((c.right ? 1 : 0) - (c.left ? 1 : 0)) * lateralMax
    }
    const rate = desiredVx === 0 ? LATERAL_FRICTION : LATERAL_ACCEL
    if (this.vx < desiredVx) this.vx = Math.min(desiredVx, this.vx + rate * dt)
    else this.vx = Math.max(desiredVx, this.vx - rate * dt)

    this.x += this.vx * dt
    this.clampToTrack()

    this.y += this.speed * dt
    if (!this.airborne) this.gallop += (this.speed * dt) / STRIDE_PX

    if (this.jumpT !== null) {
      this.jumpT += dt
      if (this.jumpT >= JUMP.duration) {
        this.jumpT = null
        this.z = 0
        this.justLanded = true
      } else {
        const u = this.jumpT / JUMP.duration
        this.z = JUMP.height * 4 * u * (1 - u)
      }
    }

    this.bumpTimer = Math.max(0, this.bumpTimer - dt)
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt)
    this.stumbleTimer = Math.max(0, this.stumbleTimer - dt)
  }

  clampToTrack() {
    if (this.x < MIN_X) {
      this.x = MIN_X
      if (this.vx < 0) this.vx = 0
    } else if (this.x > MAX_X) {
      this.x = MAX_X
      if (this.vx > 0) this.vx = 0
    }
  }
}
