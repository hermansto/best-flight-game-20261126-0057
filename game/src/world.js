// world.js — the archipelago: islands, runway, rings, clouds and sun.
// All layout is fixed numbers, so every flight sees the same recognisable map.

export function buildWorld() {
  // Islands: x (east), z (south), radius in metres, peak height, palette, landmark.
  const islands = [
    { name: 'Pulau Merpati', x: 0, z: 0, radius: 620, peak: 46, green: '#3f8f4a', sand: '#e8d9a0', landmark: 'runway' },
    { name: 'Pulau Hijau', x: -900, z: -750, radius: 480, peak: 70, green: '#2f7d3e', sand: '#e2cf92', landmark: 'lighthouse' },
    { name: 'Pulau Karang', x: 950, z: -620, radius: 420, peak: 38, green: '#4a9a52', sand: '#ead6a2', landmark: 'town' },
    { name: 'Pulau Tinggi', x: -350, z: -1650, radius: 560, peak: 150, green: '#2e6b38', sand: '#dcc98c', landmark: 'mountain' },
    { name: 'Pulau Angin', x: 1250, z: 350, radius: 380, peak: 30, green: '#55a05e', sand: '#e8d9a0', landmark: 'turbines' },
    { name: 'Pulau Kecil', x: -1150, z: 550, radius: 260, peak: 22, green: '#4a9a52', sand: '#ead6a2', landmark: 'palms' },
    { name: 'Pulau Selatan', x: 420, z: 1250, radius: 500, peak: 58, green: '#3a8a46', sand: '#e2cf92', landmark: 'town' },
    { name: 'Pulau Kabut', x: -1600, z: -1400, radius: 340, peak: 90, green: '#357a44', sand: '#dcc98c', landmark: 'mountain' },
  ];

  // The home strip on Pulau Merpati, running north-south (heading 000).
  const runway = {
    x: 0, zStart: -260, zEnd: 260, width: 34,
    headingDeg: 0, name: 'MERPATI STRIP 18/36',
  };

  // Ring course: a loop around the islands, heights in metres.
  const rings = [
    { x: 0, z: -480, y: 90, radius: 26 },
    { x: -520, z: -700, y: 120, radius: 26 },
    { x: -900, z: -750, y: 150, radius: 24 },
    { x: -700, z: -1350, y: 170, radius: 24 },
    { x: 150, z: -1500, y: 150, radius: 26 },
    { x: 950, z: -900, y: 130, radius: 24 },
    { x: 950, z: -620, y: 110, radius: 26 },
    { x: 600, z: 60, y: 90, radius: 26 },
  ];

  // Puffy clouds drifting slowly above the sea.
  const clouds = [];
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 46; i++) {
    clouds.push({
      x: (rand() - 0.5) * 5200,
      z: (rand() - 0.5) * 5200,
      y: 190 + rand() * 130,
      size: 60 + rand() * 120,
      drift: 2 + rand() * 3,
    });
  }

  const sun = { azimuthDeg: 215, elevationDeg: 38 };

  return { islands, runway, rings, clouds, sun, seaLevel: 0 };
}

export function islandHeightAt(world, x, z) {
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

export function isOnRunway(world, x, z) {
  const r = world.runway;
  return Math.abs(x - r.x) <= r.width / 2 && z >= r.zStart && z <= r.zEnd;
}

export function nextRingTarget(rings, passedCount) {
  return rings[passedCount % rings.length];
}
