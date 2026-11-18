export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size0: number
  size1: number
  color: string
}

const DUST = ['#f6e6c4', '#ecd6a8', '#e2c48e']
const MAX_PARTICLES = 400

/** World-space particles (dust kicked up by hooves and bumps). */
export class Particles {
  list: Particle[] = []

  dust(x: number, y: number, count: number, forwardSpeed: number, spread = 1) {
    for (let i = 0; i < count; i++) {
      if (this.list.length >= MAX_PARTICLES) this.list.shift()
      const max = 0.5 + Math.random() * 0.45
      this.list.push({
        x: x + (Math.random() - 0.5) * 5 * spread,
        y: y + (Math.random() - 0.5) * 3,
        vx: (Math.random() - 0.5) * 26 * spread,
        // Dust keeps much of the horse's momentum so the cloud billows just behind the hooves.
        vy: forwardSpeed * (0.45 + Math.random() * 0.25),
        life: max,
        max,
        size0: 2,
        size1: 3 + Math.round(Math.random() * 2 * spread),
        color: DUST[(Math.random() * DUST.length) | 0],
      })
    }
  }

  /** Dark splashes thrown up by a horse galloping through mud. */
  mud(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      if (this.list.length >= MAX_PARTICLES) this.list.shift()
      const max = 0.3 + Math.random() * 0.25
      this.list.push({
        x: x + (Math.random() - 0.5) * 10,
        y,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 30,
        life: max,
        max,
        size0: 2,
        size1: 1,
        color: Math.random() < 0.5 ? '#5a3a1e' : '#704a28',
      })
    }
  }

  update(dt: number) {
    for (const p of this.list) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - 2.5 * dt
      p.vy *= 1 - 2.5 * dt
    }
    this.list = this.list.filter((p) => p.life > 0)
  }
}
