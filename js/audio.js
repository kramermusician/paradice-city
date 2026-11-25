// Small synthesized sounds: engine, outboard, siren, helicopter rotor, chimes.
let ctx = null, master = null, tap = null;
const eng = {};

// ---------------------------------------------------------------- engine (rebuilt 2026-11-25)
// The old engine was a sawtooth and a square wave through one filter: a buzz that jumped in pitch five times
// on the way to top speed. This one is built the way an engine sounds from the driver's seat:
//   - a tone made of the firing harmonics of a real cylinder count (PeriodicWave), two slightly detuned copies,
//     kept dark by a low-pass that only opens with the throttle
//   - a gearbox: six gears with hysteresis, rpm glides between them instead of snapping
//   - low exhaust rumble (filtered noise) under load
//   - tyre and wind noise that grow with speed, so cruising is mostly a soft rush, not a drone
// Each car has a voice (V8, flat six, straight six, boxer four, electric). Electric cars only whine a little.
// Volume: setEngineVolume(0..1), from the pause menu (Engine sound: normal, quiet, off).
const VOICES = {
  v8:     { cyl: 4, rough: 0.55, idle: 700, red: 5600, tilt: 1.15, gain: 1.0 },    // cross-plane burble (4 firing pulses a rev)
  flat6:  { cyl: 3, rough: 0.18, idle: 850, red: 7000, tilt: 0.95, gain: 0.9 },
  i6:     { cyl: 3, rough: 0.08, idle: 750, red: 6000, tilt: 1.25, gain: 0.85 },
  boxer4: { cyl: 2, rough: 0.5, idle: 750, red: 5600, tilt: 1.2, gain: 0.9 },      // Subaru rumble
  i4:     { cyl: 2, rough: 0.12, idle: 800, red: 6000, tilt: 1.2, gain: 0.85 },
  diesel: { cyl: 3, rough: 0.7, idle: 600, red: 2400, tilt: 1.0, gain: 1.1 },
  ev:     { ev: true },
};
const CAR_VOICE = { 'porsche-911': 'flat6', 'porsche-gt3': 'flat6', 'amg-gle63': 'v8', 'bugatti-veyron': 'v8', 'mustang-cobra-jet': 'v8',
  'firebird-70': 'v8', 'rr-phantom': 'v8', 'lego-corvette': 'v8', 'bmw-7': 'i6', 'bmw-530i': 'i6', 'bmw-z4m': 'i6', 'audi-tt': 'i6',
  'subaru-outback': 'boxer4', 'subaru-outback-22': 'boxer4', 'lucid-air': 'ev', 'rr-spectre': 'ev', 'golf-cart': 'ev', 'fire-truck': 'diesel', semi: 'diesel' };
const GEARS = [0, 0.11, 0.24, 0.4, 0.58, 0.78, 1.001];
let engVol = 1, voiceId = '', gear = 0;
export function setEngineVolume(v) { engVol = v; }
export function setVoice(carId) {
  const id = CAR_VOICE[carId] || 'i4';
  if (!ctx || id === voiceId) { voiceId = ctx ? id : ''; if (!ctx) pendingVoice = carId; return; }
  voiceId = id; const v = VOICES[id]; if (v.ev) return;
  const N = 64, re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    // n counts half-revolutions of the crank. Firing harmonics sit at multiples of cyl; the rest is roughness.
    const k = n / v.cyl, onFire = Math.abs(k - Math.round(k)) < 1e-6;
    const a = (onFire ? 1 : v.rough * (n % 2 ? 0.55 : 0.3)) / Math.pow(Math.max(1, k), v.tilt);
    const ph = Math.sin(n * 12.9898) * 43758.5453; const p = (ph - Math.floor(ph)) * 6.283;
    re[n] = a * Math.cos(p); im[n] = a * Math.sin(p);
  }
  const w = ctx.createPeriodicWave(re, im);
  eng.o1.setPeriodicWave(w); eng.o2.setPeriodicWave(w);
}
let pendingVoice = null;
function noiseBuf(sec, brown) {
  const len = ctx.sampleRate * sec, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return buf;
}
function noiseSrc(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    tap = ctx.createAnalyser(); tap.fftSize = 2048; master.connect(tap);
    // tone
    eng.o1 = ctx.createOscillator(); eng.o2 = ctx.createOscillator();
    eng.f = ctx.createBiquadFilter(); eng.f.type = 'lowpass'; eng.f.frequency.value = 300; eng.f.Q.value = 0.6;
    eng.hp = ctx.createBiquadFilter(); eng.hp.type = 'highpass'; eng.hp.frequency.value = 38;
    eng.g = ctx.createGain(); eng.g.gain.value = 0;
    eng.o1.connect(eng.f); eng.o2.connect(eng.f); eng.f.connect(eng.hp); eng.hp.connect(eng.g); eng.g.connect(master);
    eng.o1.start(); eng.o2.start();
    // exhaust rumble, tyres, wind, electric whine
    const brown = noiseBuf(3, true), white = noiseBuf(2, false);
    const chain = (src, type, freq, q) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(master); return { f, g }; };
    eng.rumble = chain(noiseSrc(brown), 'lowpass', 160, 0.7);
    eng.road = chain(noiseSrc(brown), 'bandpass', 420, 0.5);
    eng.wind = chain(noiseSrc(white), 'bandpass', 1500, 0.4);
    eng.whine = ctx.createOscillator(); eng.whine.type = 'sine'; eng.whineG = ctx.createGain(); eng.whineG.gain.value = 0;
    eng.whine.connect(eng.whineG); eng.whineG.connect(master); eng.whine.start();
    setVoice(pendingVoice || 'bmw-530i');
  } catch (e) { ctx = null; }
}
// 0..1 loudness at the output right now (tests only)
export function level() {
  if (!tap) return 0; const d = new Float32Array(tap.fftSize); tap.getFloatTimeDomainData(d);
  let s = 0, pk = 0; for (const x of d) { s += x * x; pk = Math.max(pk, Math.abs(x)); } return { rms: Math.sqrt(s / d.length), peak: pk };
}
export function engine(speedFrac, throttle, kind, on = true) {
  if (!ctx) return;
  const t = ctx.currentTime, set = (p, v, tc = 0.08) => p.setTargetAtTime(v, t, tc);
  const vol = on ? engVol : 0;
  const car = kind === 'car' || kind === 'truck';
  const v = VOICES[kind === 'truck' ? 'diesel' : voiceId] || VOICES.i4;
  let tone = 0, rumble = 0, road = 0, wind = 0, whine = 0, f = 60, cut = 300;
  if (car && v.ev) {
    whine = 0.012 + 0.02 * throttle; set(eng.whine.frequency, 260 + speedFrac * 1500, 0.12);
    road = 0.5 * Math.pow(speedFrac, 1.2); wind = 0.22 * speedFrac * speedFrac;
  } else if (car) {
    // gearbox with hysteresis
    while (gear < 5 && speedFrac > GEARS[gear + 1]) gear++;
    while (gear > 0 && speedFrac < GEARS[gear] - 0.025) gear--;
    const span = GEARS[gear + 1] - GEARS[gear];
    let rf = gear === 0 ? speedFrac / span : 0.32 + 0.68 * (speedFrac - GEARS[gear]) / span;
    rf = Math.max(0, Math.min(1, rf)) * (0.72 + 0.28 * throttle);          // lifting off lets the revs sag
    const rpm = v.idle + rf * (v.red - v.idle) * 0.82;
    f = rpm / 120;                                                         // half the crank rate: harmonic n = n half-revolutions
    cut = 170 + rf * 380 + throttle * (500 + rf * 900);
    tone = (0.05 + 0.07 * throttle + 0.02 * rf) * v.gain;
    rumble = 0.25 + 0.75 * throttle;
    road = 0.5 * Math.pow(speedFrac, 1.2); wind = 0.2 * speedFrac * speedFrac;
    set(eng.rumble.f.frequency, 110 + rf * 160);
  } else {
    // boat, jet, jetpack, helicopter: one smooth range, no gears
    const base = kind === 'boat' ? 26 : kind === 'jet' ? 45 : kind === 'jetpack' ? 60 : 16;
    f = base + speedFrac * (kind === 'jet' ? 90 : kind === 'heli' ? 8 : 40) + throttle * 6;
    cut = kind === 'jet' ? 500 + throttle * 2500 : 220 + throttle * 700 + speedFrac * 400;
    tone = kind === 'jet' || kind === 'jetpack' ? 0.03 + 0.03 * throttle : 0.05 + 0.06 * throttle;
    rumble = kind === 'boat' ? 0.5 + 0.6 * throttle : 0.3;
    wind = kind === 'jet' ? 0.5 + 0.9 * throttle : kind === 'jetpack' ? 0.25 + 0.7 * throttle : kind === 'boat' ? 0.35 * speedFrac : 0.2 * speedFrac;
    road = kind === 'boat' ? 0.5 * speedFrac : 0;                         // hull slap and wash
    set(eng.rumble.f.frequency, kind === 'jet' ? 400 : 150);
  }
  set(eng.o1.frequency, f, 0.11); set(eng.o2.frequency, f * 1.006, 0.11);
  set(eng.f.frequency, cut, 0.1);
  set(eng.g.gain, tone * vol, 0.1);
  set(eng.rumble.g.gain, rumble * 0.11 * vol, 0.12);
  set(eng.road.g.gain, road * 0.16 * vol, 0.2); set(eng.road.f.frequency, 300 + speedFrac * 420, 0.2);
  set(eng.wind.g.gain, wind * 0.05 * vol, 0.25); set(eng.wind.f.frequency, 900 + speedFrac * 1600, 0.25);
  set(eng.whineG.gain, whine * vol, 0.1);
}
let siren = null;
export function setSiren(on) {
  if (!ctx) return;
  if (on && !siren) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.9;
    const lg = ctx.createGain(); lg.gain.value = 260;
    lfo.connect(lg); lg.connect(o.frequency); o.frequency.value = 880;
    const g = ctx.createGain(); g.gain.value = 0.07;
    o.connect(g); g.connect(master); o.start(); lfo.start();
    siren = { o, lfo, g };
  } else if (!on && siren) { siren.o.stop(); siren.lfo.stop(); siren = null; }
}
let rotor = null;
export function setRotor(n) {
  if (!ctx) return;
  if (n > 0 && !rotor) {
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 11;
    const lg = ctx.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(master); src.start(); lfo.start();
    rotor = { src, lfo, g, lg };
  }
  if (rotor) rotor.lg.gain.value = Math.min(0.3, n * 0.1);
  if (n === 0 && rotor) { rotor.src.stop(); rotor.lfo.stop(); rotor = null; }
}
export function chime(kind = 'good') {
  if (!ctx) return;
  const notes = kind === 'good' ? [660, 880, 1320] : kind === 'win' ? [523, 659, 784, 1046] : [300, 220];
  notes.forEach((fr, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
    const g = ctx.createGain(); const t = ctx.currentTime + i * 0.11;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
  });
}
export function splashSound() {
  if (!ctx) return;
  const len = ctx.sampleRate * 0.8, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
  s.connect(f); f.connect(master); s.start();
}

// Tire screech: filtered noise through two narrow bands so it squeals instead of hissing.
let tire = null;
export function screech(level) {
  if (!ctx) return;
  if (level > 0 && !tire) {
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1500; f1.Q.value = 22;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2250; f2.Q.value = 28;
    const g2 = ctx.createGain(); g2.gain.value = 0.6;
    const wob = ctx.createOscillator(); wob.frequency.value = 6.5;
    const wg = ctx.createGain(); wg.gain.value = 70;
    wob.connect(wg); wg.connect(f1.frequency); wg.connect(f2.frequency);
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f1); src.connect(f2); f1.connect(g); f2.connect(g2); g2.connect(g); g.connect(master);
    src.start(); wob.start();
    tire = { f1, f2, g };
  }
  if (!tire) return;
  const t = ctx.currentTime;
  tire.g.gain.setTargetAtTime(level > 0 ? 0.9 + level * 1.3 : 0, t, level > 0 ? 0.04 : 0.09);
  if (level > 0) {
    tire.f1.frequency.setTargetAtTime(1350 + level * 420, t, 0.1);
    tire.f2.frequency.setTargetAtTime(2050 + level * 600, t, 0.1);
  }
}

// Fly-by whoosh for the stunt plane (2026-11-22): noise swept through a band filter, loud then fading.
export function whoosh() {
  if (!ctx) return;
  const len = ctx.sampleRate * 1.6, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  const t = ctx.currentTime;
  f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.7); f.frequency.exponentialRampToValueAtTime(300, t + 1.6);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(110, t + 1.6);
  const og = ctx.createGain(); og.gain.value = 0.18;
  s.connect(f); f.connect(g); o.connect(og); og.connect(g); g.connect(master); s.start(t); o.start(t); o.stop(t + 1.6);
}
