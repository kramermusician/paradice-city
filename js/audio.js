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
  const base = kind === 'boat' ? 55 : kind === 'truck' ? 38 : 48;
  const gearFrac = kind === 'car' ? (speedFrac * 5) % 1 : speedFrac;
  const f = base + gearFrac * (kind === 'truck' ? 50 : 110) + speedFrac * 40;
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
