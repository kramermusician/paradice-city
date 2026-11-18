// HUD: speedometer, posted limit, area name, minimap, mission panel, toasts and cards.
import { MPH } from './config.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(world) {
    this.world = world;
    this.mini = $('minimap');
    this.mctx = this.mini.getContext('2d');
    this.buildMap();
    this.markers = [];
    this.toastT = 0;
    this.areaLast = '';
  }
  buildMap() {
    const w = this.world, { w: W, h: H, x0, z0, cell } = w.wm;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#1d5470'; x.fillRect(0, 0, W, H);
    x.drawImage(w.groundCanvas, 0, 0);
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const pass of [0, 1]) {
      for (const r of w.roads) {
        const major = /primary|secondary|trunk/.test(r.k);
        if (pass === 0 && major) continue;
        if (pass === 1 && !major) continue;
        x.strokeStyle = major ? '#f2d27a' : r.k === 'service' ? '#9a9a90' : '#e8e4da';
        x.lineWidth = Math.max(major ? 2.2 : 1, r.w / cell);
        x.beginPath();
        const p = r.p;
        for (let i = 0; i < p.length; i += 3) {
          const px = (p[i] - x0) / cell, pz = (p[i + 1] - z0) / cell;
          if (i === 0) x.moveTo(px, pz); else x.lineTo(px, pz);
        }
        x.stroke();
      }
    }
    for (const b of w.bList) {
      if (b.tiny) continue;   // St. Armands trunks, lamps, parked cars and statues are too small for the map
      x.fillStyle = b.armandsBld ? 'rgba(96,66,52,0.9)' : 'rgba(70,60,60,0.55)';   // St. Armands shops and back buildings read a little stronger
      x.beginPath();
      for (let i = 0; i < b.poly.length; i += 2) x.lineTo((b.poly[i] - x0) / cell, (b.poly[i + 1] - z0) / cell);
      x.fill();
    }
    this.map = c;
  }
  drawMinimap(v, markers) {
    const ctx = this.mctx, S = this.mini.width, { x0, z0, cell } = this.world.wm;
    const zoom = v.fly === 'jet' ? 0.25 : v.kind === 'air' ? 0.45 : v.kind === 'boat' ? 0.55 : Math.abs(v.speed) > 25 ? 0.7 : 1.0; // px per map px
    ctx.save();
    ctx.fillStyle = '#1d5470'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(v.heading - Math.PI / 2);
    ctx.scale(zoom, zoom);
    const px = (v.pos.x - x0) / cell, pz = (v.pos.z - z0) / cell;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.map, -px, -pz);
    for (const m of markers) {
      const mx = (m.x - x0) / cell - px, mz = (m.z - z0) / cell - pz;
      const r = Math.hypot(mx, mz) * zoom, lim = S / 2 - 8;
      let sx = mx, sz = mz;
      if (r > lim) { sx = mx * lim / r; sz = mz * lim / r; }
      ctx.save(); ctx.translate(sx, sz); ctx.rotate(-(v.heading - Math.PI / 2)); ctx.scale(1 / zoom, 1 / zoom);
      ctx.fillStyle = m.color || '#ffb347'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, m.big ? 7 : 5, 0, 7); ctx.fill(); ctx.stroke();
      if (m.letter) { ctx.fillStyle = '#000'; ctx.font = 'bold 9px Helvetica'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m.letter, 0, 0.5); }
      ctx.restore();
    }
    ctx.restore();
    // player arrow
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d33'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2 - 9); ctx.lineTo(S / 2 + 6, S / 2 + 7); ctx.lineTo(S / 2, S / 2 + 3); ctx.lineTo(S / 2 - 6, S / 2 + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    // north tick
    const na = -(v.heading - Math.PI / 2) - Math.PI / 2;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Helvetica'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', S / 2 + Math.cos(na) * (S / 2 - 10), S / 2 + Math.sin(na) * (S / 2 - 10));
  }
  update(dt, v, limit, area, markers) {
    $('speed').textContent = Math.round(Math.abs(v.speed) * MPH);
    const lim = $('limit');
    if (limit && v.kind !== 'boat') { lim.style.display = 'block'; $('limitNum').textContent = limit; } else lim.style.display = 'none';
    if (v.kind === 'air') { $('alt').style.display = 'block'; $('altNum').textContent = Math.max(0, Math.round(v.y * 3.281 / 10) * 10); } else $('alt').style.display = 'none';
    if (area !== this.areaLast) {
      this.areaLast = area;
      const a = $('area'); a.textContent = area; a.classList.remove('flash'); void a.offsetWidth; a.classList.add('flash');
    }
    this.drawMinimap(v, markers);
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').classList.remove('show'); }
  }
  toast(msg, t = 2.5) { const e = $('toast'); e.innerHTML = msg; e.classList.add('show'); this.toastT = t; }
  hint(msg) { const e = $('hint'); e.innerHTML = msg || ''; e.style.display = msg ? 'block' : 'none'; }
  mission(html) { const e = $('mission'); e.innerHTML = html || ''; e.style.display = html ? 'block' : 'none'; }
  card(title, body, buttons = []) {
    const e = $('card');
    e.innerHTML = `<h2>${title}</h2><div class="body">${body}</div><div class="btns"></div>`;
    const bx = e.querySelector('.btns');
    buttons.forEach(([label, fn], i) => {
      const b = document.createElement('button'); b.textContent = label;
      b.onclick = () => { this.closeCard(); fn(); };
      if (i === 0) b.classList.add('primary');
      bx.appendChild(b);
    });
    e.style.display = 'block';
    this.cardButtons = buttons;
  }
  closeCard() { $('card').style.display = 'none'; this.cardButtons = null; }
  cardOpen() { return $('card').style.display === 'block'; }
  progress(p) { const e = $('hold'); if (p <= 0) { e.style.display = 'none'; return; } e.style.display = 'block'; e.firstElementChild.style.width = Math.round(p * 100) + '%'; }
}
