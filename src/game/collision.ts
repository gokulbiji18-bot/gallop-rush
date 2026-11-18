import { BUMP, HORSE_HALF_L, HORSE_HALF_W } from './constants'
import type { Horse } from './horse'
import type { Obstacle } from './obstacles'

export interface Bump {
  a: Horse
  b: Horse
  heavy: boolean
  x: number
  y: number
}

/**
 * Axis-aligned overlap test between every pair of horses, resolved along the
 * axis of least penetration: side-by-side contact pushes horses apart
 * laterally, nose-to-tail contact slows the horse behind.
 */
export function resolveCollisions(horses: Horse[]): Bump[] {
  const bumps: Bump[] = []
  for (let i = 0; i < horses.length; i++) {
    for (let j = i + 1; j < horses.length; j++) {
      const a = horses[i]
      const b = horses[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const ox = HORSE_HALF_W * 2 - Math.abs(dx)
      const oy = HORSE_HALF_L * 2 - Math.abs(dy)
      if (ox <= 0 || oy <= 0) continue
      // A horse in the air sails over one on the ground.
      if (Math.abs(a.z - b.z) > 6) continue

      const fresh = a.bumpCooldown === 0 && b.bumpCooldown === 0
      if (ox < oy) {
        const s = dx !== 0 ? Math.sign(dx) : a.id < b.id ? 1 : -1
        const push = ox / 2 + 0.05
        a.x -= s * push
        b.x += s * push
        a.clampToTrack()
        b.clampToTrack()
        // If a rail stopped one horse, give the other the remaining separation.
        const remaining = HORSE_HALF_W * 2 - Math.abs(b.x - a.x)
        if (remaining > 0) {
          b.x += s * remaining
          a.x -= s * remaining
          a.clampToTrack()
          b.clampToTrack()
        }
        const avg = (a.vx + b.vx) / 2
        a.vx = avg - s * 35
        b.vx = avg + s * 35
        if (fresh) {
          a.speed *= BUMP.sidePenalty
          b.speed *= BUMP.sidePenalty
          a.bumpCooldown = b.bumpCooldown = BUMP.cooldown
          bumps.push({ a, b, heavy: false, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
        }
      } else {
        const rear = dy > 0 ? a : b
        const front = rear === a ? b : a
        rear.y = front.y - HORSE_HALF_L * 2
        if (fresh) {
          rear.speed = Math.min(rear.speed, front.speed) * BUMP.rearSpeedFactor
          rear.bumpTimer = BUMP.duration
          a.bumpCooldown = b.bumpCooldown = BUMP.cooldown
          bumps.push({ a: rear, b: front, heavy: true, x: (a.x + b.x) / 2, y: front.y - HORSE_HALF_L })
        } else {
          rear.speed = Math.min(rear.speed, front.speed)
        }
      }
    }
  }
  return bumps
}

// Obstacle footprint is a little shorter than the sprite so near-misses feel fair.
const FOOT_BACK = 10
const FOOT_FRONT = 12

/**
 * Updates the horse's mud state and returns the solid obstacle it just ran
 * into, if any. `obstacles` must be sorted by y0.
 */
export function checkObstacles(h: Horse, obstacles: Obstacle[]): Obstacle | null {
  h.inMud = false
  let hit: Obstacle | null = null
  for (const o of obstacles) {
    if (o.y0 > h.y + FOOT_FRONT) break
    if (o.y1 < h.y - FOOT_BACK) continue
    if (h.x + HORSE_HALF_W <= o.x0 || h.x - HORSE_HALF_W >= o.x1) continue
    if (o.kind === 'mud') {
      if (!h.airborne) h.inMud = true
    } else if (!o.knocked && h.z <= o.height && !hit) {
      hit = o
    }
  }
  return hit
}
