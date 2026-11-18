import { useCallback, useEffect, useRef, useState } from 'react'

import { ControlsPanel, CanvasHud, RaceTracker } from '@/components/game/Hud'
import { Countdown, FinishFlash, GoFlash, PauseScreen, ResultsScreen, StartScreen } from '@/components/game/Overlays'
import { VIEW_H, VIEW_W } from '@/game/constants'
import { GameEngine, type HudSnapshot, type RaceResult, type Screen } from '@/game/engine'
import type { Difficulty } from '@/game/types'

const PANEL_SPACE = 560
const WIDE = 1100

/** Largest crisp (integer) scale that fits; fractional only on very small screens. */
function computeScale() {
  const availH = window.innerHeight - 32
  const availW = window.innerWidth >= WIDE ? window.innerWidth - PANEL_SPACE : window.innerWidth - 32
  const s = Math.min(availH / VIEW_H, availW / VIEW_W, 4)
  return s >= 2 ? Math.floor(s) : Math.max(1, s)
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const [screen, setScreen] = useState<Screen>('menu')
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [result, setResult] = useState<RaceResult | null>(null)
  const [muted, setMuted] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState<number | null>(null)
  const [scale, setScale] = useState(computeScale)

  useEffect(() => {
    const engine = new GameEngine(canvasRef.current!, {
      onScreen: setScreen,
      onHud: setHud,
      onResult: setResult,
      onMuted: setMuted,
    })
    engineRef.current = engine
    setBest(engine.getBest('normal'))
    ;(window as unknown as { __gallop: GameEngine }).__gallop = engine
    return () => engine.destroy()
  }, [])

  useEffect(() => {
    const onResize = () => setScale(computeScale())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Flash "GO!" for the first moments of the race clock.
  const showGo = hud?.phase === 'racing' && hud.time < 0.7

  useEffect(() => {
    if (screen === 'menu' && engineRef.current) setBest(engineRef.current.getBest(difficulty))
  }, [screen, difficulty])

  const chooseDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d)
    engineRef.current?.setDifficulty(d)
  }, [])

  const inRace = screen === 'race' || screen === 'paused'

  return (
    <main className="flex min-h-dvh items-center justify-center p-4 text-foreground">
      <div className="flex flex-col items-center gap-8 min-[1100px]:flex-row min-[1100px]:items-start">
        <div className="order-2 min-[1100px]:order-1">
          <RaceTracker hud={inRace || screen === 'results' ? hud : null} />
        </div>

        <div
          className="relative order-1 shrink-0 border-4 border-[#f4efe6] shadow-[8px_8px_0_#0a0710] min-[1100px]:order-2"
          style={{ width: VIEW_W * scale + 8, height: VIEW_H * scale + 8 }}
        >
          <canvas
            ref={canvasRef}
            width={VIEW_W}
            height={VIEW_H}
            className="pixel-canvas block size-full"
            aria-label="Horse race track"
          />

          {inRace && hud && hud.phase !== 'countdown' && <CanvasHud hud={hud} />}
          {screen === 'race' && hud?.phase === 'countdown' && <Countdown value={hud.countdown} />}
          {screen === 'race' && showGo && <GoFlash />}
          {screen === 'race' && hud?.phase === 'finishing' && <FinishFlash position={hud.position} />}

          {screen === 'menu' && (
            <StartScreen
              difficulty={difficulty}
              best={best}
              onDifficulty={chooseDifficulty}
              onStart={() => engineRef.current?.startRace()}
            />
          )}
          {screen === 'paused' && (
            <PauseScreen
              onResume={() => engineRef.current?.resume()}
              onRestart={() => engineRef.current?.restart()}
              onMenu={() => engineRef.current?.toMenu()}
            />
          )}
          {screen === 'results' && result && (
            <ResultsScreen
              result={result}
              onAgain={() => engineRef.current?.startRace()}
              onMenu={() => engineRef.current?.toMenu()}
            />
          )}
        </div>

        <div className="order-3">
          <ControlsPanel muted={muted} onToggleMute={() => engineRef.current?.toggleMute()} />
        </div>
      </div>
    </main>
  )
}
