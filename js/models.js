// Low-poly procedural models built in code (no logos, no downloads).
// Convention: front faces +X, up is +Y, ground at y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROPS } from './props.js';

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...opts });
const L = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
const E = (color, i = 1.5) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: i });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(r, h, mat, x, y, z, axis = 'z', seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  if (axis === 'z') m.rotation.x = Math.PI / 2; else if (axis === 'x') m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}
function wheel(x, y, z, r = 0.5, w = 0.32) {
  const g = new THREE.Group();
  g.add(cyl(r, w, L(0x1b1b1d), 0, 0, 0, 'z', 14));
  g.add(cyl(r * 0.55, w + 0.02, M(0xc9ccd0, { metalness: 0.6, roughness: 0.3 }), 0, 0, 0, 'z', 10));
  g.position.set(x, y, z);
  return g;
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- pinwheel antenna
export function makePinwheel() {
  const g = new THREE.Group();
  const pole = cyl(0.012, 0.7, L(0x333333), 0, 0.35, 0, 'y', 5);
  g.add(pole);
  const hub = new THREE.Group();
  hub.position.set(0.03, 0.72, 0);
  const cols = [0xff3b6b, 0xffc93c, 0x2ec4b6, 0x3d7dff];
  for (let i = 0; i < 4; i++) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(0.13, 0.02); shape.lineTo(0.02, 0.15); shape.lineTo(0, 0);
    const blade = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: cols[i], side: THREE.DoubleSide, emissive: cols[i], emissiveIntensity: 0.25 }));
    blade.rotation.y = Math.PI / 2;
    const holder = new THREE.Group();
    holder.rotation.x = i * Math.PI / 2;
    holder.add(blade);
    hub.add(holder);
  }
  hub.add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), L(0xffffff)));
  g.add(hub);
  g.userData.hub = hub;
  return g;
}

// ---------------------------------------------------------------- mission marker
export function makeMarker(color = 0xffb347, label = '') {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 40, 24, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  beam.position.y = 20;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.3, 6, 40), new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
  g.add(beam, ring);
  if (label) {
    const tex = canvasTex(512, 128, (c, w, h) => {
      c.fillStyle = 'rgba(20,20,30,0.75)'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 30); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold 54px Helvetica, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, w / 2, h / 2 + 2);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false }));
    sp.scale.set(16, 4, 1); sp.position.y = 12;
    sp.renderOrder = 10;
    g.add(sp);
  }
  g.userData.ring = ring;
  return g;
}

// ---------------------------------------------------------------- soccer-ball stone crab buoy
let soccerTex = null;
function soccerTexture() {
  if (soccerTex) return soccerTex;
  soccerTex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#111';
    const pent = (x, y, r) => { c.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill(); };
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) pent(i * 86 + (row % 2) * 43 + 20, 40 + row * 88, 24);
    c.strokeStyle = '#333'; c.lineWidth = 3;
    for (let y = 0; y < h; y += 44) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + 10); c.stroke(); }
  });
  return soccerTex;
}
export function makeBuoy() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshStandardMaterial({ map: soccerTexture(), roughness: 0.5 }));
  ball.position.y = 0.25; ball.castShadow = true;
  const stick = cyl(0.03, 1.2, L(0xffffff), 0, 0.9, 0, 'y', 5);
  const flag = box(0.02, 0.22, 0.32, L(0xff6a00), 0, 1.4, 0.17);
  const glow = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 24), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05;
  g.add(ball, stick, flag, glow);
  g.userData.glow = glow;
  return g;
}

// ---------------------------------------------------------------- cranberry crate
let crateMats = null;
export function crateMaterials() {
  if (crateMats) return crateMats;
  const wood = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#9b6a3c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#8a5c33' : '#a87444'; c.fillRect(0, i * 32 + 2, w, 28); }
    c.strokeStyle = '#5b3a1e'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
  });
  const berries = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#5a0010'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 4 + Math.random() * 4;
      const gr = c.createRadialGradient(x - 1, y - 1, 0, x, y, r);
      gr.addColorStop(0, '#ff6a7a'); gr.addColorStop(0.5, '#d0102c'); gr.addColorStop(1, '#6a0010');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
  });
  const side = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.8 });
  const top = new THREE.MeshStandardMaterial({ map: berries, emissive: 0xff1030, emissiveIntensity: 0.55, emissiveMap: berries, roughness: 0.5 });
  crateMats = [side, side, top, side, side, side];
  return crateMats;
}
export function makeCrate(s = 1.1) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), crateMaterials());
  m.castShadow = true;
  return m;
}

// ---------------------------------------------------------------- semi tractor and reefer trailer
export function makeTractor() {
  const g = new THREE.Group();
  const white = M(0xf2f2f0, { metalness: 0.3, roughness: 0.35 });
  const red = M(0xb0102a, { metalness: 0.3, roughness: 0.4 });
  const dark = L(0x222428);
  const chrome = M(0xdfe3e8, { metalness: 0.9, roughness: 0.2 });
  const glass = M(0x1d2a33, { metalness: 0.5, roughness: 0.1 });
  g.add(box(6.6, 0.35, 1.0, dark, -0.4, 0.95, 0));               // frame
  g.add(box(2.0, 1.25, 2.3, white, 2.25, 1.65, 0));              // hood
  g.add(box(0.15, 1.0, 1.9, chrome, 3.3, 1.5, 0));               // grille
  g.add(box(2.2, 2.3, 2.45, white, 0.3, 2.35, 0));               // cab
  g.add(box(0.05, 0.9, 2.1, glass, 1.43, 2.85, 0));              // windshield
  g.add(box(1.4, 0.75, 0.03, glass, 0.4, 2.9, 1.23)); g.add(box(1.4, 0.75, 0.03, glass, 0.4, 2.9, -1.23));
  g.add(box(1.6, 2.0, 2.45, white, -1.5, 2.2, 0));               // sleeper
  g.add(box(3.6, 0.12, 2.47, red, 0.0, 1.55, 0));                // stripe
  g.add(box(0.5, 0.25, 2.5, chrome, 3.35, 0.95, 0));             // bumper
  for (const s of [-1, 1]) {
    g.add(cyl(0.12, 3.2, chrome, -0.6, 3.0, s * 1.15, 'y', 8));  // stacks
    g.add(box(0.6, 0.5, 0.3, chrome, 1.3, 2.8, s * 1.38));       // mirrors
    g.add(cyl(0.35, 1.2, chrome, 0.9, 1.1, s * 1.05, 'x', 10));  // tanks
    g.add(box(0.2, 0.18, 0.4, E(0xfff2c4, 2.5), 3.32, 1.35, s * 0.85)); // headlights
  }
  g.add(box(1.6, 0.12, 1.5, dark, -2.5, 1.2, 0));                // fifth wheel
  for (const [x, z] of [[2.4, 1.05], [2.4, -1.05], [-1.9, 1.05], [-1.9, -1.05], [-3.2, 1.05], [-3.2, -1.05]]) g.add(wheel(x, 0.52, z, 0.52, 0.36));
  g.userData.hitch = -2.5;
  g.userData.length = 7.2;
  return g;
}

export function makeTrailer(len = 14.6) {
  const g = new THREE.Group();
  const white = M(0xf4f4f2, { roughness: 0.45, metalness: 0.15 });
  const dark = L(0x2a2a2e);
  const wallTex = canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#f4f4f2'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d8d8d4'; c.lineWidth = 3;
    for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    // a big cranberry cluster graphic and plain words
    for (let i = 0; i < 26; i++) {
      const x = 170 + Math.cos(i * 2.4) * (i * 3.2), y = 128 + Math.sin(i * 2.4) * (i * 2.6), r = 18 + (i % 3) * 3;
      const gr = c.createRadialGradient(x - 5, y - 5, 2, x, y, r);
      gr.addColorStop(0, '#ff7a88'); gr.addColorStop(0.5, '#c8102e'); gr.addColorStop(1, '#6a0010');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
    c.fillStyle = '#2f7d32'; c.beginPath(); c.ellipse(150, 52, 40, 14, -0.4, 0, 7); c.fill();
    c.fillStyle = '#b0102a'; c.font = 'bold 92px Georgia, serif'; c.fillText('Cranberries', 330, 150);
    c.fillStyle = '#555'; c.font = '34px Helvetica, Arial'; c.fillText('Fresh frozen, Sarasota cold storage', 336, 205);
  });
  const wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.45 });
  const H = 2.2, W = 2.55, y0 = 1.35;
  const side = new THREE.Mesh(new THREE.PlaneGeometry(len, H), wall);
  side.position.set(-len / 2, y0 + H / 2, W / 2); side.castShadow = true;
  const side2 = side.clone(); side2.position.z = -W / 2; side2.rotation.y = Math.PI;
  g.add(side, side2);
  g.add(box(len, 0.25, W, dark, -len / 2, y0, 0));                 // floor
  g.add(box(0.12, H, W, white, -0.06, y0 + H / 2, 0));            // front wall
  g.add(box(0.12, H * 0.45, W, white, -len + 0.06, y0 + H * 0.22, 0)); // low tailgate (open top)
  g.add(box(0.5, 1.2, 2.0, L(0x9aa0a6), 0.25, y0 + 1.4, 0));       // reefer unit
  g.add(box(0.06, 0.7, 1.5, L(0x55595e), 0.51, y0 + 1.4, 0));
  for (const s of [-1, 1]) {
    g.add(box(len, 0.1, 0.08, M(0xb0102a), -len / 2, y0 + H, s * (W / 2 + 0.02)));
    g.add(box(0.1, 0.2, 0.3, E(0xff2020, 2), -len - 0.02, y0 + 0.2, s * 1.0));
  }
  for (const x of [-len + 1.4, -len + 2.7]) for (const s of [-1, 1]) g.add(wheel(x, 0.52, s * 1.05, 0.52, 0.4));
  g.add(box(0.2, 1.0, 0.2, dark, -3.0, 0.7, 0.9)); g.add(box(0.2, 1.0, 0.2, dark, -3.0, 0.7, -0.9)); // landing gear
  // crate slots: 2 wide, 9 long, 2 high
  const slots = [];
  for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 9; i++) for (const s of [-0.6, 0.6])
    slots.push(new THREE.Vector3(-1.0 - i * 1.45, y0 + 0.55 + layer * 0.92, s));
  g.userData.slots = slots;
  g.userData.length = len;
  const crates = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.88, 1.1), crateMaterials(), slots.length);
  const o = new THREE.Object3D();
  slots.forEach((p, i) => { o.position.copy(p); o.updateMatrix(); crates.setMatrixAt(i, o.matrix); });
  crates.castShadow = true;
  g.add(crates);
  g.userData.crates = crates;
  g.userData.setCount = (n) => { crates.count = Math.max(0, Math.min(slots.length, n)); };
  return g;
}

// ---------------------------------------------------------------- golf cart with a driver
export function makeGolfCart(color = 0xffffff, shirt = 0x3a7bd5) {
  const g = new THREE.Group();
  const body = M(color, { roughness: 0.4 });
  g.add(box(2.4, 0.35, 1.2, body, 0, 0.55, 0));
  g.add(box(0.6, 0.55, 1.15, body, 0.95, 0.85, 0));
  g.add(box(0.9, 0.35, 1.0, L(0x2b2b2b), -0.1, 0.9, 0));            // seat
  g.add(box(0.15, 0.55, 1.0, L(0x2b2b2b), -0.5, 1.2, 0));
  for (const [x, z] of [[0.6, 0.55], [0.6, -0.55], [-0.6, 0.55], [-0.6, -0.55]]) g.add(cyl(0.035, 1.25, L(0x999999), x, 1.6, z, 'y', 5));
  g.add(box(1.55, 0.06, 1.3, body, 0, 2.23, 0));                   // roof
  g.add(box(0.5, 0.5, 1.0, L(0x444444), -1.1, 1.05, 0));            // bag well
  g.add(cyl(0.12, 0.8, L(0x2e6b3a), -1.1, 1.45, 0.25, 'y', 8));     // golf bag
  for (const [x, z] of [[0.8, 0.55], [0.8, -0.55], [-0.75, 0.55], [-0.75, -0.55]]) g.add(wheel(x, 0.24, z, 0.24, 0.16));
  // driver
  const skin = L(0xe0b48c);
  const d = new THREE.Group();
  d.add(box(0.35, 0.55, 0.42, L(shirt), 0, 1.35, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skin); head.position.set(0, 1.78, 0); d.add(head);
  d.add(box(0.12, 0.04, 0.3, L(0xffffff), 0.14, 1.86, 0));          // visor brim
  d.add(box(0.26, 0.06, 0.3, L(0xffffff), 0.0, 1.9, 0));
  d.add(box(0.3, 0.12, 0.12, skin, 0.25, 1.25, 0.2)); d.add(box(0.3, 0.12, 0.12, skin, 0.25, 1.25, -0.2));
  d.position.set(-0.15, 0, 0.27);
  g.add(d);
  return g;
}

// ---------------------------------------------------------------- police SUV (generic, no markings beyond a word)
// The Ford Explorer police model from the Dropbox set, with our own light bar on the roof
// (its flashing is driven by swapping the red and blue materials). Null if it did not load.
function explorer() {
  if (!PROPS.police) return null;
  const m = PROPS.police.clone(true);
  m.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const g = new THREE.Group(); g.add(m);
  return g;
}
export function makePoliceSUV() {
  const ex = explorer();
  if (ex) {
    const red = E(0xff1a1a, 0.2), blue = E(0x1a4dff, 0.2);
    const lb = new THREE.Group(); lb.position.set(-0.35, 1.78, 0);
    lb.add(box(0.3, 0.14, 0.62, red, 0, 0, 0.36)); lb.add(box(0.3, 0.14, 0.62, blue, 0, 0, -0.36));
    ex.add(lb); ex.userData.red = red; ex.userData.blue = blue;
    return ex;
  }
  const g = new THREE.Group();
  const white = M(0xf5f5f5, { metalness: 0.4, roughness: 0.35 });
  const navy = M(0x1b2a4a, { metalness: 0.4, roughness: 0.35 });
  const glass = M(0x111820, { metalness: 0.5, roughness: 0.1 });
  g.add(box(5.0, 0.9, 2.0, navy, 0, 0.85, 0));
  g.add(box(3.0, 0.8, 1.9, white, -0.4, 1.7, 0));
  g.add(box(0.05, 0.6, 1.7, glass, 1.12, 1.75, 0));
  g.add(box(2.4, 0.5, 0.03, glass, -0.4, 1.8, 0.96)); g.add(box(2.4, 0.5, 0.03, glass, -0.4, 1.8, -0.96));
  g.add(box(4.0, 0.3, 2.02, white, 0.2, 1.05, 0));
  const lb = new THREE.Group(); lb.position.set(-0.3, 2.2, 0);
  const red = E(0xff1a1a, 0.2), blue = E(0x1a4dff, 0.2);
  lb.add(box(0.35, 0.18, 0.7, red, 0, 0, 0.4)); lb.add(box(0.35, 0.18, 0.7, blue, 0, 0, -0.4));
  g.add(lb);
  g.userData.red = red; g.userData.blue = blue;
  for (const s of [-1, 1]) g.add(box(0.1, 0.18, 0.4, E(0xffffee, 2), 2.5, 0.95, s * 0.7));
  for (const [x, z] of [[1.6, 0.95], [1.6, -0.95], [-1.6, 0.95], [-1.6, -0.95]]) g.add(wheel(x, 0.42, z, 0.42, 0.3));
  const tex = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#1b2a4a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 40px Helvetica, Arial'; c.textAlign = 'center'; c.fillText('POLICE', w / 2, 46); });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: tex })); p.position.set(0.2, 0.9, s * 1.01); if (s < 0) p.rotation.y = Math.PI; g.add(p); }
  return g;
}

// ---------------------------------------------------------------- helicopter with a searchlight
export function makeHelicopter(opt = {}) {
  const g = new THREE.Group();
  const body = M(opt.color ?? 0x23324f, { metalness: 0.4, roughness: 0.4 });
  const white = M(0xeeeeee);
  const glass = M(0x2a3d4d, { metalness: 0.6, roughness: 0.1, transparent: true, opacity: 0.8 });
  const cab = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), body); cab.scale.set(1.6, 1, 1); g.add(cab);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), glass); nose.position.set(1.4, 0.1, 0); nose.scale.set(1, 0.8, 1); g.add(nose);
  g.add(box(5.5, 0.4, 0.4, body, -4.5, 0.4, 0));
  g.add(box(0.8, 1.4, 0.15, white, -7.0, 1.0, 0));
  g.add(box(1.5, 0.08, 0.08, L(0x666666), 0, -1.5, 0.9)); g.add(box(3.0, 0.08, 0.08, L(0x666666), 0, -1.6, -0.9));
  g.add(box(3.0, 0.08, 0.08, L(0x666666), 0, -1.6, 0.9));
  const rotor = new THREE.Group(); rotor.position.set(0, 1.7, 0);
  rotor.add(box(11, 0.06, 0.35, L(0x222222)));
  rotor.add(box(0.35, 0.06, 11, L(0x222222)));
  g.add(rotor);
  const tail = new THREE.Group(); tail.position.set(-7.0, 1.2, 0.15);
  tail.add(box(0.06, 1.8, 0.2, L(0x222222)));
  g.add(tail);
  // searchlight cone (visual) and real spot light
  const coneGeo = new THREE.ConeGeometry(9, 60, 24, 1, true).translate(0, -30, 0);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  cone.position.set(1.0, -1.2, 0);
  g.add(cone);
  if (opt.stripe != null) {
    const band = new THREE.Mesh(new THREE.SphereGeometry(1.53, 16, 3, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.13), M(opt.stripe)); band.scale.set(1.6, 1, 1); g.add(band);
    g.add(box(0.9, 0.5, 0.17, M(opt.stripe), -7.0, 1.4, 0));
  }
  if (opt.spot === false) { cone.removeFromParent(); g.userData = { rotor, tail, cone: null, spot: null }; return g; }
  const spot = new THREE.SpotLight(0xfff1c8, 6000, 160, 0.18, 0.5, 1.6);
  spot.position.set(1.0, -1.2, 0);
  g.add(spot); g.add(spot.target);
  g.userData = { rotor, tail, cone, spot };
  return g;
}

// ---------------------------------------------------------------- signs
export function makeSpeedSign(limit) {
  const g = new THREE.Group();
  g.add(cyl(0.05, 2.4, L(0x9a9a9a), 0, 1.2, 0, 'y', 6));
  const tex = canvasTex(160, 200, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#111'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#111'; c.textAlign = 'center'; c.font = 'bold 30px Helvetica, Arial';
    c.fillText('SPEED', w / 2, 50); c.fillText('LIMIT', w / 2, 84); c.font = 'bold 92px Helvetica, Arial'; c.fillText(String(limit), w / 2, 170);
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.95), new THREE.MeshLambertMaterial({ map: tex }));
  face.position.set(0, 2.4, 0.06); g.add(face);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.95), L(0x888888)); back.rotation.y = Math.PI; back.position.set(0, 2.4, 0.05); g.add(back);
  return g;
}
export function makeCartSign() {
  const g = new THREE.Group();
  g.add(cyl(0.05, 2.4, L(0x9a9a9a), 0, 1.2, 0, 'y', 6));
  const tex = canvasTex(200, 200, (c, w, h) => {
    c.translate(w / 2, h / 2); c.rotate(Math.PI / 4);
    c.fillStyle = '#ffd21f'; c.fillRect(-66, -66, 132, 132); c.strokeStyle = '#111'; c.lineWidth = 6; c.strokeRect(-60, -60, 120, 120);
    c.rotate(-Math.PI / 4); c.fillStyle = '#111';
    c.fillRect(-42, -2, 84, 18); c.fillRect(-30, -40, 6, 40); c.fillRect(24, -40, 6, 40); c.fillRect(-34, -44, 68, 6);
    c.beginPath(); c.arc(-26, 22, 11, 0, 7); c.arc(26, 22, 11, 0, 7); c.fill();
    c.beginPath(); c.arc(0, -20, 8, 0, 7); c.fill();
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.1 }));
  face.position.set(0, 2.5, 0.06); g.add(face);
  return g;
}

// ---------------------------------------------------------------- grocery store at the Shoppes of Bay Isles
// Front of the store faces +Z (local). The loading dock is on the back wall (-Z side).
export function makeStore(w = 80, d = 58) {
  const g = new THREE.Group();
  const stucco = L(0xf1e9da);
  const green = L(0x3c8d3f);
  const h = 8.5;
  g.add(box(w, h, d, stucco, 0, h / 2, 0));
  g.add(box(w + 0.6, 1.0, d + 0.6, L(0xc9bfa9), 0, h + 0.3, 0));
  // arched entry
  const arch = new THREE.Group(); arch.position.set(-w * 0.18, 0, d / 2);
  arch.add(box(14, 11, 2.0, stucco, 0, 5.5, 0.6));
  const ac = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 2.2, 20, 1, false, 0, Math.PI), L(0x2d3a40));
  ac.rotation.set(Math.PI / 2, 0, Math.PI / 2); ac.rotation.set(0, 0, Math.PI / 2); ac.position.set(0, 6.0, 0.7); ac.rotation.set(Math.PI / 2, Math.PI / 2, 0);
  arch.add(box(8.4, 6.0, 2.2, new THREE.MeshStandardMaterial({ color: 0x3d5560, emissive: 0x5a3a1a, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.4 }), 0, 3.0, 0.7));
  const signTex = canvasTex(1024, 192, (c, ww, hh) => {
    c.fillStyle = '#3c8d3f'; c.fillRect(0, 0, ww, hh);
    c.fillStyle = '#fff'; c.font = 'bold italic 128px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Publix', ww / 2, hh / 2 + 6);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.25), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 9.4, 1.65); arch.add(sign);
  g.add(arch);
  // storefront windows and green awning band
  const win = M(0x30424d, { metalness: 0.6, roughness: 0.15, emissive: 0x4a3018, emissiveIntensity: 0.7 });
  g.add(box(w * 0.75, 3.2, 0.2, win, w * 0.1, 2.0, d / 2 + 0.05));
  g.add(box(w, 0.6, 1.6, green, 0, 4.2, d / 2 + 0.8));
  // birthday sign in the window (shown at the end of Cranberry Run)
  const bday = canvasTex(1024, 256, (c, ww, hh) => {
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, ww, hh);
    c.strokeStyle = '#c8102e'; c.lineWidth = 14; c.strokeRect(10, 10, ww - 20, hh - 20);
    c.fillStyle = '#c8102e'; c.font = 'bold 100px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Happy birthday Kristian', ww / 2, hh / 2 - 8);
    c.fillStyle = '#2f7d32'; c.font = '38px Helvetica, Arial'; c.fillText('your cranberries made it', ww / 2, hh - 44);
  });
  const bsign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.2), new THREE.MeshBasicMaterial({ map: bday }));
  bsign.position.set(w * 0.12, 2.05, d / 2 + 0.75);
  bsign.visible = false;
  g.add(bsign);
  g.userData.bday = bsign;
  // loading dock on the back
  const dock = new THREE.Group(); dock.position.set(w * 0.3, 0, -d / 2);
  dock.add(box(9, 1.3, 4, L(0x9c9c98), 0, 0.65, -2));
  dock.add(box(3.2, 3.6, 0.3, L(0x6d7378), -2.2, 3.1, -0.05));
  dock.add(box(3.2, 3.6, 0.3, L(0x6d7378), 2.2, 3.1, -0.05));
  for (const x of [-2.2, 2.2]) for (const s of [-1, 1]) dock.add(box(0.3, 1.2, 0.4, L(0x111111), x + s * 1.7, 1.0, -4.1));
  const stripes = canvasTex(256, 32, (c, ww, hh) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#111' : '#ffd21f'; c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16 + 16, 0); c.lineTo(i * 16, hh); c.lineTo(i * 16 - 16, hh); c.fill(); } });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.4), new THREE.MeshBasicMaterial({ map: stripes }));
  strip.position.set(0, 1.1, -4.02); strip.rotation.y = Math.PI; dock.add(strip);
  g.add(dock);
  g.userData.dockLocal = new THREE.Vector3(w * 0.3 + 2.2, 0, -d / 2 - 4.5);
  g.userData.size = [w, d];
  return g;
}

// ---------------------------------------------------------------- warehouse exterior
export function makeWarehouse(w = 60, d = 34) {
  const g = new THREE.Group();
  const wall = L(0xdfe3e6);
  g.add(box(w, 10, d, wall, 0, 5, 0));
  g.add(box(w + 0.5, 0.6, d + 0.5, L(0x8c99a3), 0, 10.2, 0));
  for (let i = 0; i < 5; i++) {
    g.add(box(3.4, 4.2, 0.2, L(0x6b7f8f), -w / 2 + 8 + i * 9, 3.2, d / 2 + 0.05));
    g.add(box(4.2, 1.2, 2.5, L(0x7a7a78), -w / 2 + 8 + i * 9, 0.6, d / 2 + 1.25));
  }
  const tex = canvasTex(1024, 160, (c, ww, hh) => { c.fillStyle = '#1d3b5a'; c.fillRect(0, 0, ww, hh); c.fillStyle = '#fff'; c.font = 'bold 84px Helvetica, Arial'; c.textAlign = 'center'; c.fillText('SARASOTA COLD STORAGE', ww / 2, 110); });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(26, 4), new THREE.MeshBasicMaterial({ map: tex })); s.position.set(0, 8, d / 2 + 0.06); g.add(s);
  for (let i = 0; i < 3; i++) g.add(box(3, 1.2, 3, L(0xb7bfc6), -12 + i * 12, 10.9, -4));
  return g;
}

// ---------------------------------------------------------------- dock with pilings
export function makeDock(len = 26) {
  const g = new THREE.Group();
  const wood = L(0x9b7a55);
  g.add(box(len, 0.25, 2.6, wood, len / 2, 0.55, 0));
  for (let i = 0; i <= len; i += 4) for (const s of [-1.2, 1.2]) g.add(cyl(0.16, 3.4, L(0x6e5338), i, -0.6, s, 'y', 6));
  return g;
}

// ---------------------------------------------------------------- freezer warehouse intro set
export function makeFreezerSet() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), M(0x3a4148, { roughness: 0.3, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const rackMat = L(0x2b4a7a), beam = L(0xd27d1f);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      if (i === 2 || i === 3) continue; // keep a center aisle for the forklifts
      const x = -28 + i * 9, z = -22 + row * 9;
      for (const dz of [-1.3, 1.3]) for (const dx of [-4, 4]) g.add(box(0.2, 12, 0.2, rackMat, x + dx, 6, z + dz));
      for (let lv = 1; lv < 5; lv++) {
        g.add(box(8.2, 0.18, 0.18, beam, x, lv * 2.6, z - 1.3)); g.add(box(8.2, 0.18, 0.18, beam, x, lv * 2.6, z + 1.3));
        for (let k = -1; k <= 1; k++) if ((i + lv + row + k) % 3) { const cr = makeCrate(1.4); cr.position.set(x + k * 2.6, lv * 2.6 + 0.65, z); g.add(cr); }
      }
    }
  }
  // cold blue lights
  for (let i = 0; i < 4; i++) {
    const strip = box(10, 0.15, 0.4, E(0x9fd8ff, 2.2), -24 + i * 16, 13, 6);
    g.add(strip);
    const pl = new THREE.PointLight(0x8fc8ff, 320, 36, 1.5); pl.position.set(-24 + i * 16, 11, 6); g.add(pl);
  }
  g.add(new THREE.AmbientLight(0x2a3f60, 2.4));
  g.add(new THREE.HemisphereLight(0x9fd8ff, 0x1a1a22, 0.8));
  return g;
}
export function makeForklift() {
  const g = new THREE.Group();
  const orange = M(0xff8a1f, { roughness: 0.45 });
  g.add(box(2.0, 1.0, 1.3, orange, 0, 0.75, 0));
  g.add(box(0.8, 1.3, 1.1, L(0x2c2c30), -0.5, 1.7, 0));
  g.add(box(0.3, 0.3, 0.3, E(0x33ffcc, 3), -0.5, 2.5, 0));      // sensor beacon
  g.add(box(0.12, 0.12, 0.5, E(0x66e0ff, 3), 1.02, 1.0, 0));    // camera eye
  const mast = new THREE.Group(); mast.position.set(1.1, 0, 0);
  mast.add(box(0.12, 3.0, 0.12, L(0x333333), 0, 1.5, 0.45)); mast.add(box(0.12, 3.0, 0.12, L(0x333333), 0, 1.5, -0.45));
  const forks = new THREE.Group();
  forks.add(box(1.2, 0.08, 0.15, L(0x555555), 0.6, 0.15, 0.3)); forks.add(box(1.2, 0.08, 0.15, L(0x555555), 0.6, 0.15, -0.3));
  const crate = makeCrate(1.0); crate.position.set(0.65, 0.6, 0); forks.add(crate);
  mast.add(forks); g.add(mast);
  for (const [x, z] of [[0.6, 0.6], [0.6, -0.6], [-0.6, 0.6], [-0.6, -0.6]]) g.add(wheel(x, 0.3, z, 0.3, 0.22));
  g.userData = { forks, crate };
  return g;
}

// ---------------------------------------------------------------- simple traffic car
export function makeTrafficCar(color) {
  const g = new THREE.Group();
  const paint = M(color, { metalness: 0.5, roughness: 0.35 });
  const glass = M(0x1a2228, { metalness: 0.5, roughness: 0.1 });
  g.add(box(4.4, 0.7, 1.8, paint, 0, 0.65, 0));
  g.add(box(2.3, 0.6, 1.6, glass, -0.3, 1.3, 0));
  g.add(box(2.1, 0.08, 1.62, paint, -0.3, 1.62, 0));
  for (const s of [-1, 1]) { g.add(box(0.06, 0.15, 0.35, E(0xfff3d0, 1.5), 2.2, 0.75, s * 0.6)); g.add(box(0.06, 0.15, 0.35, E(0xff2020, 1.5), -2.2, 0.75, s * 0.6)); }
  for (const [x, z] of [[1.4, 0.85], [1.4, -0.85], [-1.4, 0.85], [-1.4, -0.85]]) g.add(wheel(x, 0.34, z, 0.34, 0.24));
  return g;
}

// Box-like collision footprint helper (local rectangle to world polygon)
export function rectPoly(cx, cz, w, d, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), out = [];
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) out.push(cx + lx * c + lz * s, cz - lx * s + lz * c);
  return out;
}

// Bake a group of simple colored meshes into one vertex-colored mesh (one draw call).
const mergedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 });
export function mergeGroup(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const geos = [];
  group.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g = new THREE.BufferGeometry().copy(g);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const m = o.material, c = new THREE.Color();
    if (m.emissive && m.emissive.getHex() && m.color.getHex() === 0) c.copy(m.emissive).multiplyScalar(1.5); else c.copy(m.color);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(g);
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos), mergedMat);
  mesh.castShadow = true;
  const out = new THREE.Group();
  out.add(mesh);
  return out;
}

// ---------------------------------------------------------------- ambient boats (bay and gulf traffic)
// Forward is +x like the traffic cars. Waterline is y = 0 in the model.
function hullGeo(len, wid, hgt) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, -wid / 2); s.lineTo(len * 0.18, -wid / 2); s.quadraticCurveTo(len * 0.42, -wid * 0.42, len / 2, 0);
  s.quadraticCurveTo(len * 0.42, wid * 0.42, len * 0.18, wid / 2); s.lineTo(-len / 2, wid / 2); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: hgt, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2);
}
function hull(len, wid, hgt, color, stripe) {
  const g = new THREE.Group();
  const h = new THREE.Mesh(hullGeo(len, wid, hgt), L(color)); h.position.y = -0.35; g.add(h);
  if (stripe != null) { const s = new THREE.Mesh(hullGeo(len * 1.005, wid * 1.01, 0.18), L(stripe)); s.position.y = -0.3; g.add(s); }
  return g;
}
const BOAT_KINDS = ['console', 'console', 'sail', 'pontoon', 'cruiser', 'console', 'sail', 'skiff'];
export function makeTrafficBoat(i = 0) {
  const kind = BOAT_KINDS[i % BOAT_KINDS.length];
  const accents = [0x1f5fa8, 0xc23b2e, 0x2c8c6b, 0x223344, 0xe0a030, 0x6a4fa0];
  const acc = accents[i % accents.length];
  const white = L(0xf2f2ee), dark = L(0x2a2e33), tan = L(0xc8b48c);
  const g = new THREE.Group();
  let len = 7;
  if (kind === 'console') {
    len = 7 + (i % 3);
    g.add(hull(len, 2.5, 1.0, 0xf4f4f0, acc));
    g.add(box(len * 0.85, 0.05, 2.2, tan, -0.2, 0.66, 0));
    g.add(box(0.9, 1.0, 1.0, white, 0.2, 1.15, 0));
    g.add(box(0.1, 0.4, 0.9, L(0x30404c), 0.68, 1.85, 0));
    g.add(box(2.4, 0.08, 2.0, L(acc), -0.2, 2.5, 0));
    for (const [x, z] of [[0.8, 0.9], [0.8, -0.9], [-1.2, 0.9], [-1.2, -0.9]]) g.add(box(0.05, 1.8, 0.05, L(0xbfc3c7), x, 1.6, z));
    g.add(box(0.7, 0.9, 0.6, dark, -len / 2 - 0.1, 0.6, 0));
  } else if (kind === 'skiff') {
    len = 5;
    g.add(hull(len, 1.9, 0.8, 0x9fb7c4, null));
    g.add(box(0.5, 0.7, 0.4, dark, -2.6, 0.4, 0));
    g.add(box(0.6, 0.6, 0.4, L(0xe0c070), 0.3, 0.75, 0));
  } else if (kind === 'sail') {
    len = 9;
    g.add(hull(len, 2.8, 1.1, 0xf6f6f2, acc));
    g.add(box(2.6, 0.6, 1.8, white, 0.3, 1.0, 0));
    g.add(cyl(0.08, 11, L(0xbfc3c7), 0.8, 6.2, 0, 'y', 6));
    g.add(cyl(0.05, 4.0, L(0xbfc3c7), -1.2, 1.9, 0, 'x', 6));
    const sail = (pts) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.computeVertexNormals(); return new THREE.Mesh(geo, L(0xfbfaf4, { side: THREE.DoubleSide })); };
    // both windings, since the merged traffic material is single-sided
    g.add(sail([0.7, 1.95, 0, 0.7, 11.4, 0, -3.1, 1.95, 0, 0.7, 1.95, 0, -3.1, 1.95, 0, 0.7, 11.4, 0]));
    g.add(sail([0.9, 10.2, 0, 4.2, 1.2, 0, 0.9, 1.6, 0, 0.9, 10.2, 0, 0.9, 1.6, 0, 4.2, 1.2, 0]));
  } else if (kind === 'pontoon') {
    len = 8;
    for (const z of [-1.0, 1.0]) { g.add(cyl(0.38, len - 0.6, L(0xd0d4d8), -0.2, 0, z, 'x', 10)); }
    g.add(box(len - 0.4, 0.15, 2.6, tan, -0.2, 0.5, 0));
    g.add(box(len - 0.6, 0.6, 0.06, L(acc), -0.2, 0.9, 1.28)); g.add(box(len - 0.6, 0.6, 0.06, L(acc), -0.2, 0.9, -1.28));
    g.add(box(3.6, 0.08, 2.5, L(0xeeeeee), -0.6, 2.4, 0));
    g.add(box(0.7, 0.7, 0.6, dark, -len / 2, 0.5, 0));
  } else {
    len = 12;
    g.add(hull(len, 3.6, 1.5, 0xf8f8f6, acc));
    g.add(box(5.5, 1.2, 3.0, white, -0.4, 1.7, 0));
    g.add(box(4.0, 0.5, 3.04, L(0x22303c), 0.2, 1.9, 0));
    g.add(box(3.0, 0.9, 2.4, white, -0.8, 2.75, 0));
    g.add(box(1.5, 0.08, 3.2, tan, -len / 2 + 0.6, 0.9, 0));
  }
  g.userData = { kind, len, wid: kind === 'cruiser' ? 3.6 : kind === 'skiff' ? 1.9 : 2.7, speed: kind === 'sail' ? 4 : kind === 'pontoon' ? 6 : kind === 'skiff' ? 7 : kind === 'cruiser' ? 10 : 13 };
  return g;
}

// ---------------------------------------------------------------- flying vehicles (player)
// Jetpack pilot: feet at y = 0, facing +X. Two thrusters on the back with flame cones.
export function makeJetpackPilot() {
  const g = new THREE.Group();
  const suit = M(0xf0f0f2, { roughness: 0.5 }), dark = M(0x23252b), orange = M(0xff7a45, { roughness: 0.4 });
  const visor = M(0x1a2a3a, { metalness: 0.8, roughness: 0.1 }), metal = M(0xc9ccd0, { metalness: 0.8, roughness: 0.3 });
  for (const s of [-1, 1]) {
    g.add(box(0.2, 0.85, 0.2, suit, 0, 0.45, s * 0.13));           // legs
    g.add(box(0.3, 0.12, 0.2, dark, 0.05, 0.06, s * 0.13));         // boots
    const arm = box(0.16, 0.65, 0.16, suit, 0.05, 1.2, s * 0.33); arm.rotation.x = s * 0.18; g.add(arm);
  }
  g.add(box(0.36, 0.62, 0.52, suit, 0, 1.2, 0));                    // torso
  g.add(box(0.37, 0.1, 0.53, orange, 0, 1.0, 0));                   // belt
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), M(0xffffff, { roughness: 0.3 })); head.position.set(0.02, 1.68, 0); g.add(head);
  const vz = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, -0.9, 1.8, 0.9, 1.0), visor); vz.position.set(0.05, 1.68, 0); g.add(vz);
  // the pack
  g.add(box(0.22, 0.55, 0.46, orange, -0.3, 1.22, 0));
  const flames = [];
  for (const s of [-1, 1]) {
    g.add(cyl(0.11, 0.62, metal, -0.42, 1.12, s * 0.19, 'y', 12));
    g.add(cyl(0.08, 0.1, dark, -0.42, 0.78, s * 0.19, 'y', 10));
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 10, 1, true).rotateX(Math.PI).translate(0, -0.45, 0),
      new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    fl.position.set(-0.42, 0.74, s * 0.19); g.add(fl); flames.push(fl);
  }
  g.userData.flames = flames;
  g.userData.packTop = new THREE.Vector3(-0.3, 1.5, 0.12);
  return g;
}

// Fighter jet, about 15 m long, unarmed (a show jet). Wheels touch y = 0, nose to +X.
export function makeFighterJet() {
  const g = new THREE.Group();
  const grey = M(0x9aa3ad, { metalness: 0.55, roughness: 0.35 }), darkg = M(0x5d6670, { metalness: 0.5, roughness: 0.4 });
  const glass = M(0x2a3a4a, { metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.85 });
  const orange = M(0xff7a45, { roughness: 0.4 }), dark = M(0x1d1f24);
  const Y = 1.9;
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 11, 16).rotateZ(Math.PI / 2), grey); fus.position.set(-0.5, Y, 0); fus.castShadow = true; g.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 4.2, 16).rotateZ(-Math.PI / 2), grey); nose.position.set(7.1, Y, 0); nose.castShadow = true; g.add(nose);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.9, 10).rotateZ(-Math.PI / 2), dark); tip.position.set(9.4, Y, 0); g.add(tip);
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 10), glass); can.scale.set(2.6, 0.9, 0.85); can.position.set(4.3, Y + 0.75, 0); g.add(can);
  // delta wings and tail
  const wing = new THREE.Shape(); wing.moveTo(2.5, 0); wing.lineTo(-4.2, 5.4); wing.lineTo(-5.6, 5.4); wing.lineTo(-5.2, 0); wing.closePath();
  const wgeo = new THREE.ExtrudeGeometry(wing, { depth: 0.14, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wgeo, grey); w.rotation.x = s * Math.PI / 2; w.position.set(0, Y - 0.25 + (s > 0 ? 0.14 : 0), 0); w.castShadow = true; g.add(w);
    const tipStripe = box(1.4, 0.16, 0.25, orange, -4.9, Y - 0.18, s * 5.3); g.add(tipStripe);
    const st = new THREE.Shape(); st.moveTo(-4.0, 0); st.lineTo(-6.4, 2.6); st.lineTo(-7.3, 2.6); st.lineTo(-7.0, 0); st.closePath();
    const sm = new THREE.Mesh(new THREE.ExtrudeGeometry(st, { depth: 0.1, bevelEnabled: false }), darkg); sm.rotation.x = s * Math.PI / 2; sm.position.set(0, Y, 0); g.add(sm);
    const fin = new THREE.Shape(); fin.moveTo(-3.2, 0); fin.lineTo(-5.9, 3.0); fin.lineTo(-7.0, 3.0); fin.lineTo(-6.6, 0); fin.closePath();
    const fm = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.12, bevelEnabled: false }), grey); fm.position.set(0, Y + 0.5, s * 0.75); fm.rotation.x = -s * 0.35; fm.castShadow = true; g.add(fm);
    g.add(box(1.0, 0.25, 0.14, orange, -6.4, Y + 3.15, s * (0.75 + 1.0)));
    g.add(box(2.8, 0.7, 0.5, darkg, 1.5, Y - 0.1, s * 1.0));      // intakes
  }
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 1.0, 14, 1, true).rotateZ(Math.PI / 2), dark); noz.position.set(-6.5, Y, 0); g.add(noz);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.6, 4, 14, 1, true).rotateZ(Math.PI / 2).translate(-2, 0, 0),
    new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  flame.position.set(-7.0, Y, 0); g.add(flame);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 10, 1, true).rotateZ(Math.PI / 2).translate(-1.1, 0, 0),
    new THREE.MeshBasicMaterial({ color: 0xaad4ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  core.position.set(-7.0, Y, 0); g.add(core);
  // landing gear
  const gear = new THREE.Group();
  for (const [x, z] of [[5.6, 0], [-1.6, 1.4], [-1.6, -1.4]]) { gear.add(box(0.12, 1.3, 0.12, darkg, x, 0.95, z)); gear.add(cyl(0.32, 0.22, dark, x, 0.32, z, 'z', 12)); }
  g.add(gear);
  g.userData = { flame, core, gear, tailTop: new THREE.Vector3(-6.4, Y + 3.25, 1.75) };
  return g;
}

// ---------------------------------------------------------------- cyclists
// A rider on a road bike, facing +X, wheels on y = 0. Returns { body, legs } so the legs can pedal.
const cycleMats = new Map();
const cmat = (c) => { if (!cycleMats.has(c)) cycleMats.set(c, L(c)); return cycleMats.get(c); };
export function makeCyclist(shirt = 0x3a7bd5, bike = 0x222222, skin = 0xc68e6b) {
  const g = new THREE.Group();
  const frame = M(bike, { metalness: 0.5, roughness: 0.35 }), tire = L(0x151515), sk = L(skin), sh = L(shirt), helmet = L(0xf2f2f2);
  for (const x of [0.52, -0.52]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 6, 20), tire); w.position.set(x, 0.35, 0); g.add(w); }
  const bar = (x1, y1, x2, y2, r = 0.025) => { const len = Math.hypot(x2 - x1, y2 - y1); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), frame); m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0); m.rotation.z = Math.atan2(x1 - x2, y2 - y1); g.add(m); };
  bar(-0.52, 0.35, -0.02, 0.38); bar(-0.02, 0.38, -0.12, 0.85); bar(-0.52, 0.35, -0.12, 0.85); bar(-0.12, 0.85, 0.42, 0.88); bar(-0.02, 0.38, 0.42, 0.88); bar(0.42, 0.88, 0.52, 0.35); bar(0.42, 0.88, 0.45, 1.0);
  g.add(box(0.06, 0.04, 0.42, frame, 0.47, 1.0, 0));                // handlebar
  g.add(box(0.24, 0.05, 0.1, L(0x111111), -0.14, 0.9, 0));         // saddle
  const torso = box(0.6, 0.24, 0.34, sh, 0.12, 1.22, 0); torso.rotation.z = -0.55; g.add(torso);
  for (const s of [-1, 1]) { const a = box(0.5, 0.08, 0.08, sk, 0.32, 1.12, s * 0.18); a.rotation.z = 0.75; g.add(a); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), sk); head.position.set(0.44, 1.45, 0); g.add(head);
  const hel = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, 1.5), helmet); hel.position.set(0.42, 1.48, 0); hel.scale.set(1.3, 0.9, 1); g.add(hel);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(-0.1, 0.92, s * 0.1);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1).translate(0, -0.31, 0), cmat(0x1d1d24));
    hip.add(leg); legs.push(hip);
  }
  return { body: g, legs };
}

// Police cruiser built to share its light materials across the fleet: pass {red, blue} so a whole
// fleet flashes in step and lights on or off is just a material swap (no new shaders mid-game).
// Door livery for the two departments (2026-11-18): Sarasota Police (navy) and Longboat Key Police (teal).
// Both decal pairs ride on every cruiser; police.js shows the one for the area the car is in.
// Colours and wording are our own simple take, not copied from the real cars.
export const AGENCIES = {
  spd: { top: 'SARASOTA', main: 'POLICE', stripe: '#1d3466', accent: '#c9a227', text: '#1d3466' },
  lbk: { top: 'LONGBOAT KEY', main: 'POLICE', stripe: '#0f7f86', accent: '#58c6c9', text: '#0b5e63' },
};
const liveryTex = {};
function liveryTexture(id) {
  if (liveryTex[id]) return liveryTex[id];
  const a = AGENCIES[id], c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = a.stripe; x.fillRect(0, 150, 1024, 46);
  x.fillStyle = a.accent; x.fillRect(0, 202, 1024, 12);
  x.fillStyle = a.text; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.font = 'bold 44px Helvetica, Arial, sans-serif'; x.fillText(a.top, 512, 62);
  x.font = '900 82px Helvetica, Arial, sans-serif'; x.fillText(a.main, 512, 140);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (liveryTex[id] = t);
}
let doorZ = null;   // half-width of the Explorer at door height, measured once by a ray
function addLivery(ex) {
  const bb = new THREE.Box3().setFromObject(ex), len = bb.max.x - bb.min.x, hgt = bb.max.y - bb.min.y;
  const cx = (bb.max.x + bb.min.x) / 2 - len * 0.03, y = bb.min.y + hgt * 0.36;
  if (doorZ === null) {
    ex.updateMatrixWorld(true);
    const rc = new THREE.Raycaster(new THREE.Vector3(cx, y, bb.max.z + 3), new THREE.Vector3(0, 0, -1));
    const hit = rc.intersectObject(ex, true)[0];
    doorZ = hit ? hit.point.z : bb.max.z * 0.95;
  }
  const w = len * 0.5, h = w / 4;
  const out = {};
  for (const id of Object.keys(AGENCIES)) {
    const mat = new THREE.MeshLambertMaterial({ map: liveryTexture(id), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const g = new THREE.Group();
    for (const sd of [1, -1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(cx, y, sd * (doorZ + 0.07)); if (sd < 0) m.rotation.y = Math.PI;
      m.renderOrder = 2; g.add(m);
    }
    g.visible = id === 'spd'; ex.add(g); out[id] = g;
  }
  return out;
}
export function makePoliceCar() {
  const ex = explorer();
  if (ex) {
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.62), null), blue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.62), null);
    red.position.set(-0.35, 1.78, 0.36); blue.position.set(-0.35, 1.78, -0.36);
    ex.add(red, blue);
    const livery = addLivery(ex);
    ex.userData = { red, blue, livery, agency: 'spd' };
    return ex;
  }
  const g = new THREE.Group();
  const white = M(0xf5f5f5, { metalness: 0.4, roughness: 0.35 }), navy = M(0x1b2a4a, { metalness: 0.4, roughness: 0.35 }), glass = M(0x111820, { metalness: 0.5, roughness: 0.1 });
  g.add(box(4.8, 0.7, 1.9, navy, 0, 0.7, 0));
  g.add(box(2.4, 0.6, 1.75, glass, -0.3, 1.33, 0));
  g.add(box(2.2, 0.08, 1.77, white, -0.3, 1.66, 0));
  g.add(box(2.6, 0.32, 1.92, white, 0, 0.82, 0));
  for (const s of [-1, 1]) { g.add(box(0.06, 0.15, 0.35, E(0xfff3d0, 1.5), 2.4, 0.75, s * 0.6)); g.add(box(0.06, 0.15, 0.35, E(0xff2020, 1.5), -2.4, 0.75, s * 0.6)); }
  for (const [x, z] of [[1.5, 0.88], [1.5, -0.88], [-1.5, 0.88], [-1.5, -0.88]]) g.add(wheel(x, 0.36, z, 0.36, 0.26));
  const merged = mergeGroup(g);
  merged.traverse((o) => { o.castShadow = false; });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.66), null), blue = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.66), null);
  red.position.set(-0.3, 1.78, 0.38); blue.position.set(-0.3, 1.78, -0.38);
  merged.add(red, blue);
  merged.userData = { red, blue };
  return merged;
}
