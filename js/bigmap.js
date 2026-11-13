// The big map: click the minimap (or press M). Scroll or +/- to zoom, drag to move,
// click to drop a target. The road arrows and the pink X lead you there. Esc or M closes it.
const $ = (id) => document.getElementById(id);

export class BigMap {
  constructor(G) {
    this.G = G;
    this.el = $('bigmap'); this.cv = $('bigmapCanvas'); this.ctx = this.cv.getContext('2d');
    this.scale = 0.5; this.cx = 0; this.cz = 0; // screen px per map px, view center in map px
    this.route = null;
    const cv = this.cv;
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) { this.hover = this.toWorld(e.clientX, e.clientY); return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 5) drag.moved = true;
      if (drag.moved) { this.cx = drag.cx - dx / this.scale; this.cz = drag.cz - dy / this.scale; }
    });
    cv.addEventListener('pointerup', (e) => {
      if (drag && !drag.moved && e.button === 0) this.drop(e.clientX, e.clientY);
      drag = null;
    });
    cv.addEventListener('contextmenu', (e) => { e.preventDefault(); this.G.setWaypoint(null); this.route = null; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    $('bmIn').onclick = () => this.zoomAt(innerWidth / 2, innerHeight / 2, 1.5);
    $('bmOut').onclick = () => this.zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.5);
    $('bmMe').onclick = () => this.center();
    $('bmClear').onclick = () => { this.G.setWaypoint(null); this.route = null; };
    $('bmClose').onclick = () => this.close();
    $('minimap').addEventListener('click', () => { if (this.G.mode === 'play') this.open(); });
    this.resize();
  }
  resize() { this.cv.width = innerWidth * Math.min(devicePixelRatio, 2); this.cv.height = innerHeight * Math.min(devicePixelRatio, 2); this.dpr = Math.min(devicePixelRatio, 2); }
  wm() { return this.G.world.wm; }
  toWorld(sx, sy) {
    const { x0, z0, cell } = this.wm();
    const mx = this.cx + (sx - innerWidth / 2) / this.scale, mz = this.cz + (sy - innerHeight / 2) / this.scale;
    return { x: x0 + mx * cell, z: z0 + mz * cell };
  }
  toScreen(x, z) {
    const { x0, z0, cell } = this.wm();
    return [innerWidth / 2 + ((x - x0) / cell - this.cx) * this.scale, innerHeight / 2 + ((z - z0) / cell - this.cz) * this.scale];
  }
  zoomAt(sx, sy, k) {
    const before = this.toWorld(sx, sy);
    this.scale = Math.min(6, Math.max(0.15, this.scale * k));
    const { x0, z0, cell } = this.wm();
    // keep the point under the cursor still
    this.cx = (before.x - x0) / cell - (sx - innerWidth / 2) / this.scale;
    this.cz = (before.z - z0) / cell - (sy - innerHeight / 2) / this.scale;
  }
  center() {
    const v = this.G.active, { x0, z0, cell } = this.wm();
    if (v) { this.cx = (v.pos.x - x0) / cell; this.cz = (v.pos.z - z0) / cell; }
  }
  open() {
    const G = this.G;
    if (G.mode !== 'play') return;
    G.mode = 'map';
    this.el.style.display = 'block';
    if (!this.opened) { this.scale = 0.55; this.opened = true; }
    this.center();
    this.makeRoute();
  }
  close() {
    this.el.style.display = 'none';
    this.G.mode = 'play';
  }
  drop(sx, sy) {
    const p = this.toWorld(sx, sy), W = this.G.world;
    if (!W.inBounds(p.x, p.z, 100)) return;
    this.G.setWaypoint(p);
    this.makeRoute();
  }
  // the road route to the target, for cars (the boat and the flyers go straight)
  makeRoute() {
    const G = this.G, v = G.active, w = G.waypoint, nav = G.nav;
    this.route = null;
    if (!w || !v || !nav || !nav.ok || v.kind === 'boat' || v.kind === 'air') return;
    const key = Math.round(w.x) + ',' + Math.round(w.z) + ',0';
    if (nav.targetKey !== key) { nav.targetKey = key; nav.solve(w); }
    let n = nav.nearestNode(v.pos.x, v.pos.z, v.y);
    const pts = [];
    for (let i = 0; i < 20000 && n >= 0; i++) { pts.push([nav.nx[n], nav.nz[n]]); n = nav.next[n]; }
    if (pts.length > 1) this.route = pts;
  }
  update(dt) {
    const G = this.G, input = G.input;
    if (input.map || input.pause) { this.close(); return; }
    const ctx = this.ctx, d = this.dpr, W = innerWidth, H = innerHeight;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#1d5470'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(this.scale, this.scale); ctx.translate(-this.cx, -this.cz);
    ctx.imageSmoothingEnabled = this.scale < 2;
    ctx.drawImage(G.hud.map, 0, 0);
    ctx.restore();
    // route
    if (this.route) {
      ctx.strokeStyle = 'rgba(255,79,216,0.9)'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      this.route.forEach(([x, z], i) => { const [sx, sy] = this.toScreen(x, z); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); });
      ctx.stroke();
    }
    // places and missions
    const marks = G.missions.minimapMarkers().concat(G.police.minimapMarkers());
    for (const m of marks) {
      const [sx, sy] = this.toScreen(m.x, m.z);
      ctx.fillStyle = m.color || '#ffb347'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, m.big ? 10 : 7, 0, 7); ctx.fill(); ctx.stroke();
      if (m.letter) { ctx.fillStyle = '#000'; ctx.font = 'bold 12px Helvetica'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m.letter, sx, sy + 0.5); }
    }
    for (const d2 of G.missions.defs) {
      if (!d2.marker.visible) continue;
      const [sx, sy] = this.toScreen(d2.pos.x, d2.pos.z);
      this.label(d2.name, sx, sy + 24);
    }
    // the target
    if (G.waypoint) {
      const [sx, sy] = this.toScreen(G.waypoint.x, G.waypoint.z);
      ctx.fillStyle = '#ff4fd8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 11, sy - 22); ctx.arc(sx, sy - 24, 11, Math.PI * 0.85, Math.PI * 0.15, false); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Helvetica'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('X', sx, sy - 24);
      const v = G.active, dist = Math.hypot(G.waypoint.x - v.pos.x, G.waypoint.z - v.pos.z) / 1609.34;
      this.label(dist.toFixed(1) + ' mi', sx, sy + 16);
    }
    // you
    const v = G.active;
    if (v) {
      const [sx, sy] = this.toScreen(v.pos.x, v.pos.z);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(-v.heading + Math.PI / 2);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d33'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 11); ctx.lineTo(0, 5); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // area name under the cursor
    if (this.hover) {
      const a = G.world.areaName(this.hover.x, this.hover.z, null);
      $('bmArea').textContent = a;
    }
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = 'bold 15px Helvetica'; ctx.textAlign = 'left';
    ctx.fillText('N ↑', 20, H - 20);
  }
  label(t, x, y) {
    const ctx = this.ctx;
    ctx.font = 'bold 13px Helvetica'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(t).width + 12;
    ctx.fillStyle = 'rgba(15,12,25,.75)'; ctx.fillRect(x - w / 2, y - 10, w, 20);
    ctx.fillStyle = '#fff'; ctx.fillText(t, x, y);
  }
}
