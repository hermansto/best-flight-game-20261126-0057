// audio.js — synthesised WebAudio sounds only: engine drone, ring chime,
// landing thump and crash noise. No audio files, nothing fetched.

export function createAudio() {
  return {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    windGain: null,
    muted: false,
    started: false,
  };
}

export function ensureAudio(audio) {
  if (audio.started) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio.ctx = new AC();
  audio.started = true;

  // Engine: two detuned sawtooths through a low-pass filter.
  audio.engineGain = audio.ctx.createGain();
  audio.engineGain.gain.value = 0;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  audio.engineOsc = audio.ctx.createOscillator();
  audio.engineOsc.type = 'sawtooth';
  audio.engineOsc.frequency.value = 62;
  const osc2 = audio.ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = 93;
  const osc2Gain = audio.ctx.createGain();
  osc2Gain.gain.value = 0.4;
  audio.engineOsc.connect(filter);
  osc2.connect(osc2Gain);
  osc2Gain.connect(filter);
  filter.connect(audio.engineGain);
  audio.engineGain.connect(audio.ctx.destination);
  audio.engineOsc.start();
  osc2.start();
  audio.engineOsc2 = osc2;
  audio.engineFilter = filter;

  // Wind: looped noise buffer, gain follows airspeed.
  const len = audio.ctx.sampleRate * 2;
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = audio.ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const windFilter = audio.ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 700;
  audio.windGain = audio.ctx.createGain();
  audio.windGain.gain.value = 0;
  noise.connect(windFilter);
  windFilter.connect(audio.windGain);
  audio.windGain.connect(audio.ctx.destination);
  noise.start();
}

export function updateEngineSound(audio, plane) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const level = audio.muted ? 0 : 0.05 + plane.throttle * 0.075;
  audio.engineGain.gain.setTargetAtTime(level, t, 0.1);
  const freq = 52 + plane.throttle * 55 + plane.speed * 0.25;
  audio.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
  audio.engineOsc2.frequency.setTargetAtTime(freq * 1.5, t, 0.1);
  audio.engineFilter.frequency.setTargetAtTime(320 + plane.throttle * 500, t, 0.1);
  const wind = audio.muted ? 0 : Math.min(0.09, plane.speed * 0.0011);
  audio.windGain.gain.setTargetAtTime(wind, t, 0.15);
}

export function playChime(audio) {
  if (!audio.started || audio.muted) return;
  const notes = [880, 1174.66, 1567.98];
  notes.forEach((freq, i) => {
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = audio.ctx.currentTime + i * 0.09;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    osc.connect(gain);
    gain.connect(audio.ctx.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}

export function playThud(audio, hard) {
  if (!audio.started || audio.muted) return;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(hard ? 90 : 140, audio.ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(38, audio.ctx.currentTime + 0.25);
  gain.gain.setValueAtTime(hard ? 0.5 : 0.3, audio.ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audio.ctx.destination);
  osc.start();
  osc.stop(audio.ctx.currentTime + 0.32);
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  return audio.muted;
}
