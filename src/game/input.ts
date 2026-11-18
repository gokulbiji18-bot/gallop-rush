import { JUMP } from './constants'
import type { Intent } from './types'

const SCROLL_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'])
const JUMP_KEYS = new Set(['KeyJ', 'ShiftLeft', 'ShiftRight'])

/** Keyboard state: held keys for steering, edge-triggered presses for menus. */
export class Input {
  private readonly held = new Set<string>()
  private pressed = new Set<string>()
  /** performance.now() of the last jump key press, for input buffering. */
  private jumpPressedAt = -Infinity

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return
    // Stop the page scrolling, and stop Space re-clicking whichever button has focus.
    if (SCROLL_KEYS.has(e.code)) e.preventDefault()
    if (!e.repeat) {
      this.pressed.add(e.code)
      if (JUMP_KEYS.has(e.code)) this.jumpPressedAt = performance.now()
    }
    this.held.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code)
  }

  private onBlur = () => {
    this.held.clear()
  }

  isHeld(...codes: string[]) {
    return codes.some((c) => this.held.has(c))
  }

  /** Returns and clears the set of keys pressed since the last call. */
  takePressed(): Set<string> {
    const p = this.pressed
    this.pressed = new Set()
    return p
  }

  intent(): Intent {
    return {
      left: this.isHeld('ArrowLeft', 'KeyA'),
      right: this.isHeld('ArrowRight', 'KeyD'),
      up: this.isHeld('ArrowUp', 'KeyW'),
      down: this.isHeld('ArrowDown', 'KeyS'),
      sprint: this.isHeld('Space'),
      // A press counts for a short window, so tapping just before landing still jumps.
      jump: performance.now() - this.jumpPressedAt < JUMP.buffer * 1000,
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }
}
