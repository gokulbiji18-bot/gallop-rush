import { Button } from '@/components/ui/8bit/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/8bit/card'
import type { RaceResult } from '@/game/engine'
import type { Difficulty } from '@/game/types'
import { cn } from '@/lib/utils'

import { formatTime, ordinal } from './format'
import { HeroHorse } from './HeroHorse'

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']

function Scrim({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('absolute inset-0 flex items-center justify-center bg-[#14101f]/70 p-5 retro', className)}>
      {children}
    </div>
  )
}

export function StartScreen({
  difficulty,
  best,
  onDifficulty,
  onStart,
}: {
  difficulty: Difficulty
  best: number | null
  onDifficulty: (d: Difficulty) => void
  onStart: () => void
}) {
  return (
    <Scrim className="flex-col gap-4 bg-[#14101f]/80 text-center">
      <div>
        <h1 className="text-[34px] leading-none text-[#ffd43b] text-shadow-pixel">GALLOP</h1>
        <h1 className="mt-1 text-[34px] leading-none text-[#d8323c] text-shadow-pixel">RUSH</h1>
        <p className="mt-3 text-[9px] tracking-widest text-[#b9aed0]">1000M ARCADE DERBY</p>
      </div>

      <HeroHorse scale={3} />

      <div className="flex gap-3" role="radiogroup" aria-label="Difficulty">
        {DIFFICULTIES.map((d) => (
          <Button
            key={d}
            size="sm"
            variant={d === difficulty ? 'default' : 'secondary'}
            role="radio"
            aria-checked={d === difficulty}
            className="h-7 px-2 text-[9px]"
            onClick={() => onDifficulty(d)}
          >
            {d.toUpperCase()}
          </Button>
        ))}
      </div>

      <Button className="h-11 px-6 text-sm" onClick={onStart} data-testid="start-race">
        START RACE
      </Button>

      <div className="space-y-1.5 text-[8px] leading-relaxed text-[#f4efe6]">
        <p>← → STEER · ↑ PUSH · ↓ EASE</p>
        <p>SPACE SPRINT · J JUMP</p>
        <p className="text-[#b9aed0]">
          BEST ({difficulty.toUpperCase()}): {best === null ? '--:--.--' : formatTime(best)}
        </p>
        <p className="blink text-[#ffd43b]">PRESS ENTER</p>
      </div>
    </Scrim>
  )
}

export function Countdown({ value }: { value: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center retro">
      <div key={value} className="count-pop text-[64px] text-[#ffd43b] text-shadow-pixel">
        {value}
      </div>
    </div>
  )
}

export function GoFlash() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center retro">
      <div className="count-pop text-[56px] text-[#4fd16a] text-shadow-pixel">GO!</div>
    </div>
  )
}

export function FinishFlash({ position }: { position: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center retro">
      <div className="count-pop border-4 border-[#f4efe6] bg-[#1c1222]/90 px-5 py-3 text-center">
        <div className="text-[10px] text-[#b9aed0]">FINISHED</div>
        <div className="mt-1 text-3xl text-[#ffd43b]">{ordinal(position)}</div>
      </div>
    </div>
  )
}

export function PauseScreen({ onResume, onRestart, onMenu }: { onResume: () => void; onRestart: () => void; onMenu: () => void }) {
  return (
    <Scrim>
      <Card className="w-[300px]">
        <CardHeader>
          <CardTitle className="text-center text-xl text-[#ffd43b]">PAUSED</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-stretch gap-5 px-8">
          <Button onClick={onResume} autoFocus data-testid="resume">RESUME</Button>
          <Button variant="secondary" onClick={onRestart} data-testid="restart">RESTART</Button>
          <Button variant="secondary" onClick={onMenu}>MAIN MENU</Button>
        </CardContent>
        <CardFooter className="justify-center text-[8px] text-[#b9aed0]">P / ESC TO RESUME · R TO RESTART</CardFooter>
      </Card>
    </Scrim>
  )
}

const VERDICT = ['', 'VICTORY!', 'SO CLOSE!', 'NOT BAD', 'DEFEAT']

export function ResultsScreen({ result, onAgain, onMenu }: { result: RaceResult; onAgain: () => void; onMenu: () => void }) {
  const won = result.position === 1
  return (
    <Scrim className="bg-[#14101f]/80">
      <Card className="w-[400px]">
        <CardHeader className="items-center text-center">
          <p className={cn('text-[11px]', won ? 'text-[#4fd16a]' : 'text-[#ff9f1c]')}>{VERDICT[result.position]}</p>
          <CardTitle className="mt-2 text-[44px] leading-none text-[#ffd43b] text-shadow-pixel" data-testid="result-position">
            {ordinal(result.position)}
          </CardTitle>
          <p className="mt-2 text-[9px] text-[#b9aed0]">PLACE OF {result.field.length}</p>
        </CardHeader>
        <CardContent className="space-y-4 text-[9px]">
          <div className="flex justify-between border-y-2 border-dashed border-[#3a2d52] py-2.5">
            <span className="text-[#b9aed0]">YOUR TIME</span>
            <span className="tabular-nums" data-testid="result-time">{formatTime(result.time)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#b9aed0]">BEST ({result.difficulty.toUpperCase()})</span>
            <span className={cn('tabular-nums', result.newBest && 'text-[#4fd16a]')}>
              {result.best === null ? '--' : formatTime(result.best)}
              {result.newBest && ' NEW!'}
            </span>
          </div>
          <ol className="space-y-2 bg-[#1c1222] p-3">
            {result.field.map((r, i) => (
              <li key={r.name} className={cn('flex items-center gap-2', r.isPlayer && 'text-[#ffd43b]')}>
                <span className="w-8 text-[#b9aed0]">{ordinal(i + 1)}</span>
                <span className="size-2.5 border border-[#f4efe6]/50" style={{ backgroundColor: r.color }} />
                <span className="flex-1">{r.isPlayer ? `${r.name} (YOU)` : r.name}</span>
                <span className="tabular-nums text-[#b9aed0]">
                  {r.projected ? '~' : ''}
                  {formatTime(r.time)}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button className="w-full" onClick={onAgain} autoFocus data-testid="race-again">RACE AGAIN</Button>
          <Button variant="secondary" className="w-full" onClick={onMenu}>MAIN MENU</Button>
        </CardFooter>
      </Card>
    </Scrim>
  )
}
