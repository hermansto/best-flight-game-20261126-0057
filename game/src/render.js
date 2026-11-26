// render.js — draws the whole scene on one canvas: sky, sun, sea, islands,
// runway, rings and the chase-view plane. Pure canvas 2D, no images.

export function renderScene(ctx, state) {
  const { world, plane, width, height, time } = state;
  const cx = width / 2;
  const cy = height / 2;
  const focal = height * 1.05;

  // Chase camera: just behind and above the plane, looking where it points.
  const fx = Math.sin(plane.heading);
  const fz = -Math.cos(plane.heading);
  const camX = plane.x - fx * 11;
  const camY = plane.y + 3.4;
  const camZ = plane.z - fz * 11;
  const lookPitch = plane.pitch * 0.85;

  ctx.clearRect(0, 0, width, height);

  // World layer is rotated by the bank so the horizon tilts like a real turn.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll * 0.85);
  ctx.translate(-cx, -cy);

  drawSky(ctx, state, cx, cy, focal, lookPitch);
  drawSea(ctx, state, cx, cy, focal, lookPitch);
  drawIslands(ctx, state, camX, camY, camZ, focal, cx, cy, lookPitch);
  drawRunway(ctx, state, camX, camY, camZ, focal, cx, cy, lookPitch);
  drawRings(ctx, state, camX, camY, camZ, focal, cx, cy, lookPitch);
  drawClouds(ctx, state, camX, camY, camZ, focal, cx, cy, lookPitch, false);
  ctx.restore();

  // Near clouds drift past the camera after the world, so they feel close.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll * 0.85);
  ctx.translate(-cx, -cy);
  drawClouds(ctx, state, camX, camY, camZ, focal, cx, cy, lookPitch, true);
  ctx.restore();

  drawPlaneShadow(ctx, state, camX, camY, camZ, focal, cx, cy, lookPitch);
  drawPlane(ctx, state, cx, cy);
  drawVignette(ctx, width, height);
  drawNextRingArrow(ctx, state, camX, camY, camZ, focal, cx, cy, lookPitch);
}

// Project a world point into screen space. Returns null when behind camera.
function project(camX, camY, camZ, heading, pitch, focal, cx, cy, px, py, pz) {
  const dx = px - camX;
  const dy = py - camY;
  const dz = pz - camZ;
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);
  // Camera space: forward = (sin h, 0, -cos h), right = (cos h, 0, sin h).
  const rx = dx * cosH + dz * sinH;
  const fwd = dx * sinH - dz * cosH;
  const up = dy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const fz2 = fwd * cp + up * sp;
  const uy = -fwd * sp + up * cp;
  if (fz2 < 3) return null;
  return {
    x: cx + (rx / fz2) * focal,
    y: cy - (uy / fz2) * focal,
    scale: focal / fz2,
    dist: fz2,
  };
}

function horizonY(cy, pitch, focal) {
  return cy + Math.tan(pitch) * focal;
}

function drawSky(ctx, state, cx, cy, focal, pitch) {
  const { width, height } = state;
  const hy = horizonY(cy, pitch, focal);
  const grad = ctx.createLinearGradient(0, 0, 0, Math.max(hy, 1));
  grad.addColorStop(0, '#1b5f9e');
  grad.addColorStop(0.55, '#5ea8d8');
  grad.addColorStop(1, '#bfe3f2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, Math.max(hy, 0) + 1);

  // Sun: placed by azimuth relative to the heading, glowing warm.
  const sunAz = state.world.sun.azimuthDeg * Math.PI / 180;
  let rel = sunAz - state.plane.heading;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  const sunX = cx + Math.sin(rel) * focal * 1.15;
  const sunY = hy - Math.tan(state.world.sun.elevationDeg * Math.PI / 180) * focal * 0.9;
  if (sunX > -160 && sunX < width + 160 && sunY > -160) {
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
    glow.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 224, 140, 0.55)');
    glow.addColorStop(1, 'rgba(255, 224, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSea(ctx, state, cx, cy, focal, pitch) {
  const { width, height } = state;
  const hy = horizonY(cy, pitch, focal);
  if (hy >= height) return;
  const grad = ctx.createLinearGradient(0, hy, 0, height);
  grad.addColorStop(0, '#7fc4e2');
  grad.addColorStop(0.25, '#2f8fc0');
  grad.addColorStop(1, '#0d4f7d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, Math.max(hy, 0), width, height - Math.max(hy, 0));
  // Gentle swell lines, spaced by a slow clock so the sea feels alive.
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    const yy = hy + 26 + i * i * 3.4 + ((state.time * 6 + i * 37) % 14);
    if (yy > height) break;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.bezierCurveTo(width * 0.3, yy - 3, width * 0.7, yy + 3, width, yy);
    ctx.stroke();
  }
}

function drawIslands(ctx, state, camX, camY, camZ, focal, cx, cy, pitch) {
  const { world, plane } = state;
  const projected = [];
  for (const isl of world.islands) {
    const p = project(camX, camY, camZ, plane.heading, pitch, focal, cx, cy, isl.x, 0, isl.z);
    if (!p) continue;
    projected.push({ isl, p });
  }
  projected.sort((a, b) => b.p.dist - a.p.dist);
  for (const { isl, p } of projected) {
    const rx = isl.radius * p.scale;
    if (rx < 2) continue;
    const ry = Math.max(2, rx * 0.30);
    // Haze washes far islands pale.
    const haze = Math.min(0.65, p.dist / 4200);
    // Sand rim, then green body.
    ctx.fillStyle = mixColor(isl.sand, '#cfe8f2', haze);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 1.06, ry * 1.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mixColor(isl.green, '#cfe8f2', haze);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - ry * 0.18, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Peak: a darker hill rising from the middle of the island.
    const peakH = isl.peak * p.scale * 0.9;
    ctx.fillStyle = mixColor('#2c6b34', '#cfe8f2', haze);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - ry * 0.18 - peakH * 0.35, rx * 0.55, ry * 0.8 + peakH * 0.4, 0, Math.PI, 0);
    ctx.fill();
    drawLandmark(ctx, isl, p, rx, ry, haze);
    // Island name, readable when close.
    if (p.dist < 1500 && rx > 40) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `700 ${Math.max(11, Math.min(18, rx * 0.14))}px Verdana, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(isl.name.toUpperCase(), p.x, p.y - ry - peakH - 8);
    }
  }
}

function drawLandmark(ctx, isl, p, rx, ry, haze) {
  const s = p.scale;
  ctx.save();
  if (isl.landmark === 'lighthouse' && s > 0.12) {
    const h = 34 * s;
    ctx.fillStyle = mixColor('#f4f4f4', '#cfe8f2', haze);
    ctx.fillRect(p.x - 3 * s, p.y - ry * 0.5 - h, 6 * s, h);
    ctx.fillStyle = mixColor('#d23c2e', '#cfe8f2', haze);
    ctx.fillRect(p.x - 4 * s, p.y - ry * 0.5 - h, 8 * s, 7 * s);
  } else if (isl.landmark === 'town' && s > 0.1) {
    ctx.fillStyle = mixColor('#f2e6c8', '#cfe8f2', haze);
    for (let i = 0; i < 7; i++) {
      const ox = (i - 3) * rx * 0.16;
      const bh = (6 + ((i * 7) % 9)) * s;
      ctx.fillRect(p.x + ox - 3 * s, p.y - ry * 0.3 - bh, 6 * s, bh);
    }
    ctx.fillStyle = mixColor('#c65a3a', '#cfe8f2', haze);
    ctx.fillRect(p.x - rx * 0.5, p.y - ry * 0.3 - 10 * s, rx, 3 * s);
  } else if (isl.landmark === 'mountain' && s > 0.1) {
    const mh = isl.peak * s * 0.8;
    ctx.fillStyle = mixColor('#7d8a94', '#cfe8f2', haze);
    ctx.beginPath();
    ctx.moveTo(p.x - rx * 0.34, p.y - ry * 0.2);
    ctx.lineTo(p.x, p.y - ry * 0.2 - mh);
    ctx.lineTo(p.x + rx * 0.34, p.y - ry * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mixColor('#ffffff', '#cfe8f2', haze);
    ctx.beginPath();
    ctx.moveTo(p.x - rx * 0.08, p.y - ry * 0.2 - mh * 0.76);
    ctx.lineTo(p.x, p.y - ry * 0.2 - mh);
    ctx.lineTo(p.x + rx * 0.08, p.y - ry * 0.2 - mh * 0.76);
    ctx.closePath();
    ctx.fill();
  } else if (isl.landmark === 'turbines' && s > 0.1) {
    ctx.strokeStyle = mixColor('#eef4f6', '#cfe8f2', haze);
    ctx.lineWidth = Math.max(1, 2 * s);
    for (let i = -1; i <= 1; i++) {
      const tx = p.x + i * rx * 0.4;
      const ty = p.y - ry * 0.35;
      const th = 26 * s;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx, ty - th);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty - th, 7 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (isl.landmark === 'palms' && s > 0.12) {
    ctx.fillStyle = mixColor('#2f7d3e', '#cfe8f2', haze);
    for (let i = 0; i < 5; i++) {
      const ox = (i - 2) * rx * 0.22;
      ctx.beginPath();
      ctx.arc(p.x + ox, p.y - ry * 0.4, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawRunway(ctx, state, camX, camY, camZ, focal, cx, cy, pitch) {
  const { world, plane } = state;
  const r = world.runway;
  const hw = r.width / 2;
  // Clamp the strip to the half-space in front of the camera: the end behind
  // us (once we are rolling down it) cannot be projected, so cut it there.
  const fx = Math.sin(plane.heading);
  const fz = -Math.cos(plane.heading);
  const fwdAt = (z) => (r.x - camX) * fx + (z - camZ) * fz;
  const dStart = fwdAt(r.zStart);
  const dEnd = fwdAt(r.zEnd);
  const lo = Math.min(dStart, dEnd);
  const hi = Math.max(dStart, dEnd);
  if (hi < 4) return;
  const tAt = (d) => (d - dStart) / (dEnd - dStart);
  const zAt = (t) => r.zStart + (r.zEnd - r.zStart) * t;
  const t0 = Math.max(0, Math.min(1, tAt(Math.max(lo, 4))));
  const t1 = Math.max(0, Math.min(1, tAt(hi)));
  const zA = zAt(t0);
  const zB = zAt(t1);
  const corners = [
    project(camX, camY, camZ, plane.heading, pitch, focal, cx, cy, r.x - hw, 0.4, zA),
    project(camX, camY, camZ, plane.heading, pitch, focal, cx, cy, r.x + hw, 0.4, zA),
    project(camX, camY, camZ, plane.heading, pitch, focal, cx, cy, r.x + hw, 0.4, zB),
    project(camX, camY, camZ, plane.heading, pitch, focal, cx, cy, r.x - hw, 0.4, zB),
  ];
  // A runway is only drawn when at least two corners are in front of us.
  const visible = corners.filter(Boolean);
  if (visible.length < 2) return;
  ctx.fillStyle = '#4b5158';
  ctx.beginPath();
  const order = [corners[0], corners[1], corners[2], corners[3]];
  let started = false;
  for (const c of order) {
    if (!c) continue;
    if (!started) { ctx.moveTo(c.x, c.y); started = true; }
    else ctx.lineTo(c.x, c.y);
  }
  ctx.closePath();
  ctx.fill();
  // Pale edge stripes so the strip reads against the grass.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(1, 1.5);
  ctx.beginPath();
  const edgeL = [corners[0], corners[3]];
  const edgeR = [corners[1], corners[2]];
  for (const edge of [edgeL, edgeR]) {
    if (edge[0] && edge[1]) {
      ctx.moveTo(edge[0].x, edge[0].y);
      ctx.lineTo(edge[1].x, edge[1].y);
    }
  }
  ctx.stroke();
  // Centreline dashes, marching down the strip.
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = Math.max(1, 2.5);
  for (let z = r.zStart + 20; z < r.zEnd; z += 40) {
    const a = project(camX, camY, camZ, plane.heading, pitch, focal, cx, cy, r.x, 0.5, z);
    const b = project(camX, camY, camZ, plane.heading, pitch, focal, cx, cy, r.x, 0.5, z + 20);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Threshold chevrons at the near end.
  const t = project(camX, camY, camZ, plane.heading, pitch, focal, cx, cy, r.x, 0.5, r.zEnd - 8);
  if (t && t.dist < 900) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(10, Math.min(20, t.scale * 14))}px Verdana, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('18', t.x, t.y - 6);
  }
}

function drawRings(ctx, state, camX, camY, camZ, focal, cx, cy, pitch) {
  const { mission } = state;
  const list = state.world.rings.map((ring, i) => {
    const p = project(camX, camY, camZ, state.plane.heading, pitch, focal, cx, cy, ring.x, ring.y, ring.z);
    return { ring, i, p };
  }).filter((e) => e.p);
  list.sort((a, b) => b.p.dist - a.p.dist);
  for (const { ring, i, p } of list) {
    const passed = i < state.plane.ringsPassed;
    const isNext = mission.kind === 'rings' && i === state.plane.ringsPassed;
    const rr = ring.radius * p.scale;
    if (rr < 1.5) continue;
    ctx.lineWidth = Math.max(2, rr * 0.16);
    if (passed) {
      ctx.strokeStyle = 'rgba(125, 255, 176, 0.85)';
    } else if (isNext) {
      ctx.strokeStyle = '#ffd166';
      ctx.shadowColor = 'rgba(255, 209, 102, 0.9)';
      ctx.shadowBlur = 18;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (isNext && rr > 14) {
      ctx.fillStyle = '#ffd166';
      ctx.font = `700 ${Math.max(11, Math.min(18, rr * 0.4))}px Verdana, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${i + 1}`, p.x, p.y - rr - 8);
    }
  }
}

function drawClouds(ctx, state, camX, camY, camZ, focal, cx, cy, pitch, nearOnly) {
  for (const cloud of state.world.clouds) {
    const driftedX = cloud.x + state.time * cloud.drift;
    const p = project(camX, camY, camZ, state.plane.heading, pitch, focal, cx, cy, driftedX, cloud.y, cloud.z);
    if (!p) continue;
    const near = p.dist < 700;
    if (near !== nearOnly) continue;
    if (p.dist < 80) continue; // a cloud on the lens blinds the pilot
    const r = Math.min(200, cloud.size * p.scale);
    if (r < 2) continue;
    ctx.fillStyle = near ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.38, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - r * 0.55, p.y + r * 0.08, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + r * 0.55, p.y + r * 0.08, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlaneShadow(ctx, state, camX, camY, camZ, focal, cx, cy, pitch) {
  const { plane, world } = state;
  if (plane.y > 120) return;
  const ground = 0;
  const p = project(camX, camY, camZ, plane.heading, pitch, focal, cx, cy, plane.x, ground + 0.5, plane.z);
  if (!p) return;
  const alpha = Math.max(0, 0.35 - plane.y / 340);
  const rx = 26 * p.scale;
  ctx.fillStyle = `rgba(0, 20, 30, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, rx * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlane(ctx, state, cx, cy) {
  const { plane, width, height } = state;
  const px = cx;
  const py = height * 0.62;
  const size = 1.0;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(plane.roll * 0.55);
  ctx.scale(size, size);
  // Spinning prop blur.
  ctx.fillStyle = 'rgba(200, 220, 235, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -58, 74, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main wings, red-tipped.
  ctx.fillStyle = '#e8eef2';
  ctx.beginPath();
  ctx.moveTo(-150, -6); ctx.lineTo(150, -6); ctx.lineTo(138, 16); ctx.lineTo(-138, 16);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d23c2e';
  ctx.fillRect(-150, -6, 16, 22);
  ctx.fillRect(134, -6, 16, 22);
  // Tailplane.
  ctx.fillStyle = '#e8eef2';
  ctx.beginPath();
  ctx.moveTo(-58, 52); ctx.lineTo(58, 52); ctx.lineTo(48, 66); ctx.lineTo(-48, 66);
  ctx.closePath(); ctx.fill();
  // Fuselage, seen from behind and slightly above.
  const body = ctx.createLinearGradient(0, -70, 0, 70);
  body.addColorStop(0, '#f7fafc');
  body.addColorStop(0.6, '#dfe9ef');
  body.addColorStop(1, '#9fb4c0');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -72);
  ctx.bezierCurveTo(26, -60, 30, -20, 26, 30);
  ctx.bezierCurveTo(24, 58, 12, 70, 0, 70);
  ctx.bezierCurveTo(-12, 70, -24, 58, -26, 30);
  ctx.bezierCurveTo(-30, -20, -26, -60, 0, -72);
  ctx.fill();
  // Red cheatline and tail fin.
  ctx.fillStyle = '#d23c2e';
  ctx.fillRect(-26, 18, 52, 7);
  ctx.beginPath();
  ctx.moveTo(0, -70); ctx.lineTo(0, -108); ctx.lineTo(20, -66); ctx.lineTo(8, -62);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(0, -108); ctx.lineTo(0, -92); ctx.lineTo(10, -88);
  ctx.closePath(); ctx.fill();
  // Navigation lights.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath(); ctx.arc(-150, 5, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#39d353';
  ctx.beginPath(); ctx.arc(150, 5, 4, 0, Math.PI * 2); ctx.fill();
  // Registration on the tail.
  ctx.fillStyle = '#12303f';
  ctx.font = '700 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PK-MRP', 0, -76);
  ctx.restore();
}

function drawVignette(ctx, width, height) {
  const grad = ctx.createRadialGradient(
    width / 2, height / 2, height * 0.42, width / 2, height / 2, height * 0.95);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(2, 16, 28, 0.42)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawNextRingArrow(ctx, state, camX, camY, camZ, focal, cx, cy, pitch) {
  if (state.mission.kind !== 'rings') return;
  if (state.plane.ringsPassed >= state.world.rings.length) return;
  const ring = state.world.rings[state.plane.ringsPassed];
  const p = project(camX, camY, camZ, state.plane.heading, pitch, focal, cx, cy, ring.x, ring.y, ring.z);
  const { width, height } = state;
  const margin = 46;
  const off = !p || p.x < margin || p.x > width - margin || p.y < margin || p.y > height - margin;
  if (!off) return;
  const tx = p ? Math.max(margin, Math.min(width - margin, p.x)) : cx;
  const ty = p ? Math.max(margin, Math.min(height - margin, p.y)) : 60;
  const angle = Math.atan2(ty - height * 0.5, tx - width * 0.5);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEXT RING', tx, ty + 26);
}

function mixColor(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return `rgb(${r},${g},${bl})`;
}
