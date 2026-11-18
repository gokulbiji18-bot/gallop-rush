import type { RaceEvent } from './types'

/** Chiptune-style sound effects synthesised with WebAudio (no audio files). */
export class Sound {
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null
  muted = false

  /** Must be called from a user gesture before audio can play. */
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        return
      }
      const len = Math.floor(this.ctx.sampleRate * 0.2)
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private tone(freq: number, dur: number, vol = 0.06, when = 0, type: OscillatorType = 'square', slideTo?: number) {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    const t0 = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
    gain.gain.setValueAtTime(vol, t0)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private thump(vol: number, cutoff = 260) {
    const ctx = this.ctx
    if (!ctx || !this.noise || this.muted) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff * (0.85 + Math.random() * 0.3)
    const gain = ctx.createGain()
    const t0 = ctx.currentTime
    gain.gain.setValueAtTime(vol, t0)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09)
    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start(t0)
    src.stop(t0 + 0.1)
  }

  play(e: RaceEvent) {
    switch (e.type) {
      case 'countdown':
        this.tone(440, 0.18, 0.07)
        break
      case 'go':
        this.tone(880, 0.4, 0.07)
        break
      case 'hoof':
        this.thump(0.35)
        break
      case 'bump':
        if (!e.player) return
        this.thump(0.6, 180)
        this.tone(140, 0.12, 0.05, 0, 'square', 80)
        break
      case 'jump':
        if (e.player) this.tone(260, 0.18, 0.05, 0, 'square', 620)
        break
      case 'land':
        if (e.player) this.thump(0.5, 220)
        break
      case 'stumble':
        if (!e.player) return
        this.thump(0.7, 160)
        this.tone(330, 0.3, 0.05, 0, 'square', 110)
        break
      case 'finish':
        break
    }
  }

  fanfare(win: boolean) {
    const notes = win ? [523, 659, 784, 1047, 784, 1047] : [392, 349, 330, 262]
    const step = win ? 0.11 : 0.18
    notes.forEach((f, i) => this.tone(f, step * (i === notes.length - 1 ? 3 : 1.2), 0.06, i * step))
  }
}
