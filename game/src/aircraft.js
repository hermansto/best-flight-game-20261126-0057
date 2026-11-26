// aircraft.js — the little prop plane: flight model, fuel, damage, scoring.
// Heading 0 faces north (-Z). Pitch positive climbs. Roll banks into turns.

export function createAircraft() {
  return {
    x: 0, y: 0.6, z: 140,          // parked mid-runway, wheels on the strip
    heading: 0,                    // radians, 0 = north
    pitch: 0,                      // radians, nose up positive
    roll: 0,                       // radians, right wing down positive
    speed: 0,                      // m/s along the nose
    verticalSpeed: 0,              // m/s, derived each tick
    throttle: 0,                   // 0..1
    fuel: 100,                     // percent
    damage: 0,                     // percent, 100 = wrecked
    onGround: true,
    airTime: 0,
    ringsPassed: 0,
    score: 0,
    landedClean: false,
  };
}

export function resetAircraft(plane) {
  const fresh = createAircraft();
  Object.assign(plane, fresh);
}

const MAX_SPEED = 92;          // m/s at full throttle, level
const STALL_SPEED = 24;        // below this the wings give up
const LIFT_SPEED = 30;         // rotate speed on the runway
const GRAVITY_PULL = 9.5;
const FUEL_BURN = 0.55;        // percent per second at full throttle

export function updateAircraft(plane, input, world, dt) {
  const prevY = plane.y;

  // Throttle: W/S keys or mouse wheel; Space brakes on the ground.
  plane.throttle += (input.throttleUp ? dt * 0.7 : 0) - (input.throttleDown ? dt * 0.7 : 0);
  if (input.brake) plane.throttle = Math.max(0, plane.throttle - dt * 1.4);
  plane.throttle = Math.max(0, Math.min(1, plane.throttle));

  // Roll from arrow keys or mouse offset; rudder A/D yaws the nose.
  const rollTarget = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0);
  const rollFromMouse = input.mouseActive ? input.mouseX * 1.1 : 0;
  const targetRoll = Math.max(-1, Math.min(1, rollTarget + rollFromMouse)) * 1.05;
  plane.roll += (targetRoll - plane.roll) * Math.min(1, dt * 3.2);

  // Pitch from arrow keys or mouse; gentle auto-level when hands off.
  const pitchTarget = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  const pitchFromMouse = input.mouseActive ? -input.mouseY * 0.8 : 0;
  const targetPitch = Math.max(-0.5, Math.min(0.55, pitchTarget * 0.32 + pitchFromMouse));
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, dt * 2.6);
  if (!input.pitchUp && !input.pitchDown && !input.mouseActive) {
    plane.pitch *= Math.max(0, 1 - dt * 0.35);
  }

  // Heading follows the bank; rudder nudges it directly.
  const yawRate = -plane.roll * 0.62 + ((input.yawRight ? 1 : 0) - (input.yawLeft ? 1 : 0)) * 0.22;
  plane.heading += yawRate * dt * (0.35 + 0.65 * Math.min(1, plane.speed / 40));

  // Speed: thrust against drag, climbing costs speed, diving gains it.
  const thrust = plane.throttle * MAX_SPEED;
  const drag = plane.speed * 1.0 + Math.abs(plane.roll) * 6;
  plane.speed += (thrust - drag) * dt * 0.55;
  plane.speed += -Math.sin(plane.pitch) * GRAVITY_PULL * dt * 0.9;
  if (input.brake && plane.onGround) plane.speed = Math.max(0, plane.speed - dt * 26);
  plane.speed = Math.max(0, Math.min(120, plane.speed));

  // Lift: enough speed and a nose-up attitude climbs; slow and level sinks.
  const forwardX = Math.sin(plane.heading);
  const forwardZ = -Math.cos(plane.heading);
  const liftFactor = Math.min(1, plane.speed / LIFT_SPEED);
  const climb = Math.sin(plane.pitch) * plane.speed * liftFactor;
  const sink = (1 - liftFactor) * 7 + (plane.speed < STALL_SPEED && !plane.onGround ? 9 : 0);
  plane.y += (climb - sink) * dt;
  plane.verticalSpeed = (plane.y - prevY) / Math.max(dt, 0.001);

  plane.x += forwardX * plane.speed * Math.cos(plane.pitch) * dt;
  plane.z += forwardZ * plane.speed * Math.cos(plane.pitch) * dt;

  // Ground contact: runway is flat, islands are bumpy, sea is flat at 0.
  const ground = groundHeightAt(world, plane.x, plane.z);
  if (plane.y <= ground + 0.6) {
    plane.y = ground + 0.6;
    if (!plane.onGround) {
      plane.onGround = true;
    }
    if (plane.speed < 4) plane.verticalSpeed = 0;
  } else {
    plane.onGround = false;
  }
  if (!plane.onGround) plane.airTime += dt;

  // Fuel burns with throttle; empty tanks mean a glide home.
  if (plane.throttle > 0.02 && plane.fuel > 0) {
    plane.fuel = Math.max(0, plane.fuel - FUEL_BURN * plane.throttle * dt);
    if (plane.fuel <= 0) plane.throttle = 0;
  }
  return plane;
}

export function groundHeightAt(world, x, z) {
  // The strip is graded flat: nothing pokes through the runway corridor.
  if (Math.abs(x - world.runway.x) < 70 && z >= world.runway.zStart - 40 && z <= world.runway.zEnd + 40) {
    return 0;
  }
  let h = 0;
  for (const isl of world.islands) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz) / isl.radius;
    if (d < 1) {
      const bump = Math.cos(d * Math.PI * 0.5);
      h = Math.max(h, bump * bump * isl.peak);
    }
  }
  return h;
}

export function checkRingPass(plane, ring) {
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dz = plane.z - ring.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return dist < ring.radius + 6;
}

export function scoreRing(plane) {
  plane.ringsPassed += 1;
  const bonus = 100 + Math.max(0, 40 - Math.floor(plane.airTime)) * 2;
  plane.score += bonus;
  return bonus;
}

export function scoreLanding(plane, gentle) {
  const bonus = gentle ? 500 : 150;
  plane.score += bonus;
  plane.landedClean = gentle;
  return bonus;
}
