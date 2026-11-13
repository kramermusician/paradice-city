// In-car radio: Kramer's covers, assets/music/NN.mp3 listed in tracks.json.
// Slots with an empty title or a missing file are skipped. No files at all: "Radio off air".
export class Radio {
  constructor(toast) { this.toast = toast; this.list = []; this.i = -1; this.el = new Audio(); this.el.volume = 0.6; this.started = false;
    this.el.addEventListener('ended', () => this.step(1, true)); }
  async load() {
    let tracks = [];
    try { tracks = (await (await fetch('assets/music/tracks.json')).json()).tracks || []; } catch (e) { tracks = []; }
    const ok = [];
    for (const t of tracks) {
      if (!t.title || !t.file) continue;
      try { const r = await fetch('assets/music/' + t.file, { method: 'HEAD' }); if (r.ok) ok.push(t); } catch (e) { /* skip */ }
    }
    this.list = ok;
  }
  tag() { const el = document.getElementById('radioTag'); if (el) el.textContent = this.i >= 0 ? 'Radio: ' + this.list[this.i].title : (this.list.length ? '' : 'Radio off air'); }
  start() { if (this.started) return; this.started = true; if (!this.list.length) { this.tag(); return; } this.step(1); }
  step(d, quiet) {
    if (!this.list.length) { this.toast('Radio off air'); this.tag(); return; }
    this.i = (this.i + d + this.list.length) % this.list.length;
    const t = this.list[this.i];
    this.el.src = 'assets/music/' + t.file;
    this.el.play().catch(() => {});
    if (!quiet) this.toast(`${t.title} (Kramer's cover)`);
    this.tag();
  }
}
