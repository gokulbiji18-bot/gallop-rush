import { OUTLINE, PixelLayer, darken, lighten } from './pixel'
import type { HorseLook } from './types'

// Racing sprites: the horse is seen from slightly above and behind, facing up
// the screen, so the jockey's back, helmet and the horse's rump stay readable.
export const SPRITE_W = 24
export const SPRITE_H = 38
/** Sprite row that lines up with Horse.y. */
export const SPRITE_CY = 19

const CX = 12
const Y = 1

type LegState = 'ext' | 'mid' | 'tuck'

interface Pose {
  hindL: LegState
  hindR: LegState
  reachL: boolean
  reachR: boolean
  tail: number
  /** Vertical bob for body, head and rider. */
  bb: number
  hb: number
  jb: number
}

const GALLOP: Pose[] = [
  { hindL: 'ext', hindR: 'tuck', reachL: false, reachR: true, tail: -1, bb: 0, hb: 0, jb: 0 },
  { hindL: 'tuck', hindR: 'tuck', reachL: false, reachR: false, tail: 0, bb: -1, hb: -1, jb: 1 },
  { hindL: 'tuck', hindR: 'ext', reachL: true, reachR: false, tail: 1, bb: 0, hb: 0, jb: 0 },
  { hindL: 'mid', hindR: 'mid', reachL: true, reachR: true, tail: 0, bb: 0, hb: 1, jb: 0 },
]

const stand = (tail: number): Pose => ({
  hindL: 'ext', hindR: 'ext', reachL: false, reachR: false, tail, bb: 0, hb: 0, jb: 0,
})

export interface HorseSprites {
  gallop: HTMLCanvasElement[]
  stand: HTMLCanvasElement[]
  shadow: HTMLCanvasElement
}

export function buildHorseSprites(look: HorseLook): HorseSprites {
  const shadow = new PixelLayer(SPRITE_W, SPRITE_H)
  shadow.ellipse(CX + 1.5, 24, 8.5, 12.5, 'rgba(30, 14, 0, 0.3)')
  return {
    gallop: GALLOP.map((p) => drawHorse(look, p).toCanvas()),
    stand: [stand(0), stand(-1), stand(1)].map((p) => drawHorse(look, p).toCanvas()),
    shadow: shadow.toCanvas(),
  }
}

function drawHorse(look: HorseLook, pose: Pose): PixelLayer {
  const coat = look.coat
  const light = lighten(coat, 0.25)
  const dark = darken(coat, 0.3)
  const mane = look.mane
  const hoof = '#2a2228'
  const sole = '#9a8f80'
  const sock = look.socks ? '#efe9dc' : dark
  const by = Y + pose.bb
  const hy = Y + pose.hb

  // Legs: hind legs swing below the rump, front legs flick out beside the shoulders.
  const legs = new PixelLayer(SPRITE_W, SPRITE_H)
  const hind = (x: number, s: LegState) => {
    const bottom = (s === 'ext' ? 33 : s === 'mid' ? 31 : 29) + Y
    legs.rect(x, 25 + by, x + 1, bottom - 1, dark)
    legs.rect(x, bottom - 2, x + 1, bottom - 1, sock)
    legs.rect(x, bottom, x + 1, bottom, s === 'tuck' ? sole : hoof)
  }
  const front = (x: number) => {
    legs.rect(x, 11 + by, x + 1, 16 + by, coat)
    legs.rect(x, 10 + by, x + 1, 11 + by, sock)
    legs.rect(x, 9 + by, x + 1, 9 + by, hoof)
  }
  hind(7, pose.hindL)
  hind(15, pose.hindR)
  if (pose.reachL) front(5)
  if (pose.reachR) front(17)
  legs.outline()

  // Head, neck, barrel and rump.
  const body = new PixelLayer(SPRITE_W, SPRITE_H)
  ;[2, 2, 3, 3, 3, 3].forEach((hw, i) => body.span(1 + i + hy, CX, hw, coat))
  body.rect(7, 4 + hy, 8, 5 + hy, coat)
  body.set(8, 3 + hy, coat)
  body.rect(15, 4 + hy, 16, 5 + hy, coat)
  body.set(15, 3 + hy, coat)
  // Neck drawn at both head and body offsets so bobbing never opens a gap.
  ;[3, 3, 4, 4, 4].forEach((hw, i) => {
    body.span(7 + i + hy, CX, hw, coat)
    body.span(7 + i + by, CX, hw, coat)
  })
  ;[5, 5, 6, 6, 6, 6, 6, 6, 6].forEach((hw, i) => body.span(12 + i + by, CX, hw, coat))
  ;[6, 7, 7, 7, 7, 6, 5, 3].forEach((hw, i) => body.span(21 + i + by, CX, hw, coat))
  body.rimShade(coat, light, dark, 'topdown')
  body.rect(7, 22 + by, 9, 23 + by, light)
  body.set(8, 24 + by, light)
  body.rect(14, 22 + by, 15, 22 + by, light)
  body.rect(11, 25 + by, 12, 28 + by, dark)
  body.set(8, 4 + hy, dark)
  body.set(15, 4 + hy, dark)
  body.rect(11, 4 + hy, 12, 9 + hy, mane)
  body.rect(11, 9 + by, 12, 11 + by, mane)
  body.outline()

  // Tail streams behind and swishes with the stride.
  const tail = new PixelLayer(SPRITE_W, SPRITE_H)
  const tailLight = lighten(mane, 0.3)
  for (let y = 24; y <= 34; y++) {
    const off = Math.round(pose.tail * (Math.max(0, y - 26) / 8) * 2)
    const w = y < 27 ? 2 : y < 32 ? 3 : 2
    const x0 = (w === 3 && pose.tail < 0 ? 10 : 11) + off
    tail.rect(x0, y + by, x0 + w - 1, y + by, mane)
    if (y % 3 === 0) tail.set(x0 + 1, y + by, tailLight)
  }
  tail.outline()

  // Saddle cloth on both flanks.
  const cloth = new PixelLayer(SPRITE_W, SPRITE_H)
  for (const x0 of [6, 15]) {
    cloth.rect(x0, 15 + by, x0 + 2, 19 + by, look.cloth)
    cloth.rect(x0, 20 + by, x0 + 2, 20 + by, '#f4efe6')
  }

  // Jockey crouched forward over the withers.
  const j = new PixelLayer(SPRITE_W, SPRITE_H)
  const o = by + pose.jb
  const pants = '#ece8f2'
  const boot = '#1e1a22'
  const skin = '#f2b98a'
  j.rect(6, 14 + o, 8, 15 + o, pants)
  j.rect(15, 14 + o, 17, 15 + o, pants)
  j.rect(5, 16 + o, 6, 18 + o, boot)
  j.rect(17, 16 + o, 18, 18 + o, boot)
  ;[3, 4, 4, 4, 4, 3].forEach((hw, i) => j.span(11 + i + o, CX, hw, look.silk))
  j.rimShade(look.silk, null, darken(look.silk, 0.3), 'topdown')
  const paint = (x: number, y: number) => {
    const c = j.get(x, y)
    if (c !== null && c !== pants && c !== boot) j.set(x, y, look.silk2)
  }
  switch (look.pattern) {
    case 'sash':
      for (let i = 0; i < 6; i++) {
        paint(9 + i, 11 + i + o)
        paint(10 + i, 11 + i + o)
      }
      break
    case 'stripe':
      for (let y = 11; y <= 16; y++) {
        paint(11, y + o)
        paint(12, y + o)
      }
      break
    case 'hoops':
      for (let x = 8; x <= 15; x++) {
        paint(x, 12 + o)
        paint(x, 14 + o)
      }
      break
    case 'halves':
      for (let y = 11; y <= 16; y++) for (let x = 12; x <= 15; x++) paint(x, y + o)
      break
  }
  j.set(7, 11 + o, look.silk)
  j.set(7, 10 + o, look.silk)
  j.set(8, 9 + o, look.silk2)
  j.set(8, 8 + o, skin)
  j.set(16, 11 + o, look.silk)
  j.set(16, 10 + o, look.silk)
  j.set(15, 9 + o, look.silk2)
  j.set(15, 8 + o, skin)
  ;[2, 3, 3, 2].forEach((hw, i) => j.span(7 + i + o, CX, hw, look.silk))
  j.rect(11, 7 + o, 12, 9 + o, look.silk2)
  j.set(10, 8 + o, lighten(look.silk, 0.45))
  j.outline()

  const out = new PixelLayer(SPRITE_W, SPRITE_H)
  out.stamp(legs).stamp(body).stamp(tail).stamp(cloth).stamp(j)
  // Reins from hands to the bit.
  const rein = '#3a2416'
  out.line(9, 8 + o, 10, 6 + hy, rein)
  out.line(14, 8 + o, 13, 6 + hy, rein)
  return out
}

// ---------------------------------------------------------------------------
// Side-view hero horse for the title and results screens.

export const HERO_W = 64
export const HERO_H = 44

type P = [number, number]
interface Leg { j: P; k: P; h: P }
interface HeroFrame { farFront: Leg; nearFront: Leg; farHind: Leg; nearHind: Leg; bob: number; tail: number }

const leg = (j: P, k: P, h: P): Leg => ({ j, k, h })

const HERO_FRAMES: HeroFrame[] = [
  {
    // Extended flight.
    farFront: leg([42, 26], [47, 30], [52, 31]),
    nearFront: leg([41, 26], [45, 31], [49, 35]),
    farHind: leg([19, 26], [13, 30], [7, 31]),
    nearHind: leg([20, 26], [14, 32], [9, 36]),
    bob: -1,
    tail: -1,
  },
  {
    // Hind legs land.
    farFront: leg([42, 26], [45, 31], [42, 34]),
    nearFront: leg([41, 26], [43, 31], [39, 33]),
    farHind: leg([19, 26], [18, 33], [16, 40]),
    nearHind: leg([20, 26], [22, 32], [23, 40]),
    bob: 1,
    tail: 0,
  },
  {
    // Front legs land.
    farFront: leg([42, 26], [46, 31], [50, 35]),
    nearFront: leg([41, 26], [42, 33], [42, 40]),
    farHind: leg([19, 26], [14, 31], [9, 34]),
    nearHind: leg([20, 26], [16, 32], [12, 37]),
    bob: 1,
    tail: 1,
  },
  {
    // Gathered.
    farFront: leg([42, 26], [44, 31], [40, 32]),
    nearFront: leg([41, 26], [44, 30], [41, 33]),
    farHind: leg([19, 26], [23, 30], [26, 33]),
    nearHind: leg([20, 26], [24, 31], [27, 35]),
    bob: 0,
    tail: 0,
  },
]

export function buildHeroFrames(look: HorseLook): HTMLCanvasElement[] {
  return HERO_FRAMES.map((f) => drawHero(look, f).toCanvas())
}

function drawHero(look: HorseLook, f: HeroFrame): PixelLayer {
  const coat = look.coat
  const light = lighten(coat, 0.25)
  const dark = darken(coat, 0.3)
  const far = darken(coat, 0.38)
  const hoof = '#2a2228'
  const sock = look.socks ? '#efe9dc' : null
  const b = f.bob

  const drawLeg = (layer: PixelLayer, l: Leg, color: string, withSock: boolean) => {
    const j: P = [l.j[0], l.j[1] + b]
    const k: P = [l.k[0], l.k[1] + Math.round(b / 2)]
    layer.line(j[0], j[1], k[0], k[1], color, 3)
    layer.line(k[0], k[1], l.h[0], l.h[1], color, 2)
    const t = 0.55
    const s: P = [k[0] + (l.h[0] - k[0]) * t, k[1] + (l.h[1] - k[1]) * t]
    if (withSock && sock) layer.line(s[0], s[1], l.h[0], l.h[1], sock, 2)
    layer.rect(l.h[0], l.h[1], l.h[0] + 1, l.h[1] + 1, hoof)
  }

  const farLegs = new PixelLayer(HERO_W, HERO_H)
  drawLeg(farLegs, f.farFront, far, false)
  drawLeg(farLegs, f.farHind, far, false)
  farLegs.outline()

  const nearLegs = new PixelLayer(HERO_W, HERO_H)
  drawLeg(nearLegs, f.nearFront, coat, true)
  drawLeg(nearLegs, f.nearHind, coat, true)
  nearLegs.outline()

  const tail = new PixelLayer(HERO_W, HERO_H)
  tail.line(15, 17 + b, 8, 19 + b, look.mane, 3)
  tail.line(8, 19 + b, 3, 24 + b + f.tail, look.mane, 3)
  tail.line(3, 24 + b + f.tail, 1, 29 + b + f.tail * 2, look.mane, 2)
  tail.line(12, 17 + b, 5, 21 + b, lighten(look.mane, 0.3), 1)
  tail.outline()

  const body = new PixelLayer(HERO_W, HERO_H)
  body.ellipse(20, 21 + b, 7, 7, coat)
  body.ellipse(31, 22 + b, 12, 6, coat)
  body.ellipse(41, 21 + b, 6, 6, coat)
  body.poly([[37, 19 + b], [43, 9 + b], [48, 6 + b], [51, 10 + b], [47, 23 + b]], coat)
  body.poly([[47, 6 + b], [50, 4 + b], [53, 5 + b], [58, 11 + b], [59, 14 + b], [57, 16 + b], [53, 15 + b], [49, 11 + b]], coat)
  body.poly([[48, 6 + b], [49, 1 + b], [51, 5 + b]], coat)
  body.rimShade(coat, light, dark, 'top')
  body.line(38, 15 + b, 47, 5 + b, look.mane, 2)
  body.line(37, 17 + b, 35, 19 + b, look.mane, 1)
  body.line(41, 12 + b, 39, 14 + b, look.mane, 1)
  body.set(52, 8 + b, '#140c10')
  body.set(58, 13 + b, '#140c10')
  body.outline()

  const cloth = new PixelLayer(HERO_W, HERO_H)
  cloth.rect(25, 15 + b, 35, 21 + b, look.cloth)
  cloth.rect(25, 22 + b, 35, 22 + b, '#f4efe6')
  // Saddle-cloth number "1".
  cloth.rect(29, 17 + b, 29, 20 + b, '#f4efe6')
  cloth.set(28, 18 + b, '#f4efe6')
  cloth.rect(28, 20 + b, 30, 20 + b, '#f4efe6')

  const j = new PixelLayer(HERO_W, HERO_H)
  const pants = '#ece8f2'
  const boot = '#1e1a22'
  const skin = '#f2b98a'
  const silkDark = darken(look.silk, 0.3)
  j.line(39, 8 + b, 43, 12 + b, silkDark, 2)
  j.line(43, 12 + b, 46, 13 + b, silkDark, 2)
  j.line(30, 10 + b, 36, 13 + b, pants, 3)
  j.line(36, 13 + b, 33, 17 + b, pants, 2)
  j.rect(32, 17 + b, 35, 19 + b, boot)
  j.line(30, 9 + b, 39, 7 + b, look.silk, 5)
  const paint = (x: number, y: number) => {
    if (j.get(x, y) === look.silk) j.set(x, y, look.silk2)
  }
  for (let i = 0; i < 6; i++) {
    paint(33 - Math.floor(i / 3), 5 + i + b)
    paint(36 - Math.floor(i / 3), 4 + i + b)
  }
  j.line(39, 8 + b, 42, 12 + b, look.silk, 2)
  j.line(42, 12 + b, 46, 13 + b, look.silk, 2)
  j.set(42, 11 + b, look.silk2)
  j.rect(46, 12 + b, 47, 13 + b, skin)
  j.ellipse(42, 4 + b, 3.5, 3, look.silk)
  j.line(39, 2 + b, 43, 1 + b, look.silk2, 1)
  j.set(41, 2 + b, lighten(look.silk, 0.45))
  j.rect(44, 5 + b, 45, 6 + b, skin)
  j.set(46, 4 + b, boot)
  j.outline()

  const out = new PixelLayer(HERO_W, HERO_H)
  out.stamp(farLegs).stamp(tail).stamp(nearLegs).stamp(body).stamp(cloth).stamp(j)
  out.line(47, 13 + b, 55, 12 + b, '#3a2416')
  out.set(53, 11 + b, OUTLINE)
  return out
}
