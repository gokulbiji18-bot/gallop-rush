import { Badge } from '@/components/ui/8bit/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/8bit/card'
import { Progress } from '@/components/ui/8bit/progress'
import type { HudSnapshot } from '@/game/engine'
import { FIELD } from '@/game/race'
import { cn } from '@/lib/utils'

import { formatTime, ordinal } from './format'

/** Minimal in-game HUD overlaid on the track: position, clock, distance, stamina, speed. */
export function CanvasHud({ hud }: { hud: HudSnapshot }) {
  const staminaColor = hud.winded ? 'bg-[#d8323c]' : hud.stamina < 30 ? 'bg-[#ff9f1c]' : 'bg-[#4fd16a]'
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 retro text-[10px]">
      <div className="flex items-start justify-between gap-2">
        <div className="bg-[#1c1222]/85 px-2 py-1.5 border-2 border-[#f4efe6]">
          <div className="text-[8px] text-[#b9aed0]">POS</div>
          <div className="text-lg leading-tight text-[#ffd43b]" data-testid="hud-position">
            {ordinal(hud.position)}
            <span className="text-[10px] text-[#f4efe6]">/{hud.total}</span>
          </div>
        </div>
        <div className="bg-[#1c1222]/85 px-2 py-1.5 border-2 border-[#f4efe6] text-right">
          <div className="text-[8px] text-[#b9aed0]">TIME</div>
          <div className="text-sm leading-tight tabular-nums" data-testid="hud-time">{formatTime(hud.time)}</div>
          <div className="mt-1 text-[8px] text-[#b9aed0]" data-testid="hud-distance">{hud.metersLeft}M TO GO</div>
        </div>
      </div>

      <div className="bg-[#1c1222]/85 px-3 pt-2 pb-3 border-2 border-[#f4efe6]">
        <div className="mb-2 flex items-center justify-between text-[8px]">
          <span>STAMINA</span>
          {hud.stumbled ? (
            <span className="text-[#ff6b6b] blink">STUMBLED!</span>
          ) : hud.airborne ? (
            <span className="text-[#7fd4ff]">JUMP!</span>
          ) : hud.inMud ? (
            <span className="text-[#c9a03e]">MUD!</span>
          ) : hud.winded ? (
            <span className="text-[#ff6b6b] blink">WINDED!</span>
          ) : hud.sprinting ? (
            <span className="text-[#ffd43b]">SPRINT!</span>
          ) : (
            <span className="text-[#b9aed0]">SPACE SPRINT · J JUMP</span>
          )}
          <span className="tabular-nums" data-testid="hud-speed">{hud.speedKmh} KM/H</span>
        </div>
        <Progress value={hud.stamina} variant="retro" progressBg={staminaColor} className="h-3" data-testid="hud-stamina" />
      </div>
    </div>
  )
}

/** Side panel: vertical race tracker plus the live running order. */
export function RaceTracker({ hud }: { hud: HudSnapshot | null }) {
  const racers =
    hud?.racers ?? FIELD.map((e, i) => ({ id: i, name: e.look.name, color: e.look.silk, progress: 0, rank: i + 1, isPlayer: !e.ai }))
  const order = [...racers].sort((a, b) => a.rank - b.rank)
  const progress = hud?.progress ?? 0

  return (
    <Card className="w-[236px]">
      <CardHeader className="pb-0">
        <CardTitle className="text-xs">RACE 1000M</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-[9px]">
        <div className="flex gap-4">
          <div className="relative h-44 w-6 border-4 border-[#f4efe6] bg-[#c38d55]">
            <div className="absolute inset-x-0 top-0 h-2 bg-[repeating-linear-gradient(90deg,#f4efe6_0_4px,#1c1222_4px_8px)]" />
            {racers.map((r) => (
              <div
                key={r.id}
                className={cn('absolute size-3 border-2 border-[#1c1222] -translate-y-1/2', r.isPlayer && 'z-10 ring-2 ring-[#ffd43b]')}
                style={{ backgroundColor: r.color, top: `${(1 - r.progress) * 100}%`, left: r.isPlayer ? 2 : 4 + ((r.id * 3) % 7) - 3 }}
              />
            ))}
          </div>
          <ol className="flex-1 space-y-2.5">
            {order.map((r, i) => (
              <li key={r.id} className={cn('flex items-center gap-2', r.isPlayer && 'text-[#ffd43b]')}>
                <span className="w-5 text-[#b9aed0]">{i + 1}.</span>
                <span className="size-2.5 shrink-0 border border-[#1c1222]" style={{ backgroundColor: r.color }} />
                <span className="leading-tight">{r.isPlayer ? 'YOU' : r.name.split(' ')[0]}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-[8px] text-[#b9aed0]">
            <span>PROGRESS</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <Progress value={progress * 100} progressBg="bg-[#ffd43b]" className="h-2" />
        </div>
      </CardContent>
    </Card>
  )
}

const KEYS: [string, string][] = [
  ['← → / A D', 'STEER'],
  ['↑ / W', 'PUSH ON'],
  ['↓ / S', 'EASE UP'],
  ['SPACE', 'SPRINT'],
  ['J / SHIFT', 'JUMP'],
  ['P / ESC', 'PAUSE'],
  ['M', 'SOUND'],
]

export function ControlsPanel({ muted, onToggleMute }: { muted: boolean; onToggleMute: () => void }) {
  return (
    <Card className="w-[236px]">
      <CardHeader className="pb-0">
        <CardTitle className="text-xs">CONTROLS</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-[8px]">
        <ul className="space-y-2.5">
          {KEYS.map(([k, label]) => (
            <li key={k} className="flex items-center justify-between gap-2">
              <span className="border-2 border-[#f4efe6] bg-[#3a2d52] px-1.5 py-1 leading-none">{k}</span>
              <span className="text-[#b9aed0]">{label}</span>
            </li>
          ))}
        </ul>
        <p className="leading-relaxed text-[#b9aed0]">
          Sprinting burns stamina. Run it dry and your horse is <span className="text-[#ff6b6b]">winded</span> until it recovers to 30%.
          Jump the hedges, hop or dodge hay bales, and skirt the mud.
        </p>
        <button
          type="button"
          onClick={onToggleMute}
          className="pointer-events-auto cursor-pointer"
          aria-pressed={!muted}
        >
          <Badge className={muted ? 'bg-[#3a2d52] text-[#b9aed0]' : 'bg-[#4fd16a] text-[#1c1222]'}>
            SOUND {muted ? 'OFF' : 'ON'}
          </Badge>
        </button>
      </CardContent>
    </Card>
  )
}
