// hud.js — the lit instruments: readouts, compass strip, attitude ball,
// throttle bar and the toast line. All DOM, updated from the plane state.

export function createHud() {
  return {
    alt: document.getElementById('alt'),
    spd: document.getElementById('spd'),
    hdg: document.getElementById('hdg'),
    vert: document.getElementById('vert'),
    score: document.getElementById('score'),
    rings: document.getElementById('rings'),
    fuel: document.getElementById('fuel'),
    time: document.getElementById('time'),
    missionName: document.getElementById('mission-name'),
    missionHint: document.getElementById('mission-hint'),
    throttleFill: document.getElementById('throttle-fill'),
    throttlePct: document.getElementById('throttle-pct'),
    toast: document.getElementById('toast'),
    compassCanvas: document.getElementById('compass-canvas'),
    attitudeCanvas: document.getElementById('attitude-canvas'),
  };
}

export function updateHud(hud, plane, mission, elapsed) {
  const altM = Math.max(0, Math.round(plane.y));
  const knots = Math.round(plane.speed * 1.944);
  const headingDeg = Math.round(((plane.heading * 180 / Math.PI) % 360 + 360) % 360);
  hud.alt.textContent = `${altM} m`;
  hud.spd.textContent = `${knots} kt`;
  hud.hdg.textContent = `${String(headingDeg).padStart(3, '0')}°`;
  const vs = plane.verticalSpeed;
  hud.vert.textContent = `${vs >= 0 ? '+' : ''}${vs.toFixed(1)} m/s`;
  hud.score.textContent = String(plane.score);
  hud.rings.textContent = `${plane.ringsPassed} / 8`;
  hud.fuel.textContent = `${Math.round(plane.fuel)}%`;
  hud.fuel.className = plane.fuel < 25 ? 'amber' : 'lit';
  hud.time.textContent = formatTime(elapsed);
  hud.throttleFill.style.height = `${Math.round(plane.throttle * 100)}%`;
  hud.throttlePct.textContent = `${Math.round(plane.throttle * 100)}%`;
  drawCompass(hud.compassCanvas, headingDeg);
  drawAttitude(hud.attitudeCanvas, plane.pitch, plane.roll);
}

export function setMissionHud(hud, mission) {
  hud.missionName.textContent = mission.title;
  hud.missionHint.textContent = mission.hint;
}

let toastTimer = 0;
export function showToast(hud, text, ms = 2200) {
  hud.toast.textContent = text;
  hud.toast.style.opacity = '1';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { hud.toast.style.opacity = '0'; }, ms);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawCompass(canvas, headingDeg) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(6, 24, 38, 0.0)';
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  ctx.font = '700 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 420; d += 15) {
    const rel = ((d - headingDeg + 540) % 360) - 180;
    const x = w / 2 + rel * 2.2;
    if (x < -10 || x > w + 10) continue;
    const major = d % 45 === 0;
    ctx.strokeStyle = major ? '#ffd166' : 'rgba(232, 246, 255, 0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, major ? 6 : 12);
    ctx.lineTo(x, 20);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#e8f6ff';
      ctx.fillText(labels[((d % 360) + 360) % 360] || String(((d % 360) + 360) % 360), x, 32);
    }
  }
  // Fixed lubber line in the middle.
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, 0); ctx.lineTo(w / 2 + 6, 0); ctx.lineTo(w / 2, 8);
  ctx.closePath(); ctx.fill();
}

function drawAttitude(canvas, pitch, roll) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2 - 3;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  // Sky above the horizon line, earth below it, both tilted by the bank.
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const horizonOffset = pitch * r * 1.6;
  ctx.fillStyle = '#5ea8d8';
  ctx.fillRect(-r, -r, r * 2, r + horizonOffset);
  ctx.fillStyle = '#8a6b3f';
  ctx.fillRect(-r, horizonOffset, r * 2, r + 20);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, horizonOffset);
  ctx.lineTo(r, horizonOffset);
  ctx.stroke();
  ctx.restore();
  // Fixed wings marker and rim.
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy); ctx.lineTo(cx - 6, cy);
  ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 22, cy);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232, 246, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}
