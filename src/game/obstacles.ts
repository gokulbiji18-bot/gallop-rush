import { FINISH_Y, PX_PER_METER, TRACK_LEFT, TRACK_RIGHT } from './constants'
import { mulberry32 } from './pixel'

/**
 * - hedge: steeplechase brush fence across the whole track; must be jumped
 * - bale:  hay bale in one lane; jump it or steer round it
 * - mud:   flat puddle that drags a grounded horse; jump or avoid it
 */
export type ObstacleKind = 'hedge' | 'bale' | 'mud'

export interface Obstacle {
  kind: ObstacleKind
  x0: number
  x1: number
  /** World y range; y0 is the near (approach) edge. */
  y0: number
  y1: number
  /** A horse clears it when its jump height exceeds this. 0 = any jump clears it. */
  height: number
  /** Bales get knocked flat when hit and stop blocking. */
  knocked: boolean
}

export const HEDGE_METERS = [250, 500, 750]

const SCATTER_FROM = 60 * PX_PER_METER
const SCATTER_TO = FINISH_Y - 50 * PX_PER_METER

export function generateObstacles(seed: number): Obstacle[] {
  const rng = mulberry32(seed)
  const list: Obstacle[] = HEDGE_METERS.map((m) => ({
    kind: 'hedge',
    x0: TRACK_LEFT,
    x1: TRACK_RIGHT,
    y0: m * PX_PER_METER,
    y1: m * PX_PER_METER + 6,
    height: 7,
    knocked: false,
  }))

  const hedgeYs = list.map((o) => o.y0)
  for (let y = SCATTER_FROM; y < SCATTER_TO; y += 380 + rng() * 200) {
    if (hedgeYs.some((h) => Math.abs(h - y) < 160)) continue
    const count = rng() < 0.35 ? 2 : 1
    const placed: Obstacle[] = []
    for (let i = 0; i < count; i++) {
      const kind: ObstacleKind = rng() < 0.6 ? 'bale' : 'mud'
      const w = kind === 'bale' ? 18 : 36 + Math.floor(rng() * 20)
      const d = kind === 'bale' ? 10 : 18 + Math.floor(rng() * 8)
      const oy = y + (i === 0 ? 0 : 50 + rng() * 60)
      // Up to a few tries to find a spot that doesn't overlap its neighbour.
      for (let attempt = 0; attempt < 6; attempt++) {
        const x0 = TRACK_LEFT + 4 + Math.floor(rng() * (TRACK_RIGHT - TRACK_LEFT - 8 - w))
        const o: Obstacle = { kind, x0, x1: x0 + w, y0: oy, y1: oy + d, height: kind === 'bale' ? 6 : 0, knocked: false }
        if (!placed.some((p) => o.x0 < p.x1 + 20 && o.x1 > p.x0 - 20 && o.y0 < p.y1 + 20 && o.y1 > p.y0 - 20)) {
          placed.push(o)
          break
        }
      }
    }
    list.push(...placed)
  }
  return list.sort((a, b) => a.y0 - b.y0)
}

/** True when an obstacle sits across a horse's line at lateral position x. */
export function inLane(o: Obstacle, x: number, margin = 7) {
  return x > o.x0 - margin && x < o.x1 + margin
}
