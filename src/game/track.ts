import {
  CAMERA_ANCHOR_Y,
  FENCE_W,
  FINISH_Y,
  PX_PER_METER,
  RACE_METERS,
  START_LINE_Y,
  TRACK_LEFT,
  TRACK_RIGHT,
  VIEW_H,
  VIEW_W,
} from './constants'
import { drawText, textWidth } from './font'
import type { Obstacle } from './obstacles'
import { OUTLINE, PixelLayer, darken, hash2, lighten, mulberry32 } from './pixel'

const TRACK_W = TRACK_RIGHT - TRACK_LEFT
const DIRT_TILE_H = 128
const GRASS_TILE_W = 48
const GRASS_TILE_H = 64
const SLOT = 34
const POST_GAP = 16

export const toScreenY = (worldY: number, camY: number) => Math.round(CAMERA_ANCHOR_Y - (worldY - camY))

interface TrackArt {
  dirt: HTMLCanvasElement
  grass: HTMLCanvasElement
  trees: HTMLCanvasElement[]
  bush: HTMLCanvasElement
}

let art: TrackArt | null = null

function getArt(): TrackArt {
  if (art) return art
  art = { dirt: makeDirt(), grass: makeGrass(), trees: [makeTree(0), makeTree(1), makeTree(2)], bush: makeBush() }
  return art
}

function makeDirt(): HTMLCanvasElement {
  const rng = mulberry32(7)
  const l = new PixelLayer(TRACK_W, DIRT_TILE_H)
  l.rect(0, 0, TRACK_W - 1, DIRT_TILE_H - 1, '#c38d55')
  for (let y = 0; y < DIRT_TILE_H; y++) {
    for (let x = 0; x < TRACK_W; x++) {
      const r = rng()
      if (r < 0.07) l.set(x, y, '#b07a45')
      else if (r < 0.1) l.set(x, y, '#d6a56d')
      else if (r < 0.104) l.set(x, y, '#8d5d34')
    }
  }
  // Hoof-churned furrows running with the race.
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rng() * TRACK_W)
    const y0 = Math.floor(rng() * DIRT_TILE_H)
    const len = 6 + Math.floor(rng() * 22)
    for (let k = 0; k < len; k++) l.set(x, (y0 + k) % DIRT_TILE_H, '#b27e49')
  }
  for (let y = 0; y < DIRT_TILE_H; y++) {
    l.set(0, y, '#8f5f33')
    l.set(1, y, '#a26f3f')
    l.set(TRACK_W - 1, y, '#8f5f33')
    l.set(TRACK_W - 2, y, '#a26f3f')
  }
  return l.toCanvas()
}

function makeGrass(): HTMLCanvasElement {
  const rng = mulberry32(21)
  const l = new PixelLayer(GRASS_TILE_W, GRASS_TILE_H)
  // Two mown bands per tile: the stripes sliding past sell the speed.
  l.rect(0, 0, GRASS_TILE_W - 1, GRASS_TILE_H / 2 - 1, '#4fa83d')
  l.rect(0, GRASS_TILE_H / 2, GRASS_TILE_W - 1, GRASS_TILE_H - 1, '#58b345')
  for (let y = 0; y < GRASS_TILE_H; y++) {
    for (let x = 0; x < GRASS_TILE_W; x++) {
      const r = rng()
      if (r < 0.08) l.set(x, y, '#46993a')
      else if (r < 0.12) l.set(x, y, '#68c552')
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rng() * (GRASS_TILE_W - 3))
    const y = Math.floor(rng() * (GRASS_TILE_H - 2))
    l.set(x, y, '#3a8a30')
    l.set(x + 2, y, '#3a8a30')
    l.set(x + 1, y + 1, '#3a8a30')
  }
  return l.toCanvas()
}

function makeTree(variant: number): HTMLCanvasElement {
  const leaf = ['#2f8a3a', '#3a7d2c', '#2c7a4a'][variant]
  const l = new PixelLayer(24, 26)
  const shadow = new PixelLayer(24, 26)
  shadow.ellipse(13, 21, 9, 4, 'rgba(10, 30, 5, 0.35)')
  l.rect(10, 16, 12, 22, '#6b4423')
  l.rect(12, 16, 12, 22, '#4f301a')
  l.ellipse(11.5, 10, 9.5, 8.5, leaf)
  l.ellipse(6.5, 13, 4.5, 4, leaf)
  l.ellipse(16.5, 13, 4.5, 4, leaf)
  l.rimShade(leaf, lighten(leaf, 0.25), darken(leaf, 0.3), 'top')
  const rng = mulberry32(99 + variant)
  for (let i = 0; i < 10; i++) {
    const x = 5 + Math.floor(rng() * 13)
    const y = 4 + Math.floor(rng() * 10)
    if (l.get(x, y) === leaf) l.set(x, y, lighten(leaf, 0.18))
  }
  l.outline()
  return shadow.stamp(l).toCanvas()
}

function makeBush(): HTMLCanvasElement {
  const l = new PixelLayer(14, 10)
  l.ellipse(7, 5, 6, 4, '#3f9a3a')
  l.rimShade('#3f9a3a', '#5cbf4e', '#2c7a2c', 'top')
  l.set(4, 3, '#e8d84a')
  l.set(9, 4, '#e86a8a')
  l.outline()
  return l.toCanvas()
}

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c', '#ff6fa8']
const HAIR = ['#2b1a10', '#5a3a1a', '#d9b25a', '#1a1a1a', '#8a3a1a']
const SKIN = ['#f2c9a0', '#d9a074', '#a86b43', '#7a4a2a']

function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number, t: number) {
  const shirt = SHIRTS[Math.floor(hash2(seed, 1) * SHIRTS.length)]
  const hair = HAIR[Math.floor(hash2(seed, 2) * HAIR.length)]
  const skin = SKIN[Math.floor(hash2(seed, 3) * SKIN.length)]
  const cheering = Math.floor(t * 4 + hash2(seed, 4) * 4) % 2 === 0
  const hop = cheering && hash2(seed, 5) > 0.6 ? -1 : 0
  ctx.fillStyle = OUTLINE
  ctx.fillRect(x - 1, y - 1 + hop, 5, 9)
  ctx.fillStyle = hair
  ctx.fillRect(x, y + hop, 3, 1)
  ctx.fillStyle = skin
  ctx.fillRect(x, y + 1 + hop, 3, 2)
  ctx.fillStyle = shirt
  ctx.fillRect(x, y + 3 + hop, 3, 3)
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(x, y + 6 + hop, 1, 1)
  ctx.fillRect(x + 2, y + 6 + hop, 1, 1)
  if (cheering) {
    ctx.fillStyle = skin
    ctx.fillRect(x - 1, y + hop, 1, 2)
    ctx.fillRect(x + 3, y + hop, 1, 2)
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, t: number, seed: number) {
  ctx.fillStyle = 'rgba(10, 30, 5, 0.3)'
  ctx.fillRect(x + 1, y + 14, 3, 1)
  ctx.fillStyle = '#d8d8d8'
  ctx.fillRect(x, y, 1, 15)
  const wave = Math.floor(t * 6 + seed * 10) % 2
  ctx.fillStyle = OUTLINE
  ctx.fillRect(x + 1, y - 1, 8, 6)
  ctx.fillStyle = color
  ctx.fillRect(x + 1, y, 7, 4)
  ctx.fillStyle = darken(color, 0.25)
  if (wave) ctx.fillRect(x + 3, y + 1, 2, 3)
  else ctx.fillRect(x + 5, y, 2, 3)
}

function drawSign(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, bg: string, fg: string) {
  const w = textWidth(text) + 6
  const x = Math.round(cx - w / 2)
  ctx.fillStyle = '#6b4423'
  ctx.fillRect(x + 2, y + 8, 1, 4)
  ctx.fillRect(x + w - 3, y + 8, 1, 4)
  ctx.fillStyle = OUTLINE
  ctx.fillRect(x - 1, y - 1, w + 2, 11)
  ctx.fillStyle = bg
  ctx.fillRect(x, y, w, 9)
  drawText(ctx, text, x + 3, y + 2, fg)
}

/** Draws grass, fences, scenery, dirt and the start / finish lines (ground layer). */
export function drawTrack(ctx: CanvasRenderingContext2D, camY: number, t: number) {
  const a = getArt()
  const topWorld = camY + CAMERA_ANCHOR_Y
  const bottomWorld = topWorld - VIEW_H

  // Grass both sides.
  for (let k = Math.floor(bottomWorld / GRASS_TILE_H); k <= Math.floor(topWorld / GRASS_TILE_H); k++) {
    const sy = toScreenY((k + 1) * GRASS_TILE_H, camY)
    for (let x = 0; x < VIEW_W; x += GRASS_TILE_W) ctx.drawImage(a.grass, x, sy)
  }

  // Dirt.
  for (let k = Math.floor(bottomWorld / DIRT_TILE_H); k <= Math.floor(topWorld / DIRT_TILE_H); k++) {
    ctx.drawImage(a.dirt, TRACK_LEFT, toScreenY((k + 1) * DIRT_TILE_H, camY))
  }

  drawStartLine(ctx, camY)
  drawFinishLine(ctx, camY)
  drawFences(ctx, camY, bottomWorld, topWorld)
  drawScenery(ctx, camY, bottomWorld, topWorld, t, a)
}

function drawStartLine(ctx: CanvasRenderingContext2D, camY: number) {
  const sy = toScreenY(START_LINE_Y, camY)
  if (sy < -40 || sy > VIEW_H + 10) return
  ctx.fillStyle = '#f4efe6'
  ctx.fillRect(TRACK_LEFT, sy - 1, TRACK_W, 2)
  ctx.globalAlpha = 0.8
  const w = textWidth('START', 2)
  drawText(ctx, 'START', TRACK_LEFT + (TRACK_W - w) / 2, sy - 30, '#f4efe6', 2)
  ctx.globalAlpha = 1
}

function drawFinishLine(ctx: CanvasRenderingContext2D, camY: number) {
  const sy = toScreenY(FINISH_Y, camY)
  if (sy < -10 || sy > VIEW_H + 10) return
  for (let row = 0; row < 2; row++) {
    for (let x = 0; x < TRACK_W; x += 4) {
      ctx.fillStyle = ((x / 4 + row) % 2 === 0) ? '#f4efe6' : '#1c1222'
      ctx.fillRect(TRACK_LEFT + x, sy - 4 + row * 4, 4, 4)
    }
  }
}

function drawFences(ctx: CanvasRenderingContext2D, camY: number, bottomWorld: number, topWorld: number) {
  const lx = TRACK_LEFT - FENCE_W
  const rx = TRACK_RIGHT
  for (const x of [lx, rx]) {
    ctx.fillStyle = '#8a5a2b'
    ctx.fillRect(x + 1, 0, 1, VIEW_H)
    ctx.fillRect(x + 4, 0, 1, VIEW_H)
    ctx.fillStyle = '#d79a58'
    ctx.fillRect(x, 0, 1, VIEW_H)
    ctx.fillRect(x + 3, 0, 1, VIEW_H)
  }
  for (let k = Math.floor(bottomWorld / POST_GAP) - 1; k <= Math.ceil(topWorld / POST_GAP); k++) {
    const sy = toScreenY(k * POST_GAP, camY)
    for (const x of [lx, rx]) {
      ctx.fillStyle = OUTLINE
      ctx.fillRect(x - 1, sy - 1, FENCE_W + 1, 8)
      ctx.fillStyle = '#9c6330'
      ctx.fillRect(x, sy, FENCE_W - 1, 6)
      ctx.fillStyle = '#e0a868'
      ctx.fillRect(x, sy, FENCE_W - 1, 2)
    }
  }
}

function drawScenery(
  ctx: CanvasRenderingContext2D,
  camY: number,
  bottomWorld: number,
  topWorld: number,
  t: number,
  a: TrackArt,
) {
  const leftEdge = TRACK_LEFT - FENCE_W - 2
  const rightStart = TRACK_RIGHT + FENCE_W + 2
  const standFrom = FINISH_Y - 260
  const standTo = FINISH_Y + 220

  // Iterate from the top of the screen down so nearer objects overlap farther ones.
  for (let k = Math.ceil((topWorld + 30) / SLOT); k >= Math.floor((bottomWorld - 30) / SLOT); k--) {
    const wy = k * SLOT
    const sy = toScreenY(wy, camY)
    for (const side of [0, 1]) {
      const inStand = side === 1 && wy > standFrom && wy < standTo
      if (inStand) {
        drawStandRow(ctx, rightStart, sy, k, t)
        continue
      }
      if (side === 0 && nearDistanceMarker(wy)) continue
      const r = hash2(k, side + 11)
      const x0 = side === 0 ? 0 : rightStart
      const width = side === 0 ? leftEdge : VIEW_W - rightStart
      const jx = Math.floor(hash2(k, side + 31) * Math.max(1, width - 22))
      const jy = Math.floor(hash2(k, side + 41) * 10)
      if (r < 0.3) {
        ctx.drawImage(a.trees[Math.floor(hash2(k, side + 51) * 3)], x0 + jx - 2, sy - 24 + jy)
      } else if (r < 0.52) {
        const n = 2 + Math.floor(hash2(k, side + 61) * 3)
        for (let i = 0; i < n; i++) {
          const px = x0 + 4 + Math.floor(hash2(k * 7 + i, side) * (width - 10))
          const py = sy - 10 + Math.floor(hash2(k * 13 + i, side + 3) * 12)
          drawPerson(ctx, px, py, k * 31 + i * 7 + side, t)
        }
      } else if (r < 0.62) {
        drawFlag(ctx, x0 + 6 + jx / 2, sy - 16 + jy, SHIRTS[Math.floor(hash2(k, side + 71) * SHIRTS.length)], t, r)
      } else if (r < 0.74) {
        ctx.drawImage(a.bush, x0 + jx, sy - 8 + jy)
      } else if (r < 0.8) {
        const labels = ['GO!', 'RUSH', 'WIN', 'RUN']
        const label = labels[Math.floor(hash2(k, side + 81) * labels.length)]
        const bg = ['#d8323c', '#2f6fe0', '#f5c542'][Math.floor(hash2(k, side + 91) * 3)]
        drawSign(ctx, x0 + width / 2, sy - 12, label, bg, bg === '#f5c542' ? OUTLINE : '#f4efe6')
      }
    }
  }

  // Distance-to-go markers every 100 m on the inside rail.
  for (let m = 100; m < RACE_METERS; m += 100) {
    const wy = FINISH_Y - m * PX_PER_METER
    if (wy < bottomWorld - 20 || wy > topWorld + 20) continue
    const sy = toScreenY(wy, camY)
    drawSign(ctx, leftEdge / 2 + 2, sy - 12, `${m}M`, '#f4efe6', '#d8323c')
  }
}

function nearDistanceMarker(wy: number) {
  const gap = 100 * PX_PER_METER
  const d = (((FINISH_Y - wy) % gap) + gap) % gap
  return d < SLOT || gap - d < SLOT
}

function drawStandRow(ctx: CanvasRenderingContext2D, x0: number, sy: number, k: number, t: number) {
  // Tiered grandstand: concrete steps with a packed crowd.
  ctx.fillStyle = '#7d8590'
  ctx.fillRect(x0 - 2, sy - SLOT, VIEW_W - x0 + 2, SLOT)
  ctx.fillStyle = '#9aa2ad'
  for (let r = 0; r < SLOT; r += 9) ctx.fillRect(x0 - 2, sy - SLOT + r, VIEW_W - x0 + 2, 2)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 7; c++) {
      const px = x0 + 1 + c * 5 + (r % 2) * 2
      const py = sy - SLOT + 1 + r * 9
      if (px + 3 < VIEW_W) drawPerson(ctx, px, py, k * 101 + r * 11 + c, t)
    }
  }
}

/** Overhead finish banner, drawn after the horses so they run underneath it. */
export function drawFinishBanner(ctx: CanvasRenderingContext2D, camY: number) {
  const sy = toScreenY(FINISH_Y, camY)
  if (sy < -10 || sy > VIEW_H + 60) return
  const top = sy - 40
  const lx = TRACK_LEFT - 5
  const rx = TRACK_RIGHT + 1
  for (const x of [lx, rx]) {
    ctx.fillStyle = OUTLINE
    ctx.fillRect(x - 1, top - 1, 6, sy - top + 2)
    for (let y = top; y < sy; y += 4) {
      ctx.fillStyle = Math.floor((y - top) / 4) % 2 === 0 ? '#f4efe6' : '#d8323c'
      ctx.fillRect(x, y, 4, Math.min(4, sy - y))
    }
  }
  const bx = lx + 4
  const bw = rx - bx
  ctx.fillStyle = OUTLINE
  ctx.fillRect(bx, top - 1, bw, 16)
  ctx.fillStyle = '#d8323c'
  ctx.fillRect(bx, top, bw, 14)
  ctx.fillStyle = '#f4efe6'
  ctx.fillRect(bx, top + 1, bw, 1)
  ctx.fillRect(bx, top + 12, bw, 1)
  const tw = textWidth('FINISH', 2)
  drawText(ctx, 'FINISH', bx + (bw - tw) / 2, top + 2, '#f4efe6', 2)
  ctx.fillStyle = 'rgba(30, 14, 0, 0.25)'
  ctx.fillRect(bx + 4, sy + 6, bw - 4, 3)
}

// ---------------------------------------------------------------------------
// Obstacles. Hedges and bales have height, so they are depth-sorted with the
// horses; mud is flat and drawn with the ground.

const HEDGE_DEPTH = 6
const HEDGE_H = 7
const BALE_W = 18
const BALE_D = 10
const BALE_H = 6

let obstacleArt: { hedge: HTMLCanvasElement; bale: HTMLCanvasElement; knocked: HTMLCanvasElement } | null = null
const mudCache = new Map<string, HTMLCanvasElement>()

function getObstacleArt() {
  if (obstacleArt) return obstacleArt
  obstacleArt = { hedge: makeHedge(), bale: makeBale(), knocked: makeKnockedBale() }
  return obstacleArt
}

function makeHedge(): HTMLCanvasElement {
  const rng = mulberry32(31)
  const h = HEDGE_DEPTH + HEDGE_H
  const l = new PixelLayer(TRACK_W, h + 3)
  const top = 2
  l.rect(0, top, TRACK_W - 1, top + HEDGE_DEPTH - 1, '#4c9a3c')
  l.rect(0, top + HEDGE_DEPTH, TRACK_W - 1, top + h - 1, '#2f6b2a')
  for (let x = 0; x < TRACK_W; x++) {
    // Ragged brush along the top edge.
    if (rng() < 0.45) l.set(x, top - 1, '#4c9a3c')
    if (rng() < 0.15) l.set(x, top - 2, '#5cae47')
    for (let y = top; y < top + HEDGE_DEPTH; y++) {
      const r = rng()
      if (r < 0.18) l.set(x, y, '#6cbf4e')
      else if (r < 0.3) l.set(x, y, '#3d8a33')
    }
    for (let y = top + HEDGE_DEPTH; y < top + h - 2; y++) {
      if (rng() < 0.2) l.set(x, y, '#255a22')
      else if (rng() < 0.08) l.set(x, y, '#3f8a35')
    }
  }
  // White take-off board along the foot of the fence.
  l.rect(0, top + h - 2, TRACK_W - 1, top + h - 1, '#f4efe6')
  for (let x = 0; x < TRACK_W; x += 12) l.rect(x, top + h - 2, x + 5, top + h - 1, '#ff9f1c')
  l.outline()
  return l.toCanvas()
}

function makeBale(): HTMLCanvasElement {
  const l = new PixelLayer(BALE_W + 2, BALE_D + BALE_H + 2)
  const straw = '#e8c45a'
  const strawDark = '#c9a03e'
  l.rect(1, 1, BALE_W, BALE_D, straw)
  l.rect(1, BALE_D + 1, BALE_W, BALE_D + BALE_H, strawDark)
  const rng = mulberry32(17)
  for (let y = 1; y <= BALE_D + BALE_H; y++) {
    for (let x = 1; x <= BALE_W; x++) {
      if (rng() < 0.18) l.set(x, y, y <= BALE_D ? '#f3d77a' : '#b38a32')
    }
  }
  for (const x of [5, 13]) l.rect(x, 1, x, BALE_D + BALE_H, '#8a5a2b')
  l.outline()
  return l.toCanvas()
}

function makeKnockedBale(): HTMLCanvasElement {
  const l = new PixelLayer(26, 16)
  const rng = mulberry32(23)
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(rng() * 24)
    const y = Math.floor(rng() * 14)
    l.rect(x, y, x + 1, y, rng() < 0.5 ? '#e8c45a' : '#c9a03e')
  }
  return l.toCanvas()
}

function getMud(w: number, d: number): HTMLCanvasElement {
  const key = `${w}x${d}`
  let c = mudCache.get(key)
  if (!c) {
    const l = new PixelLayer(w, d)
    l.ellipse(w / 2, d / 2, w / 2, d / 2, '#6b4423')
    l.ellipse(w / 2 + 1, d / 2, w / 2 - 4, d / 2 - 3, '#5a3a1e')
    l.rimShade('#6b4423', '#7f5530', null, 'top')
    const rng = mulberry32(w * 31 + d)
    for (let i = 0; i < w / 3; i++) {
      const x = Math.floor(rng() * w)
      const y = Math.floor(rng() * d)
      if (l.get(x, y) === '#5a3a1e') l.rect(x, y, x + 1, y, '#9c7a55')
    }
    c = l.toCanvas()
    mudCache.set(key, c)
  }
  return c
}

/** Flat obstacles plus the "jump ahead" chevrons painted before each hedge. */
export function drawGroundObstacles(ctx: CanvasRenderingContext2D, obstacles: Obstacle[], camY: number) {
  const topWorld = camY + CAMERA_ANCHOR_Y + 40
  const bottomWorld = topWorld - VIEW_H - 120
  for (const o of obstacles) {
    if (o.y1 < bottomWorld || o.y0 > topWorld) continue
    if (o.kind === 'mud') {
      ctx.drawImage(getMud(o.x1 - o.x0, o.y1 - o.y0), Math.round(o.x0), toScreenY(o.y1, camY))
    } else if (o.kind === 'hedge') {
      ctx.fillStyle = 'rgba(244, 239, 230, 0.75)'
      for (const back of [36, 60]) {
        const sy = toScreenY(o.y0 - back, camY)
        for (const cx of [TRACK_LEFT + 30, (TRACK_LEFT + TRACK_RIGHT) / 2, TRACK_RIGHT - 30]) {
          ctx.fillRect(cx - 1, sy, 3, 1)
          ctx.fillRect(cx - 2, sy + 1, 2, 1)
          ctx.fillRect(cx + 1, sy + 1, 2, 1)
          ctx.fillRect(cx - 3, sy + 2, 1, 1)
          ctx.fillRect(cx + 3, sy + 2, 1, 1)
        }
      }
      drawSign(ctx, (TRACK_RIGHT + FENCE_W + 2 + VIEW_W) / 2, toScreenY(o.y0, camY) - 14, 'JUMP!', '#d8323c', '#f4efe6')
    } else if (o.knocked) {
      ctx.drawImage(getObstacleArt().knocked, Math.round(o.x0) - 4, toScreenY(o.y1, camY))
    }
  }
}

/** Screen-space sort key: the obstacle's near edge. */
export function obstacleSortY(o: Obstacle, camY: number) {
  return toScreenY(o.y0, camY)
}

export function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, camY: number) {
  const art = getObstacleArt()
  const near = toScreenY(o.y0, camY)
  if (o.kind === 'hedge') {
    ctx.fillStyle = 'rgba(30, 14, 0, 0.3)'
    ctx.fillRect(TRACK_LEFT, near + 1, TRACK_W, 3)
    ctx.drawImage(art.hedge, TRACK_LEFT, near - HEDGE_DEPTH - HEDGE_H - 2)
  } else if (o.kind === 'bale' && !o.knocked) {
    ctx.fillStyle = 'rgba(30, 14, 0, 0.3)'
    ctx.fillRect(Math.round(o.x0) + 2, near + 1, BALE_W, 3)
    ctx.drawImage(art.bale, Math.round(o.x0) - 1, near - BALE_D - BALE_H - 1)
  }
}
