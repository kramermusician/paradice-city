// Buildings pass (2026-11-25): every building used to be the same box with a grid of grey windows.
// Now each one is sorted into a kind by footprint, height and where it stands, and drawn in that kind's look:
//   - generated island houses: four house types (ranch with a garage wing, two-storey Mediterranean, raised coastal
//     modern, old Florida cottage with a porch), driveways, garage and front doors, some pools with screen cages
//   - OSM houses: hip, gable, skirt or flat roofs by footprint shape
//   - island low-rises and condos: balcony bands, tile mansard rims, parapets, penthouses
//   - mainland: storefronts with awnings, strip-window offices, glass towers, plain big boxes with roof units
// Everything still lands in the per-tile merged building mesh (one draw call a tile). Windows, balconies, awnings,
// tile rows and metal seams are drawn by the wall shader from two numbers per vertex (style, seed), no textures.
// uv on walls: u in window bays, v in floors. Colours follow the reference photos in ~/Dropbox/Paradice City Looks/.
import * as THREE from 'three';

const C = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE = C(0xf4f2ec), TRIM = C(0xfaf9f5), GLASSDARK = C(0x27333d);

const HOUSE_WALLS = [0xf6f3ec, 0xf6f3ec, 0xf1e6cf, 0xe3d2b4, 0xf0c9a8, 0xe8a88f, 0xf3e3a6, 0xbfe0d2, 0xa9d6dc, 0xb9d3e8, 0xd9dbd9, 0xc9c1b6, 0xf0c4c8, 0xc5d2b4, 0xfbfaf6, 0xead9c4].map(C);
const TILE_ROOFS = [0xb5613f, 0xc47a52, 0xa9573c, 0xd9b48c, 0xc98f66].map(C);
const SHINGLE_ROOFS = [0x4a4d52, 0x7d8185, 0x6a5f55, 0x8d8a82].map(C);
const METAL_ROOFS = [0xc9cfd2, 0xe8ebea, 0xdfe3e2, 0x6f93ad, 0x5f8f7a, 0x9aa3a8].map(C);
const CONDO_WALLS = [0xf7f5f0, 0xf7f5f0, 0xf2e8d5, 0xf1cdb0, 0xefd0cc, 0xe6d5b8, 0xcfe6e4, 0xdcdcda, 0xf3ead8].map(C);
const TOWN_WALLS = [0xf4f1ea, 0xefe5d2, 0xdfdfdc, 0xe6d6b8, 0xf0e2ae, 0xb9705a, 0xb5d6d2, 0xf0c4b0, 0xd3d8dc, 0xf6f4ee, 0xf4f1ea, 0xe9eef0, 0xf3ead8].map(C);
const FLAT_ROOFS = [0xeceae4, 0xd9d8d2, 0xc8c6bf, 0xbfc4c6].map(C);
const DOORS = [0xf4f2ec, 0x1f3a5c, 0x1e6f73, 0xa3342c, 0x6b4a2f, 0x23262a, 0xd9a441].map(C);
const DRIVES = [0xcfc9bd, 0xbdb6a8, 0xd8c7ad, 0xc4a98c, 0xb9b7b2].map(C);

// styles understood by the wall shader (see wallShader below)
const S = { LEGACY: 0, HOUSE: 1, BALCONY: 2, PUNCHED: 3, GLASS: 4, SHOP: 5, STRIP: 6, BIGBOX: 7, ROOF: 8, PLAIN: 9, GARAGE: 10 };

function hash2(x, z) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }
function rngFrom(seed) { let s = (Math.floor(seed * 4294967295) ^ 0x9e3779b9) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

// ---------------------------------------------------------------- low-level emitters (into a tile Buf)
class Pen {
  constructor(buf, c = null) { this.b = buf; this.c = c; }   // c: a point inside and under the building; every face is wound to face away from it
  style(s, seed = 0) { this.b.cur = [s, seed]; return this; }
  out(a, b, c) {   // true when triangle a, b, c already faces away from the centre
    const o = this.c; if (!o) return true;
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return nx * ((a[0] + b[0] + c[0]) / 3 - o[0]) + ny * ((a[1] + b[1] + c[1]) / 3 - o[1]) + nz * ((a[2] + b[2] + c[2]) / 3 - o[2]) >= 0;
  }
  quad(a, b, c, d, col, ua, ub, uc, ud) {
    ua = ua || N1; ub = ub || N1; uc = uc || N1; ud = ud || N1;
    if (this.out(a, b, c)) this.b.quad(a, b, c, d, col, ua, ub, uc, ud); else this.b.quad(a, d, c, b, col, ua, ud, uc, ub);
  }
  tri(a, b, c, col, ua, ub, uc) {
    ua = ua || N1; ub = ub || N1; uc = uc || N1;
    if (this.out(a, b, c)) this.b.tri(a, b, c, col, ua, ub, uc); else this.b.tri(a, c, b, col, ua, uc, ub);
  }
  // one wall from a to b (ground points [x, z]), y0..y1, with uv in bays and floors. k: wall number (varies the window hash)
  wall(a, b, y0, y1, col, cellW, floorH, k = 0, windows = true) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let n = windows ? Math.round(len / cellW) : 0;
    if (windows && n === 0 && len > cellW * 0.62) n = 1;
    const u0 = n ? k * 16 : 0.02, u1 = n ? k * 16 + n : 0.02, v1 = (y1 - y0) / floorH;
    this.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], col, [u0, 0], [u1, 0], [u1, v1], [u0, v1]);
  }
  // a roof face: pts in order, the first edge is the eave. uv = metres along the eave, metres up the slope.
  roof(pts, col) {
    const [a, b] = pts; let dx = b[0] - a[0], dz = b[2] - a[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const uv = pts.map((p) => { const ex = p[0] - a[0], ey = p[1] - a[1], ez = p[2] - a[2]; const u = ex * dx + ez * dz; return [u, Math.sqrt(Math.max(0, ex * ex + ey * ey + ez * ez - u * u))]; });
    if (pts.length === 3) this.tri(pts[0], pts[1], pts[2], col, uv[0], uv[1], uv[2]);
    else this.quad(pts[0], pts[1], pts[2], pts[3], col, uv[0], uv[1], uv[2], uv[3]);
  }
}
const N1 = [-1, -1];

// A local frame: u along the front, v from the front face toward the back, y up.
function frameOf(fx, fz, tx, tz, nx, nz) { const P = (u, y, v) => [fx + tx * u + nx * v, y, fz + tz * u + nz * v]; P.g = (u, v) => [fx + tx * u + nx * v, fz + tz * u + nz * v]; return P; }

// four walls of a box in a frame. win: which sides get windows [front, right, back, left]
function boxWalls(pen, P, u0, u1, v0, v1, y0, y1, col, cellW, floorH, win = [1, 1, 1, 1], k0 = 0) {
  const c = [P.g(u0, v0), P.g(u1, v0), P.g(u1, v1), P.g(u0, v1)];
  for (let i = 0; i < 4; i++) pen.wall(c[i], c[(i + 1) % 4], y0, y1, col, cellW, floorH, k0 + i, !!win[i]);
}
function hipRoof(pen, P, u0, u1, v0, v1, y, rise, over, col) {
  u0 -= over; u1 += over; v0 -= over; v1 += over; const ye = y - 0.1, yr = y + rise;
  const du = u1 - u0, dv = v1 - v0;
  if (du >= dv) {
    const a = P(u0 + dv / 2, yr, (v0 + v1) / 2), b = P(u1 - dv / 2, yr, (v0 + v1) / 2);
    pen.roof([P(u0, ye, v0), P(u1, ye, v0), b, a], col); pen.roof([P(u1, ye, v1), P(u0, ye, v1), a, b], col);
    pen.roof([P(u1, ye, v0), P(u1, ye, v1), b], col); pen.roof([P(u0, ye, v1), P(u0, ye, v0), a], col);
  } else {
    const a = P((u0 + u1) / 2, yr, v0 + du / 2), b = P((u0 + u1) / 2, yr, v1 - du / 2);
    pen.roof([P(u1, ye, v0), P(u1, ye, v1), b, a], col); pen.roof([P(u0, ye, v1), P(u0, ye, v0), a, b], col);
    pen.roof([P(u0, ye, v0), P(u1, ye, v0), a], col); pen.roof([P(u1, ye, v1), P(u0, ye, v1), b], col);
  }
}
// ridge along u when alongU, else along v. Gable ends are filled in the wall colour.
function gableRoof(pen, P, u0, u1, v0, v1, y, rise, over, col, wallCol, alongU, seed) {
  const ye = y - 0.08, yr = y + rise;
  if (alongU) {
    const vm = (v0 + v1) / 2, a = u0 - over * 0.6, b = u1 + over * 0.6;
    pen.roof([P(a, ye, v0 - over), P(b, ye, v0 - over), P(b, yr, vm), P(a, yr, vm)], col);
    pen.roof([P(b, ye, v1 + over), P(a, ye, v1 + over), P(a, yr, vm), P(b, yr, vm)], col);
    pen.style(S.PLAIN, seed);
    pen.tri(P(u0, y, v0), P(u0, y, v1), P(u0, yr - 0.1, vm), wallCol); pen.tri(P(u1, y, v0), P(u1, y, v1), P(u1, yr - 0.1, vm), wallCol);
  } else {
    const um = (u0 + u1) / 2, a = v0 - over * 0.6, b = v1 + over * 0.6;
    pen.roof([P(u0 - over, ye, b), P(u0 - over, ye, a), P(um, yr, a), P(um, yr, b)], col);
    pen.roof([P(u1 + over, ye, a), P(u1 + over, ye, b), P(um, yr, b), P(um, yr, a)], col);
    pen.style(S.PLAIN, seed);
    pen.tri(P(u0, y, v0), P(u1, y, v0), P(um, yr - 0.1, v0), wallCol); pen.tri(P(u0, y, v1), P(u1, y, v1), P(um, yr - 0.1, v1), wallCol);
  }
}
// flat slab roof with a white fascia, overhanging the walls
function slabRoof(pen, P, u0, u1, v0, v1, y, over, col, thick = 0.28) {
  u0 -= over; u1 += over; v0 -= over; v1 += over;
  pen.quad(P(u0, y + thick, v0), P(u1, y + thick, v0), P(u1, y + thick, v1), P(u0, y + thick, v1), col);
  pen.quad(P(u0, y, v0), P(u1, y, v0), P(u1, y, v1), P(u0, y, v1), mixc(col, [0.5, 0.5, 0.5], 0.25));
  const c = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; pen.quad(P(a[0], y, a[1]), P(b[0], y, b[1]), P(b[0], y + thick, b[1]), P(a[0], y + thick, a[1]), TRIM); }
}
function solidBox(pen, P, u0, u1, v0, v1, y0, y1, col, top = col) {
  const c = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; pen.quad(P(a[0], y0, a[1]), P(b[0], y0, b[1]), P(b[0], y1, b[1]), P(a[0], y1, a[1]), col); }
  pen.quad(P(u0, y1, v0), P(u1, y1, v0), P(u1, y1, v1), P(u0, y1, v1), top);
}
function roofLook(r, kind) { // returns [colour, seed for the shader: < 0.5 tile rows, else metal seams, 0.5 exactly = plain shingle]
  if (kind === 'tile') return [pick(r, TILE_ROOFS), 0.1 + r() * 0.3];
  if (kind === 'metal') return [pick(r, METAL_ROOFS), 0.6 + r() * 0.3];
  return [pick(r, SHINGLE_ROOFS), 0.5];
}

// ---------------------------------------------------------------- generated houses (frame known from the street)
function house(W, t, b, r, seed) {
  const pen = new Pen(t.bld, [b.cx, -2, b.cz]), flat = new Pen(t.roads, [b.cx, -50, b.cz]), h = b.house;
  const Wd = h.W, D = h.D;
  const P = frameOf(h.cx - h.nx * D / 2, h.cz - h.nz * D / 2, h.tx, h.tz, h.nx, h.nz);
  const two = b.h > 6;
  let wall = pick(r, HOUSE_WALLS);
  const tr = r();
  let type = two ? (tr < 0.58 ? 'med' : 'modern') : (tr < 0.62 ? 'ranch' : tr < 0.9 ? 'cottage' : 'ranch');
  let roofKind = type === 'med' ? 'tile' : type === 'cottage' ? 'metal' : pick(r, ['tile', 'tile', 'shingle', 'metal']);
  if (b.lbk) { wall = C(0xf8f7f2); roofKind = 'metal'; type = r() < 0.7 ? 'ranch' : 'cottage'; }
  let [rc, rs] = roofLook(r, roofKind);
  if (b.lbk) rc = pick(r, [C(0xd6dbdc), C(0xe6e9e8), C(0xcdd3d4)]);
  const gs = r() < 0.5 ? 1 : -1;                       // which end the garage is on
  const door = pick(r, DOORS), drive = pick(r, DRIVES);
  const driveway = (uc, w, v1 = 0) => { flat.quad(P(uc - w / 2, 0.07, -6.4), P(uc + w / 2, 0.07, -6.4), P(uc + w / 2, 0.07, v1), P(uc - w / 2, 0.07, v1), drive); };
  const garageDoor = (uc, w, v, y = 2.25) => { pen.style(S.GARAGE, seed); pen.quad(P(uc - w / 2, 0.02, v - 0.06), P(uc + w / 2, 0.02, v - 0.06), P(uc + w / 2, y, v - 0.06), P(uc - w / 2, y, v - 0.06), TRIM, [0, 0], [1, 0], [1, 1], [0, 1]); };
  const frontDoor = (uc, v) => {
    pen.style(S.PLAIN, seed);
    pen.quad(P(uc - 0.62, 0, v - 0.05), P(uc + 0.62, 0, v - 0.05), P(uc + 0.62, 2.3, v - 0.05), P(uc - 0.62, 2.3, v - 0.05), TRIM);
    pen.quad(P(uc - 0.5, 0.05, v - 0.08), P(uc + 0.5, 0.05, v - 0.08), P(uc + 0.5, 2.18, v - 0.08), P(uc - 0.5, 2.18, v - 0.08), door);
    flat.quad(P(uc - 0.7, 0.07, -6.4), P(uc + 0.7, 0.07, -6.4), P(uc + 0.7, 0.07, v), P(uc - 0.7, 0.07, v), mixc(drive, [0.8, 0.8, 0.78], 0.4));
  };
  let top = 3.1;
  if (type === 'ranch') {
    const g = 2.6 + r() * 1.2, gw = Math.min(6.4, Wd * 0.46), H = 3.0 + r() * 0.3;
    const gu0 = gs > 0 ? Wd / 2 - gw : -Wd / 2, gu1 = gu0 + gw;
    pen.style(S.HOUSE, seed); boxWalls(pen, P, -Wd / 2, Wd / 2, g, D, 0, H, wall, 3.5, H);
    pen.style(S.HOUSE, seed); boxWalls(pen, P, gu0, gu1, 0, g + 0.5, 0, H - 0.2, wall, 3.5, H - 0.2, [0, 0, 0, 0], 4);
    pen.style(S.ROOF, rs);
    const rise = 1.5 + r() * 0.9;
    if (r() < 0.7) hipRoof(pen, P, -Wd / 2, Wd / 2, g, D, H, rise, 0.6, rc); else gableRoof(pen, P, -Wd / 2, Wd / 2, g, D, H, rise, 0.6, rc, wall, true, seed);
    pen.style(S.ROOF, rs);
    if (r() < 0.5) gableRoof(pen, P, gu0, gu1, 0, g + 2.5, H - 0.2, rise * 0.7, 0.5, rc, wall, false, seed); else hipRoof(pen, P, gu0, gu1, 0, g + 3, H - 0.2, rise * 0.75, 0.5, rc);
    garageDoor((gu0 + gu1) / 2, gw - 1.3, 0); driveway((gu0 + gu1) / 2, gw - 0.9);
    frontDoor(gs > 0 ? gu0 - 1.75 : gu1 + 1.75, g);
    top = H + rise * 0.5;
  } else if (type === 'med') {
    const H = 6.1 + r() * 0.5, fw = Wd * (0.45 + r() * 0.15), fu0 = gs > 0 ? Wd / 2 - fw : -Wd / 2, fu1 = fu0 + fw, fd = 3.2;
    pen.style(S.HOUSE, seed); boxWalls(pen, P, -Wd / 2, Wd / 2, 1.6, D, 0, H, wall, 3.5, H / 2);
    pen.style(S.HOUSE, seed); boxWalls(pen, P, fu0, fu1, 0, fd, 0, 3.0, wall, 3.5, 3.0, [0, 1, 0, 1], 4);
    pen.style(S.ROOF, rs); hipRoof(pen, P, -Wd / 2, Wd / 2, 1.6, D, H, 1.6 + r() * 0.6, 0.7, rc);
    pen.style(S.ROOF, rs); hipRoof(pen, P, fu0, fu1, 0, fd + 1.5, 3.0, 1.1, 0.5, rc);
    garageDoor((fu0 + fu1) / 2, Math.min(5.2, fw - 1.2), 0); driveway((fu0 + fu1) / 2, Math.min(5.6, fw - 0.8));
    frontDoor(gs > 0 ? fu0 - 1.75 : fu1 + 1.75, 1.6);
    top = H + 0.8;
  } else if (type === 'modern') {
    // raised coastal house: garage level under the living floor, a glassy front, a white slab or low metal roof
    const g0 = 3.0, H = 6.4 + (r() < 0.35 ? 2.9 : 0);
    wall = pick(r, [C(0xfbfaf6), C(0xf6f3ec), C(0xe9ecec), C(0xdfe6ea), C(0xf1ead9)]);
    pen.style(S.PLAIN, seed); boxWalls(pen, P, -Wd / 2 + 0.6, Wd / 2 - 0.6, 1.6, D, 0, g0, mixc(wall, [0.6, 0.6, 0.6], 0.18), 3.5, g0, [0, 0, 0, 0]);
    pen.style(S.STRIP, seed); boxWalls(pen, P, -Wd / 2, Wd / 2, 1.0, D, g0, H, wall, 3.2, 3.2, [1, 0, 1, 0]);
    pen.style(S.HOUSE, seed); boxWalls(pen, P, -Wd / 2, Wd / 2, 1.0, D, g0, H, wall, 3.6, 3.2, [0, 1, 0, 1], 4);
    pen.style(S.PLAIN, seed); pen.quad(P(-Wd / 2, g0, 1.0), P(Wd / 2, g0, 1.0), P(Wd / 2, g0, D), P(-Wd / 2, g0, D), mixc(wall, [0.4, 0.4, 0.4], 0.3));
    if (r() < 0.55) { pen.style(S.PLAIN, seed); slabRoof(pen, P, -Wd / 2, Wd / 2, 1.0, D, H, 0.9, WHITE); }
    else { [rc, rs] = roofLook(r, 'metal'); pen.style(S.ROOF, rs); hipRoof(pen, P, -Wd / 2, Wd / 2, 1.0, D, H, 1.1, 0.9, rc); }
    garageDoor(gs * Wd * 0.2, 5.0, 1.6, 2.4); driveway(gs * Wd * 0.2, 5.6, 1.6);
    frontDoor(-gs * Wd * 0.26, 1.6);
    top = H + 0.3;
  } else {
    // old Florida cottage: smaller body, metal gable, a porch across the front on posts, sometimes a carport
    const m = 1.4, H = 2.9 + r() * 0.3, pd = 2.2, u0 = -Wd / 2 + m, u1 = Wd / 2 - m - (r() < 0.5 ? 3.4 : 0);
    const cp = u1 < Wd / 2 - m - 1;
    pen.style(S.HOUSE, seed); boxWalls(pen, P, u0, u1, pd, D - 1, 0, H, wall, 3.2, H);
    const rise = 1.7 + r() * 0.8;
    pen.style(S.ROOF, rs);
    if (r() < 0.75) gableRoof(pen, P, u0, u1, pd, D - 1, H, rise, 0.55, rc, wall, true, seed); else hipRoof(pen, P, u0, u1, pd, D - 1, H, rise, 0.55, rc);
    pen.style(S.ROOF, rs); pen.roof([P(u0 - 0.3, 2.45, -0.2), P(u1 + 0.3, 2.45, -0.2), P(u1 + 0.3, H + 0.05, pd + 0.1), P(u0 - 0.3, H + 0.05, pd + 0.1)], rc);
    pen.style(S.PLAIN, seed);
    const np = Math.max(2, Math.round((u1 - u0) / 3.2));
    for (let i = 0; i <= np; i++) { const u = u0 + (u1 - u0) * i / np; solidBox(pen, P, u - 0.07, u + 0.07, 0.05, 0.19, 0, 2.5, TRIM); }
    solidBox(pen, P, u0, u1, 0, pd, 0, 0.22, C(0xb8b2a6));
    if (cp) { for (const [a, bq] of [[u1 + 0.4, pd], [u1 + 3.3, pd], [u1 + 0.4, pd + 5.2], [u1 + 3.3, pd + 5.2]]) solidBox(pen, P, a - 0.07, a + 0.07, bq - 0.07, bq + 0.07, 0, 2.5, TRIM); slabRoof(pen, P, u1 + 0.2, u1 + 3.5, pd - 0.2, pd + 5.4, 2.5, 0.15, WHITE, 0.18); driveway(u1 + 1.85, 2.9, pd + 5); }
    else driveway(u1 - 1.6, 2.8, pd);
    frontDoor((u0 + u1) / 2, pd);
    top = H + rise * 0.5;
  }
  b.h = top;
  // pool with a screen cage behind some houses (the dark frames are everywhere on the keys from the air)
  if (type !== 'cottage' && r() < 0.34) {
    const pu0 = -Wd * 0.3, pu1 = Wd * 0.3, pv0 = D + 0.6, pv1 = D + 6.2;
    const clear = [[pu0, pv1 + 1.5], [pu1, pv1 + 1.5], [0, pv1 + 2.5], [pu0, pv0 + 2], [pu1, pv0 + 2]].every(([u, v]) => { const [x, z] = P.g(u, v); return W.isLand(x, z) && !W.buildingAt(x, z) && !W.roadAt(x, z, 0); });
    if (clear) {
      flat.quad(P(pu0, 0.07, pv0), P(pu1, 0.07, pv0), P(pu1, 0.07, pv1), P(pu0, 0.07, pv1), C(0xd9d3c6));
      flat.quad(P(pu0 + 1.4, 0.09, pv0 + 1.3), P(pu1 - 1.4, 0.09, pv0 + 1.3), P(pu1 - 1.4, 0.09, pv1 - 1.3), P(pu0 + 1.4, 0.09, pv1 - 1.3), C(0x3fb6cf));
      if (r() < 0.75) {
        pen.style(S.PLAIN, seed); const fc = C(0x3c4044), hy = 3.0, e = 0.05;
        for (const [u, v] of [[pu0, pv0], [pu1, pv0], [pu1, pv1], [pu0, pv1], [0, pv1], [pu0, (pv0 + pv1) / 2], [pu1, (pv0 + pv1) / 2]]) solidBox(pen, P, u - e, u + e, v - e, v + e, 0, hy, fc);
        solidBox(pen, P, pu0, pu1, pv1 - e, pv1 + e, hy - 0.1, hy, fc); solidBox(pen, P, pu0, pu1, pv0 - e, pv0 + e, hy - 0.1, hy, fc);
        solidBox(pen, P, pu0 - e, pu0 + e, pv0, pv1, hy - 0.1, hy, fc); solidBox(pen, P, pu1 - e, pu1 + e, pv0, pv1, hy - 0.1, hy, fc);
        solidBox(pen, P, -e, e, pv0, pv1, hy - 0.1, hy, fc); solidBox(pen, P, pu0, pu1, (pv0 + pv1) / 2 - e, (pv0 + pv1) / 2 + e, hy - 0.1, hy, fc);
      }
    }
  }
  b.yard = { P, W: Wd, D, type };
}

// ---------------------------------------------------------------- OSM footprints
function polyInfo(p) {
  const n = p.length / 2; let area = 0, convex = true, sign = 0, per = 0, longest = 0, li = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, k = (i + 2) % n;
    area += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
    const cr = (p[j * 2] - p[i * 2]) * (p[k * 2 + 1] - p[j * 2 + 1]) - (p[j * 2 + 1] - p[i * 2 + 1]) * (p[k * 2] - p[j * 2]);
    if (Math.abs(cr) > 0.5) { if (sign && Math.sign(cr) !== sign) convex = false; sign = sign || Math.sign(cr); }
    const l = Math.hypot(p[j * 2] - p[i * 2], p[j * 2 + 1] - p[i * 2 + 1]); per += l; if (l > longest) { longest = l; li = i; }
  }
  return { n, area: Math.abs(area) / 2, convex, per, longest, li };
}
function inPoly(p, x, z) {
  let inside = false; const n = p.length / 2;
  for (let k = 0, l = n - 1; k < n; l = k++) { const xk = p[k * 2], zk = p[k * 2 + 1], xl = p[l * 2], zl = p[l * 2 + 1]; if ((zk > z) !== (zl > z) && x < (xl - xk) * (z - zk) / (zl - zk) + xk) inside = !inside; }
  return inside;
}
// near-rectangle test: 4 corners with square-ish angles. Returns a frame + size, or null.
function rectFrame(p) {
  if (p.length !== 8) return null;
  const e = (i) => [p[((i + 1) % 4) * 2] - p[i * 2], p[((i + 1) % 4) * 2 + 1] - p[i * 2 + 1]];
  const e0 = e(0), e1 = e(1), l0 = Math.hypot(...e0), l1 = Math.hypot(...e1);
  if (l0 < 2 || l1 < 2 || Math.abs(e0[0] * e1[0] + e0[1] * e1[1]) / (l0 * l1) > 0.2) return null;
  const tx = e0[0] / l0, tz = e0[1] / l0, nx = e1[0] / l1, nz = e1[1] / l1;
  return { P: frameOf(p[0] + e0[0] / 2, p[1] + e0[1] / 2, tx, tz, nx, nz), w: l0, d: l1 };
}
function polyWalls(pen, p, y0, y1, col, cellW, floors) {
  const n = p.length / 2, fh = (y1 - y0) / floors;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; pen.wall([p[i * 2], p[i * 2 + 1]], [p[j * 2], p[j * 2 + 1]], y0, y1, col, cellW, fh, i); }
}
function polyCap(pen, p, y, col) {
  const n = p.length / 2, contour = [];
  for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) pen.tri([p[a * 2], y, p[a * 2 + 1]], [p[b * 2], y, p[b * 2 + 1]], [p[c * 2], y, p[c * 2 + 1]], col);
}
function parapetRoof(pen, p, y, wall, roofCol, ph = 0.55) {
  pen.style(S.PLAIN, 0);
  const n = p.length / 2;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; pen.quad([p[i * 2], y, p[i * 2 + 1]], [p[j * 2], y, p[j * 2 + 1]], [p[j * 2], y + ph, p[j * 2 + 1]], [p[i * 2], y + ph, p[i * 2 + 1]], mixc(wall, TRIM, 0.5)); }
  polyCap(pen, p, y + 0.08, roofCol);
}
// sloped rim (a skirt) rising inward from the eaves to a flat or pointed top
function skirtRoof(pen, p, cx, cz, y, rise, inset, col, rs, capCol, over = 0.5) {
  const n = p.length / 2, out = [], inn = [];
  let rmean = 0; for (let i = 0; i < n; i++) rmean += Math.hypot(p[i * 2] - cx, p[i * 2 + 1] - cz); rmean /= n;
  const fo = 1 + over / rmean, fi = Math.max(0, 1 - inset / rmean);
  for (let i = 0; i < n; i++) { const dx = p[i * 2] - cx, dz = p[i * 2 + 1] - cz; out.push([cx + dx * fo, y - 0.1, cz + dz * fo]); inn.push([cx + dx * fi, y + rise, cz + dz * fi]); }
  pen.style(S.ROOF, rs);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (fi > 0.02) pen.roof([out[i], out[j], inn[j], inn[i]], col); else pen.roof([out[i], out[j], inn[i]], col); }
  if (fi > 0.02) { pen.style(S.PLAIN, 0); const q = []; for (const v of inn) q.push(v[0], v[2]); polyCap(pen, q, y + rise - 0.25, capCol); }
}
function roofUnits(pen, p, cx, cz, ang, y, r, count, big) {
  pen.style(S.PLAIN, 0);
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let i = 0; i < count; i++) {
    const w = big ? 5 + r() * 5 : 1.6 + r() * 1.6, d = big ? 4 + r() * 4 : 1.4 + r() * 1.2, hh = big ? 2.6 + r() * 1.2 : 1.0 + r() * 0.7;
    const ox = (r() - 0.5) * (big ? 4 : 18), oz = (r() - 0.5) * (big ? 4 : 18);
    const x = cx + ox * c - oz * s, z = cz + ox * s + oz * c;
    const P = frameOf(x - (-s) * 0 - c * 0, z, c, s, -s, c);
    const ok = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].every(([u, v]) => { const [qx, qz] = P.g(u, v); return inPoly(p, qx, qz); });
    if (!ok) continue;
    solidBox(pen, P, -w / 2, w / 2, -d / 2, d / 2, y, y + hh, big ? C(0xe9e7e1) : C(0xb9bcbd), big ? C(0xd6d4cd) : C(0xa6a9aa));
  }
}

function osmBuilding(W, t, b, r, seed, isl) {
  const pen = new Pen(t.bld, [b.cx, -2, b.cz]), p = b.poly, info = polyInfo(p);
  const a = info.area, dflt = [7, 4.5, 10, 24].includes(b.h);
  const ang = Math.atan2(p[((info.li + 1) % info.n) * 2 + 1] - p[info.li * 2 + 1], p[((info.li + 1) % info.n) * 2] - p[info.li * 2]);
  let H = b.h;
  if (a < 330 && H < 9) {
    // a house: one or two storeys
    const two = dflt ? (H > 5 && r() < 0.28) : H > 5.5;
    H = two ? 6.1 + r() * 0.4 : 3.0 + r() * 0.4;
    const wall = pick(r, HOUSE_WALLS), kind = pick(r, isl ? ['tile', 'tile', 'metal', 'shingle'] : ['shingle', 'shingle', 'tile', 'metal']);
    const [rc, rs] = roofLook(r, kind);
    pen.style(S.HOUSE, seed); polyWalls(pen, p, 0, H, wall, 3.5, two ? 2 : 1);
    const rf = rectFrame(p), q = r();
    if (rf && q < 0.9) {
      pen.style(S.ROOF, rs); const rise = 1.3 + r() * 1.0;
      if (q < 0.6) hipRoof(pen, rf.P, -rf.w / 2, rf.w / 2, 0, rf.d, H, rise, 0.55, rc);
      else gableRoof(pen, rf.P, -rf.w / 2, rf.w / 2, 0, rf.d, H, rise, 0.55, rc, wall, rf.w >= rf.d, seed);
      b.h = H + rise * 0.5;
    } else if (info.convex && q < 0.85) { skirtRoof(pen, p, b.cx, b.cz, H, 1.5 + r(), 99, rc, rs, rc); b.h = H + 0.8; }
    else if (q < 0.8) { skirtRoof(pen, p, b.cx, b.cz, H, 1.2, 2.2, rc, rs, pick(r, FLAT_ROOFS)); b.h = H + 1.0; }
    else { parapetRoof(pen, p, H, wall, pick(r, FLAT_ROOFS), 0.4); b.h = H + 0.4; }
    return;
  }
  if (H < 9) {
    if (a >= 1500 && !isl) {
      // big box: plain walls, an accent band, glass doors here and there, roof units
      H = dflt ? 5.8 + r() * 2.4 : H;
      const wall = pick(r, [C(0xf1eee6), C(0xe6dcc8), C(0xd9d9d6), C(0xdcc9aa), C(0xf6f4ee), C(0xc9d3d6)]);
      pen.style(S.BIGBOX, seed); polyWalls(pen, p, 0, H, wall, 9, 1);
      parapetRoof(pen, p, H, wall, pick(r, FLAT_ROOFS)); roofUnits(pen, p, b.cx, b.cz, ang, H + 0.08, r, 3 + Math.floor(a / 900), false);
      b.h = H + 0.55; return;
    }
    // low-rise: island villas and clubhouses, mainland shops and small offices
    const floors = dflt ? (r() < (isl ? 0.55 : 0.4) ? 2 : 1) : Math.max(1, Math.round(H / 3.3));
    const fh = isl ? 3.1 : 3.7; H = floors * fh + (isl ? 0 : 0.5);
    const wall = pick(r, isl ? CONDO_WALLS : TOWN_WALLS), q = r();
    const sty = isl ? (q < 0.4 && floors > 1 ? S.BALCONY : q < 0.7 ? S.PUNCHED : S.HOUSE) : (q < 0.48 ? S.SHOP : q < 0.7 ? S.PUNCHED : q < 0.9 ? S.STRIP : S.BIGBOX);
    pen.style(sty, seed); polyWalls(pen, p, 0, H, wall, sty === S.SHOP ? 5 : sty === S.BALCONY ? 4.4 : sty === S.BIGBOX ? 9 : 3.6, sty === S.BIGBOX ? 1 : floors);
    if (isl && r() < 0.62) { const [rc, rs] = roofLook(r, r() < 0.75 ? 'tile' : 'metal'); skirtRoof(pen, p, b.cx, b.cz, H, 1.5, 2.6, rc, rs, pick(r, FLAT_ROOFS), 0.6); b.h = H + 1.3; }
    else { parapetRoof(pen, p, H, wall, pick(r, FLAT_ROOFS)); if (a > 500) roofUnits(pen, p, b.cx, b.cz, ang, H + 0.08, r, 1 + Math.floor(a / 700), false); b.h = H + 0.55; }
    return;
  }
  // mid-rise and towers
  const tower = H >= 20;
  if (dflt) H = tower ? (isl ? 22 + Math.floor(r() * 6) * 3.05 : 24 + Math.floor(r() * 5) * 3.4) : 9.3 + Math.floor(r() * 3) * 3.1;
  const q = r();
  let sty, wall, cellW, fh;
  if (isl) { sty = q < 0.72 ? S.BALCONY : q < 0.9 ? S.PUNCHED : S.STRIP; wall = pick(r, CONDO_WALLS); }
  else if (tower) { sty = q < 0.4 ? S.GLASS : q < 0.75 ? S.BALCONY : S.STRIP; wall = sty === S.GLASS ? pick(r, [C(0xdfe5e8), C(0xcfd6da), C(0xe9e6df)]) : pick(r, CONDO_WALLS); }
  else { sty = q < 0.3 ? S.PUNCHED : q < 0.55 ? S.SHOP : q < 0.8 ? S.STRIP : q < 0.9 ? S.GLASS : S.BALCONY; wall = pick(r, TOWN_WALLS); }
  cellW = sty === S.BALCONY ? 4.4 : sty === S.GLASS ? 1.6 : sty === S.SHOP ? 5 : 3.4; fh = sty === S.GLASS || sty === S.STRIP ? 3.6 : 3.05;
  const floors = Math.max(2, Math.round(H / fh));
  pen.style(sty, seed); polyWalls(pen, p, 0, H, wall, cellW, floors);
  parapetRoof(pen, p, H, wall, pick(r, FLAT_ROOFS), tower ? 0.9 : 0.6);
  roofUnits(pen, p, b.cx, b.cz, ang, H + 0.08, r, tower ? 1 : 2, tower);
  if (!tower) roofUnits(pen, p, b.cx, b.cz, ang, H + 0.08, r, 2, false);
  b.h = H + (tower ? 0.9 : 0.6);
}

// ---------------------------------------------------------------- entry point (replaces World.buildBuildings)
export function buildBuildings(W) {
  const stats = { house: 0, osm: 0 };
  for (const b of W.bList) {
    if (b.custom) continue;
    const t = W.tile(b.cx, b.cz), seed = hash2(b.cx, b.cz), r = rngFrom(seed);
    if (b.house) { house(W, t, b, r, seed); stats.house++; }
    else { osmBuilding(W, t, b, r, seed, b.cx < 6300); stats.osm++; }
  }
  for (const t of W.tiles.values()) { if (t.bld) t.bld.cur = [0, 0]; if (t.roads) t.roads.cur = [0, 0]; }
  W.buildingStats = stats;
}

// ---------------------------------------------------------------- the wall shader (patched into a Lambert material)
export function wallShader(sh) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 st;\nvarying vec2 vWin;\nvarying vec2 vSt;')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\nvWin = uv; vSt = st;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec2 vWin; varying vec2 vSt;
    float bRect(vec2 f, vec2 lo, vec2 hi) { return step(lo.x, f.x) * step(f.x, hi.x) * step(lo.y, f.y) * step(f.y, hi.y); }
    float bHash(vec2 c, float s) { return fract(sin(dot(c, vec2(12.9898, 78.233)) + s * 37.0) * 43758.5453); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
    {
      float sty = floor(vSt.x + 0.5), seed = vSt.y;
      vec3 wallC = diffuseColor.rgb, col = wallC;
      vec2 cell = floor(vWin), f = fract(vWin);
      float fw = max(fwidth(vWin.x), fwidth(vWin.y));
      float h1 = bHash(cell, seed);
      vec3 glass = mix(vec3(0.045, 0.07, 0.10), vec3(0.20, 0.31, 0.40), f.y);
      float avg = 0.0;                                             // share of glass, for the far-away blend
      if (sty < 0.5) {                                             // legacy: uv in metres
        if (vWin.y > 0.9) { vec2 g = vec2(fract(vWin.x / 3.1), fract((vWin.y - 0.4) / 3.2));
          col = mix(col, vec3(0.03, 0.04, 0.06), bRect(g, vec2(0.18, 0.3), vec2(0.78, 0.82)) * 0.85); }
        fw = 0.0;
      } else if (sty < 1.5) {                                      // house: trimmed windows, some bays blank, some with blinds
        float on = step(0.2, h1);
        col = mix(col, vec3(0.9, 0.9, 0.88), bRect(f, vec2(0.235, 0.27), vec2(0.765, 0.79)) * on);
        vec3 g2 = h1 > 0.72 ? mix(glass, vec3(0.62, 0.6, 0.55), 0.55) : glass;
        float mull = clamp(step(abs(f.x - 0.5), 0.012) + step(abs(f.y - 0.54), 0.012), 0.0, 1.0);
        col = mix(col, g2, bRect(f, vec2(0.27, 0.31), vec2(0.73, 0.75)) * on * (1.0 - mull * 0.8));
        avg = 0.16;
      } else if (sty < 2.5) {                                      // condo balconies: slab edge, rail, deep shaded glass, fin walls
        float glassRail = step(0.5, fract(seed * 7.13));
        vec3 rail = mix(wallC * 1.03, mix(wallC, vec3(0.55, 0.72, 0.78), 0.55), glassRail);
        float fin = step(f.x, 0.05) + step(0.95, f.x);
        vec3 inner = mix(glass * 0.8, wallC * 0.42, step(0.86, f.y) + 0.25 * step(h1, 0.3));
        col = inner;
        col = mix(col, rail, step(f.y, 0.36));
        col = mix(col, vec3(0.93, 0.93, 0.9), step(f.y, 0.085));
        col = mix(col, wallC, clamp(fin, 0.0, 1.0));
        avg = 0.42;
      } else if (sty < 3.5) {                                      // punched windows with a sill line
        float on = step(0.07, h1);
        col = mix(col, wallC * 0.82, bRect(f, vec2(0.2, 0.27), vec2(0.8, 0.31)) * on);
        col = mix(col, glass, bRect(f, vec2(0.22, 0.31), vec2(0.78, 0.78)) * on);
        avg = 0.24;
      } else if (sty < 4.5) {                                      // glass curtain wall, tinted per building
        vec3 tint = fract(seed * 5.7) < 0.4 ? vec3(0.10, 0.22, 0.30) : fract(seed * 5.7) < 0.75 ? vec3(0.08, 0.20, 0.20) : vec3(0.17, 0.19, 0.22);
        col = tint * (0.55 + 0.9 * f.y) * (0.85 + 0.3 * h1);
        col = mix(col, tint * 0.45, step(f.y, 0.17));
        col = mix(col, wallC * 0.8, clamp(step(f.x, 0.05) + step(f.y, 0.03), 0.0, 1.0));
        avg = 0.0; wallC = tint * 0.9;
      } else if (sty < 5.5) {                                      // shops: glass fronts under an awning, windows upstairs
        if (cell.y < 0.5) {
          vec3 aw = fract(seed * 3.3) < 0.25 ? vec3(0.02, 0.07, 0.2) : fract(seed * 3.3) < 0.5 ? vec3(0.03, 0.16, 0.1) : fract(seed * 3.3) < 0.7 ? vec3(0.35, 0.03, 0.03) : fract(seed * 3.3) < 0.85 ? vec3(0.02, 0.2, 0.22) : vec3(0.75, 0.7, 0.55);
          float stripe = fract(seed * 9.1) < 0.4 ? step(0.5, fract(vWin.x * 6.0)) : 0.0;
          col = mix(col, glass * 1.2, bRect(f, vec2(0.07, 0.1), vec2(0.93, 0.66)));
          col = mix(col, wallC * 0.75, step(abs(f.x - 0.5), 0.012) * bRect(f, vec2(0.07, 0.1), vec2(0.93, 0.66)));
          col = mix(col, mix(aw, vec3(0.9), stripe), bRect(f, vec2(0.03, 0.68), vec2(0.97, 0.86)));
        } else {
          float on = step(0.06, h1);
          col = mix(col, glass, bRect(f, vec2(0.14, 0.3), vec2(0.42, 0.78)) * on);
          col = mix(col, glass, bRect(f, vec2(0.58, 0.3), vec2(0.86, 0.78)) * on);
        }
        avg = 0.2;
      } else if (sty < 6.5) {                                      // strip windows
        float band = step(0.36, f.y) * step(f.y, 0.8);
        col = mix(col, glass * 1.1, band * step(0.035, f.x));
        avg = 0.4;
      } else if (sty < 7.5) {                                      // big box: accent band near the top, glass doors in some bays
        vec3 acc = fract(seed * 4.1) < 0.3 ? vec3(0.03, 0.2, 0.12) : fract(seed * 4.1) < 0.55 ? vec3(0.4, 0.05, 0.04) : fract(seed * 4.1) < 0.8 ? vec3(0.03, 0.1, 0.3) : vec3(0.5, 0.36, 0.18);
        col = mix(col, acc, step(0.8, f.y) * step(f.y, 0.9));
        col = mix(col, glass * 1.3, bRect(f, vec2(0.3, 0.0), vec2(0.7, 0.42)) * step(h1, 0.3));
        avg = 0.04;
      } else if (sty < 8.5) {                                      // roofs: uv in metres. seed < 0.5 barrel tile rows, > 0.5 standing seams, 0.5 plain
        if (seed < 0.49) { float row = fract(vWin.y / 0.42); float colm = fract(vWin.x / 0.3 + 0.5 * floor(vWin.y / 0.42));
          col *= (0.86 + 0.2 * row) * (0.93 + 0.1 * smoothstep(0.0, 0.5, abs(colm - 0.5) * 2.0)); col *= 0.95 + 0.1 * bHash(floor(vWin / vec2(0.3, 0.42)), seed); fw = max(fw / 0.36, 0.0); }
        else if (seed > 0.51) { float sm = abs(fract(vWin.x / 0.45) - 0.5) * 2.0; col *= 0.9 + 0.14 * smoothstep(0.0, 0.25, 1.0 - sm) - 0.1 * step(0.94, sm); fw = fw / 0.45; }
        else { col *= 0.93 + 0.12 * bHash(floor(vWin / vec2(0.9, 0.3)), seed); fw = fw / 0.6; }
        avg = 0.0; wallC = wallC * 0.97;
      } else if (sty > 9.5) {                                      // garage door panels
        col *= 0.9 + 0.1 * step(0.07, fract(vWin.y * 4.0)); col *= 0.95 + 0.05 * step(0.02, fract(vWin.x * 4.0)); fw = fw * 4.0;
      } else { fw = 0.0; }
      vec3 far = mix(wallC, vec3(0.07, 0.11, 0.15), avg);
      diffuseColor.rgb = mix(col, far, clamp(fw * 2.6 - 0.35, 0.0, 1.0));
    }`);
}
