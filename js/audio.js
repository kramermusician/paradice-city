// Small synthesized sounds: engine hum, outboard, siren, helicopter rotor, chimes.
let ctx = null, master = null;
const eng = {};
export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    eng.o1 = ctx.createOscillator(); eng.o1.type = 'sawtooth';
    eng.o2 = ctx.createOscillator(); eng.o2.type = 'square';
    eng.f = ctx.createBiquadFilter(); eng.f.type = 'lowpass'; eng.f.frequency.value = 500;
    eng.g = ctx.createGain(); eng.g.gain.value = 0;
    eng.o1.connect(eng.f); eng.o2.connect(eng.f); eng.f.connect(eng.g); eng.g.connect(master);
    eng.o1.start(); eng.o2.start();
  } catch (e) { ctx = null; }
}
export function engine(speedFrac, throttle, kind, on = true) {
  if (!ctx) return;
  const base = kind === 'boat' ? 55 : kind === 'truck' ? 38 : kind === 'jet' ? 70 : kind === 'jetpack' ? 95 : kind === 'heli' ? 30 : 48;
  const gearFrac = kind === 'car' ? (speedFrac * 5) % 1 : speedFrac;
  const f = base + gearFrac * (kind === 'truck' ? 50 : kind === 'jet' ? 260 : kind === 'heli' ? 20 : 110) + speedFrac * 40;
  const t = ctx.currentTime;
  eng.o1.frequency.setTargetAtTime(f, t, 0.05);
  eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  eng.f.frequency.setTargetAtTime(300 + throttle * 900 + speedFrac * 600, t, 0.08);
  eng.g.gain.setTargetAtTime(on ? 0.05 + throttle * 0.06 : 0, t, 0.1);
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
