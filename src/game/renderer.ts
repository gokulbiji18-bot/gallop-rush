import { PX_PER_METER, VIEW_H, VIEW_W } from './constants'
import { drawText, textWidth } from './font'
import type { Horse } from './horse'
import { OUTLINE } from './pixel'
import type { Race } from './race'
import { type HorseSprites, SPRITE_CY, SPRITE_W, buildHorseSprites } from './sprites'
import { drawFinishBanner, drawGroundObstacles, drawObstacle, drawTrack, obstacleSortY, toScreenY } from './track'

const STAND_TAIL = [0, 1, 0, 2]
const PLAYER_MARK = '#ffd43b'
const INDICATOR_BOTTOM_Y = VIEW_H - 54
const INDICATOR_SPACING = 24

/** Draws a Race snapshot. Holds no game state besides baked sprites. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D
  private readonly sprites = new Map<string, HorseSprites>()

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W
    canvas.height = VIEW_H
    this.ctx = canvas.getContext('2d')!
  }

  private spritesFor(h: Horse): HorseSprites {
    let s = this.sprites.get(h.look.name)
    if (!s) {
      s = buildHorseSprites(h.look)
      this.sprites.set(h.look.name, s)
    }
    return s
  }

  render(race: Race) {
    const ctx = this.ctx
    const camY = race.camY
    const t = race.clock
    ctx.imageSmoothingEnabled = false

    drawTrack(ctx, camY, t)
    drawGroundObstacles(ctx, race.obstacles, camY)

    for (const p of race.particles.list) {
      const k = 1 - p.life / p.max
      const size = Math.round(p.size0 + (p.size1 - p.size0) * k)
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 0.9)
      ctx.fillStyle = p.color
      ctx.fillRect(Math.round(p.x - size / 2), toScreenY(p.y, camY) - Math.round(size / 2), size, size)
    }
    ctx.globalAlpha = 1

    const horses = race.horses
      .map((h) => ({ h, sy: toScreenY(h.y, camY) }))
      .filter(({ sy }) => sy > -SPRITE_CY - 20 && sy < VIEW_H + SPRITE_CY + 4)

    // Shadows stay on the ground and fade as the horse rises.
    for (const { h, sy } of horses) {
      const s = this.spritesFor(h)
      ctx.globalAlpha = 1 - h.z / 28
      ctx.drawImage(s.shadow, Math.round(h.x - SPRITE_W / 2) + 2 + Math.round(h.z / 4), sy - SPRITE_CY + 1)
      ctx.globalAlpha = 1
      if (h.isPlayer) this.drawPlayerMarker(Math.round(h.x), sy + 18, t)
    }

    // Nearer the camera (lower on screen) draws last; a horse in the air
    // always draws over the fence it is clearing.
    type Drawable = { key: number; draw: () => void }
    const drawables: Drawable[] = horses.map(({ h, sy }) => ({
      key: sy + (h.airborne ? 30 : 0),
      draw: () => this.drawHorse(h, sy, t),
    }))
    for (const o of race.obstacles) {
      if (o.kind === 'mud' || o.knocked) continue
      const key = obstacleSortY(o, camY)
      if (key < -30 || key > VIEW_H + 30) continue
      drawables.push({ key, draw: () => drawObstacle(ctx, o, camY) })
    }
    drawables.sort((a, b) => a.key - b.key)
    for (const d of drawables) d.draw()

    drawFinishBanner(ctx, camY)

    if (race.phase === 'grid' || race.phase === 'countdown') {
      const p = race.player
      this.drawTag(Math.round(p.x), toScreenY(p.y, camY) - SPRITE_CY - 10, 'YOU', PLAYER_MARK, OUTLINE)
    }

    this.drawOffscreenIndicators(race)
  }

  private drawHorse(h: Horse, sy: number, t: number) {
    const s = this.spritesFor(h)
    let img: HTMLCanvasElement
    if (h.airborne) img = s.gallop[h.jumpProgress < 0.5 ? 3 : 1]
    else if (h.speed < 4) img = s.stand[STAND_TAIL[Math.floor(t * 1.5 + h.id * 1.3) % 4]]
    else img = s.gallop[h.frame]
    const shaken = h.bumpTimer > 0 || h.stumbleTimer > 0
    const jitter = shaken ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0
    const x = Math.round(h.x - SPRITE_W / 2) + jitter
    const y = sy - SPRITE_CY - Math.round(h.z)
    if (h.sprinting) this.drawSpeedLines(h, sy, t)
    this.ctx.drawImage(img, x, y)
    if (h.stumbleTimer > 0) this.drawDizzy(Math.round(h.x), y - 3, t)
  }

  /** Little orbiting stars over a horse that has just clipped an obstacle. */
  private drawDizzy(cx: number, y: number, t: number) {
    const ctx = this.ctx
    for (let i = 0; i < 3; i++) {
      const a = t * 8 + (i * Math.PI * 2) / 3
      const px = Math.round(cx + Math.cos(a) * 7)
      const py = Math.round(y + Math.sin(a) * 2)
      ctx.fillStyle = OUTLINE
      ctx.fillRect(px - 1, py - 1, 3, 3)
      ctx.fillStyle = '#ffd43b'
      ctx.fillRect(px, py, 1, 1)
    }
  }

  private drawPlayerMarker(x: number, y: number, t: number) {
    const ctx = this.ctx
    const lift = Math.floor(t * 3) % 2
    ctx.fillStyle = OUTLINE
    ctx.fillRect(x - 4, y + lift - 1, 9, 5)
    ctx.fillStyle = PLAYER_MARK
    ctx.fillRect(x, y + lift, 1, 1)
    ctx.fillRect(x - 1, y + lift + 1, 3, 1)
    ctx.fillRect(x - 3, y + lift + 2, 7, 1)
  }

  private drawSpeedLines(h: Horse, sy: number, t: number) {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(255, 248, 232, 0.55)'
    for (let i = 0; i < 3; i++) {
      const phase = (t * 9 + i * 0.37 + h.id) % 1
      const len = 5 + i * 2
      const side = i % 2 === 0 ? -11 : 10
      ctx.fillRect(Math.round(h.x + side), Math.round(sy + 4 + phase * 18), 1, len)
    }
  }

  private drawTag(cx: number, y: number, text: string, bg: string, fg: string) {
    const ctx = this.ctx
    const w = textWidth(text) + 4
    const x = cx - Math.floor(w / 2)
    ctx.fillStyle = OUTLINE
    ctx.fillRect(x - 1, y - 1, w + 2, 9)
    ctx.fillStyle = bg
    ctx.fillRect(x, y, w, 7)
    ctx.fillRect(cx - 1, y + 7, 3, 1)
    ctx.fillRect(cx, y + 8, 1, 1)
    drawText(ctx, text, x + 2, y + 1, fg)
  }

  private drawOffscreenIndicators(race: Race) {
    const p = race.player
    const above: { cx: number; h: Horse }[] = []
    const below: { cx: number; h: Horse }[] = []
    for (const h of race.horses) {
      if (h === p || h.finished) continue
      const sy = toScreenY(h.y, race.camY)
      if (sy + SPRITE_CY < 2) above.push({ cx: h.x, h })
      else if (sy - SPRITE_CY > INDICATOR_BOTTOM_Y) below.push({ cx: h.x, h })
    }
    // Top arrows stay between the corner HUD boxes; bottom arrows sit above the stamina bar.
    for (const [list, y, up, min, max] of [
      [above, 2, true, 74, VIEW_W - 74],
      [below, INDICATOR_BOTTOM_Y, false, 16, VIEW_W - 16],
    ] as const) {
      list.sort((a, b) => a.cx - b.cx)
      for (let i = 0; i < list.length; i++) {
        list[i].cx = Math.max(min, Math.min(max, list[i].cx))
        if (i > 0) list[i].cx = Math.max(list[i].cx, list[i - 1].cx + INDICATOR_SPACING)
      }
      // If spreading pushed past the right limit, shift the whole group back left.
      const overflow = list.length ? list[list.length - 1].cx - max : 0
      for (const item of list) {
        const meters = Math.round(Math.abs(item.h.y - p.y) / PX_PER_METER)
        this.drawArrow(Math.round(item.cx - Math.max(0, overflow)), y, up, item.h.look.silk, `${meters}M`)
      }
    }
  }

  private drawArrow(cx: number, y: number, up: boolean, color: string, label: string) {
    const ctx = this.ctx
    const w = Math.max(textWidth(label) + 4, 11)
    const x = cx - Math.floor(w / 2)
    ctx.fillStyle = OUTLINE
    ctx.fillRect(x - 1, y - 1, w + 2, 14)
    ctx.fillStyle = color
    const ay = up ? y : y + 8
    for (let i = 0; i < 3; i++) {
      const row = up ? ay + i : ay + 2 - i
      ctx.fillRect(cx - i, row, i * 2 + 1, 1)
    }
    ctx.fillStyle = '#241a33'
    ctx.fillRect(x, up ? y + 4 : y, w, 8)
    drawText(ctx, label, x + 2, (up ? y + 4 : y) + 2, '#f4efe6')
  }
}
