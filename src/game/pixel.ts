// Tiny pixel-art toolkit: sprites are composed on a colour grid, auto-outlined,
// then baked to offscreen canvases once at startup.

export type Color = string

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`
}

export const darken = (c: string, t: number) => mix(c, '#1a0f1f', t)
export const lighten = (c: string, t: number) => mix(c, '#fff8e8', t)

export const OUTLINE = '#1c1222'

export class PixelLayer {
  readonly w: number
  readonly h: number
  readonly data: (Color | null)[]

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.data = new Array(w * h).fill(null)
  }

  get(x: number, y: number): Color | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null
    return this.data[y * this.w + x]
  }

  set(x: number, y: number, c: Color | null) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.data[y * this.w + x] = c
  }

  rect(x0: number, y0: number, x1: number, y1: number, c: Color) {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0]
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0]
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) this.set(x, y, c)
  }

  /** Horizontal run symmetric around the seam between columns cx-1 and cx. */
  span(y: number, cx: number, hw: number, c: Color) {
    if (hw > 0) this.rect(cx - hw, y, cx + hw - 1, y, c)
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx
        const dy = (y + 0.5 - cy) / ry
        if (dx * dx + dy * dy <= 1) this.set(x, y, c)
      }
    }
  }

  poly(pts: [number, number][], c: Color) {
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        const px = x + 0.5
        const py = y + 0.5
        let inside = false
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i]
          const [xj, yj] = pts[j]
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
        }
        if (inside) this.set(x, y, c)
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color, thickness = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    const off = Math.floor((thickness - 1) / 2)
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps)
      const y = Math.round(y0 + ((y1 - y0) * i) / steps)
      this.rect(x - off, y - off, x - off + thickness - 1, y - off + thickness - 1, c)
    }
  }

  /** Recolours pixels of `base` that border empty space, giving cheap rim lighting. */
  rimShade(base: Color, light: Color | null, dark: Color | null, mode: 'top' | 'topdown') {
    const src = this.data.slice()
    const empty = (x: number, y: number) =>
      x < 0 || y < 0 || x >= this.w || y >= this.h || src[y * this.w + x] === null
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== base) continue
        if (mode === 'top') {
          if (light && (empty(x, y - 1) || empty(x, y - 2))) this.set(x, y, light)
          else if (dark && (empty(x, y + 1) || empty(x, y + 2))) this.set(x, y, dark)
        } else {
          if (light && empty(x - 1, y)) this.set(x, y, light)
          else if (dark && (empty(x + 1, y) || empty(x + 2, y))) this.set(x, y, dark)
        }
      }
    }
  }

  outline(c: Color = OUTLINE) {
    const src = this.data.slice()
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== null) continue
        const n =
          (x > 0 && src[y * this.w + x - 1] !== null) ||
          (x < this.w - 1 && src[y * this.w + x + 1] !== null) ||
          (y > 0 && src[(y - 1) * this.w + x] !== null) ||
          (y < this.h - 1 && src[(y + 1) * this.w + x] !== null)
        if (n) this.data[y * this.w + x] = c
      }
    }
    return this
  }

  stamp(other: PixelLayer, dx = 0, dy = 0) {
    for (let y = 0; y < other.h; y++) {
      for (let x = 0; x < other.w; x++) {
        const c = other.data[y * other.w + x]
        if (c !== null) this.set(x + dx, y + dy, c)
      }
    }
    return this
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = this.w
    canvas.height = this.h
    const ctx = canvas.getContext('2d')!
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.data[y * this.w + x]
        if (c === null) continue
        ctx.fillStyle = c
        ctx.fillRect(x, y, 1, 1)
      }
    }
    return canvas
  }
}

/** Deterministic hash → [0, 1). Used for scenery so the track is identical every race. */
export function hash2(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
