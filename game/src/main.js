// main.js — game loop, screens and state: menu, flying, landed, crashed.
// Boots the world, the plane, the HUD and the sound, then runs every frame.

import { buildWorld, isOnRunway } from './world.js';
import { createAircraft, resetAircraft, updateAircraft, checkRingPass, scoreRing, scoreLanding } from './aircraft.js';
import { createInput, bindInput } from './input.js';
import { renderScene } from './render.js';
import { createHud, updateHud, setMissionHud, showToast } from './hud.js';
import { createAudio, ensureAudio, updateEngineSound, playChime, playThud, toggleMute } from './audio.js';
import { createMission, checkMissionProgress } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const screenEl = document.getElementById('screen');
const screenText = document.getElementById('screen-text');

const world = buildWorld();
const plane = createAircraft();
const input = createInput();
const hud = createHud();
const audio = createAudio();

let mission = createMission('rings');
let gameState = 'menu'; // menu | flying | landed | crashed
let lastTime = performance.now();
let wasOnGround = true;
let wasAirborne = false;
let shotPreset = null;

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

function startMission(kind) {
  resetAircraft(plane);
  mission = createMission(kind);
  setMissionHud(hud, mission);
  gameState = 'flying';
  wasOnGround = true;
  wasAirborne = false;
  screenEl.classList.add('hidden');
  ensureAudio(audio);
  showToast(hud, `${mission.title} — GOOD LUCK, PILOT`, 2600);
}

function showEndScreen(title, body) {
  screenText.innerHTML = body;
  const heading = screenEl.querySelector('h1');
  heading.textContent = title;
  screenEl.classList.remove('hidden');
}

function endFlight(result, detail) {
  if (gameState !== 'flying') return;
  gameState = result === 'crashed' ? 'crashed' : 'landed';
  playThud(audio, result === 'crashed');
  if (result === 'crashed') {
    showEndScreen('DOWN!', `${detail} Score <b>${plane.score}</b> · Rings <b>${plane.ringsPassed}/8</b> · Time <b>${mission.elapsed.toFixed(0)}s</b>.<br>Press <b>R</b> or pick a mission to fly again.`);
  } else {
    showEndScreen('WHEELS DOWN', `${detail} Final score <b>${plane.score}</b> · Rings <b>${plane.ringsPassed}/8</b> · Time <b>${mission.elapsed.toFixed(0)}s</b>.<br>Press <b>R</b> or pick a mission to fly again.`);
  }
}

function handleTouchdown() {
  const groundHit = plane.y <= 1.3;
  if (!groundHit) return;
  const onStrip = isOnRunway(world, plane.x, plane.z);
  const hard = plane.verticalSpeed < -12 || plane.speed > 72;
  const inWater = !onStrip && plane.y <= 1.3 && !onIsland();
  if (inWater) {
    endFlight('crashed', 'Ditched in the sea — the Merpati does not float.');
    return;
  }
  if (onStrip) {
    if (hard) {
      endFlight('crashed', 'Too hard on the strip — the undercarriage gave up.');
    } else {
      const bonus = scoreLanding(plane, plane.verticalSpeed > -8);
      plane.fuel = 100;
      endFlight('landed', `A clean landing on Merpati Strip! Landing bonus <b>+${bonus}</b>.`);
    }
    return;
  }
  // Rough ground somewhere on an island.
  if (plane.speed > 18 || plane.verticalSpeed < -9) {
    endFlight('crashed', 'Came down in the hills — the island wins this round.');
  } else {
    const bonus = scoreLanding(plane, false);
    endFlight('landed', `A rough field landing — the plane is intact. Bonus <b>+${bonus}</b>.`);
  }
}

function onIsland() {
  for (const isl of world.islands) {
    const dx = plane.x - isl.x;
    const dz = plane.z - isl.z;
    if (Math.sqrt(dx * dx + dz * dz) < isl.radius * 0.92) return true;
  }
  return false;
}

function tick(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (gameState === 'flying') {
    mission.elapsed += dt;
    const prevGround = plane.onGround;
    updateAircraft(plane, input, world, dt);
    updateEngineSound(audio, plane);

    // Touchdown: the moment wheels meet ground after being airborne.
    if (plane.onGround && !prevGround && wasAirborne) {
      handleTouchdown();
    }
    if (!plane.onGround) wasAirborne = true;

    // Ring of the moment: fly through it to score.
    if (mission.kind === 'rings' && plane.ringsPassed < world.rings.length) {
      const ring = world.rings[plane.ringsPassed];
      if (checkRingPass(plane, ring)) {
        const bonus = scoreRing(plane);
        playChime(audio);
        showToast(hud, `RING ${plane.ringsPassed} — +${bonus}`, 1600);
      }
    }
    const event = checkMissionProgress(mission, plane, world);
    if (event === 'rings-done') {
      showToast(hud, 'ALL RINGS! Now land on the strip', 3000);
      playChime(audio);
    }
    if (plane.fuel <= 0 && plane.throttle <= 0) {
      showToast(hud, 'FUEL EMPTY — glide her home', 2000);
    }
  }

  const state = {
    world, plane, mission, width: canvas.width, height: canvas.height,
    time: now / 1000,
  };
  renderScene(ctx, state);
  updateHud(hud, plane, mission, mission.elapsed);
  requestAnimationFrame(tick);
}

// Menu keys and buttons.
document.querySelectorAll('#screen button[data-mission]').forEach((btn) => {
  btn.addEventListener('click', () => startMission(btn.dataset.mission));
});

bindInput(input, canvas, (code, pressed) => {
  if (!pressed) return;
  if (code === 'KeyM') {
    const muted = toggleMute(audio);
    showToast(hud, muted ? 'SOUND OFF' : 'SOUND ON', 1200);
  }
  if (code === 'KeyR' && gameState !== 'menu') {
    startMission(mission.kind);
  }
  if (gameState === 'menu') {
    if (code === 'Digit1') startMission('rings');
    if (code === 'Digit2') startMission('landing');
    if (code === 'Digit3') startMission('free');
    if (code === 'Enter' || code === 'Space') startMission('rings');
  }
});

// Screenshot presets: ?shot=takeoff | rings | approach — start flying at once
// in a photogenic spot, so the maker can capture the real game mid-flight.
function applyShotPreset() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return;
  shotPreset = shot;
  if (shot === 'takeoff') {
    startMission('landing');
    plane.throttle = 0.85;
    plane.speed = 34;
    plane.y = 3;
    plane.z = 120;
    plane.pitch = 0.28; // rotating off the strip, nose up
  } else if (shot === 'rings') {
    startMission('rings');
    plane.x = -640;
    plane.z = -980;
    plane.y = 148;
    plane.speed = 62;
    plane.throttle = 0.72;
    plane.heading = -0.9;
    plane.ringsPassed = 3;
    plane.score = 340;
  } else if (shot === 'approach') {
    startMission('landing');
    plane.x = 26;
    plane.z = 880;
    plane.y = 68;
    plane.speed = 56;
    plane.throttle = 0.45;
    plane.heading = 0.03;
  } else if (shot === 'free') {
    startMission('free');
    plane.x = 700;
    plane.z = -300;
    plane.y = 330; // above the cloud layer, looking down at the islands
    plane.speed = 66;
    plane.throttle = 0.7;
    plane.heading = 2.9;
  }
}

// Handle for play-testing: window.__flight reports live state.
window.__flight = {
  get state() { return gameState; },
  get plane() { return plane; },
  get mission() { return mission; },
  get shot() { return shotPreset; },
  start: startMission,
};

applyShotPreset();
setMissionHud(hud, mission);
requestAnimationFrame(tick);
