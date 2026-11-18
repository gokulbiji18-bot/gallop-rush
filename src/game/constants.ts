// Internal render resolution. The canvas is scaled up with nearest-neighbour filtering.
export const VIEW_W = 240
export const VIEW_H = 320

// Track geometry (world x == screen x; the world only scrolls vertically).
export const TRACK_LEFT = 46
export const TRACK_RIGHT = 194
export const FENCE_W = 6

// World y grows "up the screen" in the direction of the race.
export const PX_PER_METER = 8
export const RACE_METERS = 1000
export const FINISH_Y = RACE_METERS * PX_PER_METER
export const START_LINE_Y = 20

// The player's horse sits in the lower-middle of the screen.
export const CAMERA_ANCHOR_Y = 226
export const CAMERA_SPEED_LEAD = 0.12

// Horse body footprint used for collisions.
export const HORSE_HALF_W = 6
export const HORSE_HALF_L = 14
export const NOSE_OFFSET = 17
export const STRIDE_PX = 46

export const FIXED_DT = 1 / 120
export const MAX_FRAME_DT = 0.1
export const COUNTDOWN_SECONDS = 3
export const OUTRO_SECONDS = 2.2

// Forward speeds in world px per second.
export const SPEED = {
  slow: 72,
  cruise: 120,
  push: 160,
  windedPush: 142,
  sprint: 212,
  max: 225,
}

export const ACCEL = 70
export const SPRINT_ACCEL = 170
export const DECEL = 95
export const BRAKE = 170

export const LATERAL_MAX = 88
export const LATERAL_ACCEL = 720
export const LATERAL_FRICTION = 900

export const STAMINA = {
  max: 100,
  sprintDrain: 30,
  regenCruise: 14,
  regenPush: 6,
  regenSlow: 24,
  recoverAt: 30,
}

export const BUMP = {
  duration: 0.55,
  cooldown: 0.35,
  rearSpeedFactor: 0.82,
  sidePenalty: 0.94,
  slowedTarget: 0.72,
}

export const JUMP = {
  duration: 0.7,
  height: 14,
  staminaCost: 6,
  /** Grace period: a press this many seconds before landing still triggers the next jump. */
  buffer: 0.15,
  airControl: 0.4,
}

export const STUMBLE = {
  hedge: { speedFactor: 0.45, duration: 1.0 },
  bale: { speedFactor: 0.6, duration: 0.6 },
  slowedTarget: 0.55,
}

export const MUD_SPEED_FACTOR = 0.68

export const kmh =(pxPerSecond: number) => (pxPerSecond / PX_PER_METER) * 3.6
