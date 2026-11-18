import { useEffect, useRef } from 'react'

import { mulberry32 } from '@/game/pixel'
import { FIELD } from '@/game/race'
import { HERO_H, HERO_W, buildHeroFrames } from '@/game/sprites'

const GROUND = 6
const FPS = 11

/** Side-view galloping horse and rider over a scrolling strip of dirt. */
export function HeroHorse({ scale = 3 }: { scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const look = FIELD.find((e) => !e.ai)!.look
    const frames = buildHeroFrames(look)
    const rng = mulberry32(5)
    const specks = Array.from({ length: 18 }, () => ({ x: rng() * HERO_W, y: rng() * (GROUND - 1), c: rng() }))
    let raf = 0
    const start = performance.now()

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      // rAF timestamps can predate the effect's performance.now(); clamp so frame stays >= 0.
      const t = Math.max(0, now - start) / 1000
      const frame = Math.floor(t * FPS) % frames.length
      const scroll = t * 60
      ctx.clearRect(0, 0, HERO_W, HERO_H + GROUND)
      ctx.fillStyle = '#c38d55'
      ctx.fillRect(0, HERO_H - 2, HERO_W, GROUND + 2)
      ctx.fillStyle = '#8f5f33'
      ctx.fillRect(0, HERO_H - 2, HERO_W, 1)
      for (const s of specks) {
        ctx.fillStyle = s.c < 0.5 ? '#a8743f' : '#d6a56d'
        ctx.fillRect(Math.floor((((s.x - scroll) % HERO_W) + HERO_W) % HERO_W), HERO_H + Math.floor(s.y), 2, 1)
      }
      ctx.fillStyle = 'rgba(30, 14, 0, 0.3)'
      ctx.fillRect(14, HERO_H - 1, 38, 2)
      ctx.drawImage(frames[frame], 0, 0)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={ref}
      width={HERO_W}
      height={HERO_H + GROUND}
      className="pixel-canvas block"
      style={{ width: HERO_W * scale, height: (HERO_H + GROUND) * scale }}
      aria-label="Pixel-art racehorse and jockey galloping"
      role="img"
    />
  )
}
