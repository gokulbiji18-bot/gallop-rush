# Gallop Rush

An original 8-bit arcade horse racing game: a 1000 m dash against three rival horses and jockeys on a vertically scrolling dirt track.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173. For a production build: `npm run build && npm run preview`.

## Controls

| Key | Action |
|---|---|
| ← → / A D | Steer |
| ↑ / W | Push on (faster, slower stamina regen) |
| ↓ / S | Ease up (slower, fast stamina regen) |
| Space | Sprint (burns stamina) |
| J / Shift | Jump |
| P / Esc | Pause / resume |
| R | Restart (while paused or on results) |
| Enter | Start / race again |
| M | Toggle sound |

Emptying the stamina bar leaves your horse **winded**: no sprinting and a lower top speed until stamina recovers to 30%.

## Obstacles

- **Hedges** (at 250 m, 500 m and 750 m) span the whole track and must be jumped. White chevrons and a JUMP! sign warn you.
- **Hay bales** block one lane: jump them or steer round. Clipping one stumbles your horse and knocks the bale flat.
- **Mud** slows you while you gallop through it; jump it or go round.

A jump costs a little stamina and carries your speed through the air, with limited steering. Clipping a hedge or bale costs a lot of speed for a moment. Bales and mud are placed differently every race.

## Project layout

- `src/game/`: framework-free game code
  - `engine.ts`: rAF loop, fixed-timestep simulation and the screen state machine
  - `race.ts`: race state, countdown, finish detection, standings
  - `horse.ts`: per-horse physics (speed, stamina, lateral movement)
  - `ai.ts`: rival behaviour (run styles, lane changes, overtaking)
  - `collision.ts`: horse-to-horse bumping
  - `sprites.ts`, `pixel.ts`: procedurally drawn pixel-art sprites (no external assets)
  - `track.ts`, `renderer.ts`: track, scenery and entity rendering
  - `audio.ts`: synthesised chiptune sound effects
- `src/components/game/`: React UI (HUD, start, pause and results screens) built with [8bitcn](https://www.8bitcn.com) components in `src/components/ui/8bit/`
