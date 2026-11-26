// missions.js — the three ways to fly: ring run, island hop, free flight.
// A mission owns its goal text, its timer and its win/lose checks.

export const MISSIONS = {
  rings: {
    kind: 'rings',
    title: 'RING RUN',
    hint: 'Fly through all 8 rings — then land on the strip',
    timed: true,
    targetRings: 8,
  },
  landing: {
    kind: 'landing',
    title: 'ISLAND HOP',
    hint: 'Take off, circle Pulau Hijau, land back on the strip',
    timed: true,
    targetRings: 0,
  },
  free: {
    kind: 'free',
    title: 'FREE FLIGHT',
    hint: 'No timer, no rings — just fly the archipelago',
    timed: false,
    targetRings: 0,
  },
};

export function createMission(kind) {
  const base = MISSIONS[kind] || MISSIONS.rings;
  return {
    kind: base.kind,
    title: base.title,
    hint: base.hint,
    timed: base.timed,
    targetRings: base.targetRings,
    elapsed: 0,
    finished: false,
    result: null, // 'landed' | 'crashed' | 'rings-done' | null
  };
}

// Returns an event string for the main loop to announce, or null.
export function checkMissionProgress(mission, plane, world) {
  if (mission.kind === 'rings' && plane.ringsPassed >= mission.targetRings && !mission.finished) {
    mission.finished = true;
    mission.result = 'rings-done';
    return 'rings-done';
  }
  return null;
}

export function describeLanding(plane, world) {
  const onStrip = world && plane
    ? (Math.abs(plane.x) <= 17 && plane.z >= -260 && plane.z <= 260)
    : false;
  const gentle = plane.verticalSpeed > -12 && plane.speed < 55;
  const onLand = plane.y <= 1.2;
  return { onStrip, gentle, onLand };
}
