// Road arrows: soft chevrons on the pavement that lead to the current mission checkpoint.
// The road network becomes a graph once; each new target gets one shortest-path sweep that
// stores, for every road point, the next point toward the target. Following that from wherever
// the player is costs almost nothing per frame and survives wrong turns.
import * as THREE from 'three';

const KIND_COST = { motorway: 0.9, trunk: 0.9, primary: 1.0, secondary: 1.1, tertiary: 1.25, residential: 1.7, unclassified: 1.7, service: 2.6 };
const COUNT = 11, SPACING = 14, FIRST = 7;

export class Nav {
  constructor(scene, world) {
    this.world = world;
    this.enabled = true;
    this.buildGraph();
    // one chevron, pointing along +X, lying flat
    const g = new THREE.BufferGeometry();
    const P = [[1.0, 0], [-0.25, 1.05], [-1.0, 1.05], [0.25, 0], [-1.0, -1.05], [-0.25, -1.05]];
    const tri = [0, 1, 3, 1, 2, 3, 0, 3, 5, 3, 4, 5];
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri.flatMap((i) => [P[i][0], 0, P[i][1]])), 3));
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.mesh = new THREE.InstancedMesh(g, mat, COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 3;
    for (let i = 0; i < COUNT; i++) this.mesh.setColorAt(i, new THREE.Color(0, 0, 0));
    scene.add(this.mesh);
    this.targetKey = '';
    this.next = null;
    this.t = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YZX');
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color();
  }

  buildGraph() {
    const W = this.world, ids = new Map();
    const nx = [], nz = [], ny = [], inc = [];
    const node = (x, z, y) => {
      const k = Math.round(x * 4) + ',' + Math.round(z * 4) + ',' + Math.round(y * 2);
      let i = ids.get(k);
      if (i === undefined) { i = nx.length; ids.set(k, i); nx.push(x); nz.push(z); ny.push(y); inc.push([]); }
      return i;
    };
    // same order as World.buildRoads, so segment index si lines up with world.segs
    const segA = [], segB = [], segOne = [];
    W.roads.forEach((rd) => {
      const p = rd.p, n = p.length / 3;
      if (n < 2) return;
      const f = KIND_COST[rd.k] || 1.6;
      for (let i = 0; i < n - 1; i++) {
        const a = node(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), b = node(p[i * 3 + 3], p[i * 3 + 4], p[i * 3 + 5]);
        const len = Math.hypot(p[i * 3 + 3] - p[i * 3], p[i * 3 + 4] - p[i * 3 + 1]);
        // inc[v] holds (u, cost of driving u to v, meters). Against a one-way costs a lot, not forbidden.
        inc[b].push(a, len * f, len);
        inc[a].push(b, len * f * (rd.o ? 8 : 1), len);
        segA.push(a); segB.push(b); segOne.push(rd.o ? 1 : 0);
      }
    });
    this.ok = segA.length === W.segs.length;
    Object.assign(this, { nx, nz, ny, inc, segA, segB, segOne });
  }

  nearestNode(x, z, y) {
    let best = -1, bd = 1e18;
    const { nx, nz, ny } = this;
    for (let i = 0; i < nx.length; i++) {
      const d = (nx[i] - x) ** 2 + (nz[i] - z) ** 2 + ((ny[i] - y) * 6) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // One sweep outward from the target over the whole network.
  solve(target) {
    const N = this.nx.length;
    const dist = new Float64Array(N).fill(Infinity), left = new Float32Array(N), next = new Int32Array(N).fill(-1);
    const t = this.nearestNode(target.x, target.z, target.y || 0);
    const heap = [];
    const push = (d, n) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; let i = 0;
        for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
      }
      return top;
    };
    dist[t] = 0; push(0, t);
    while (heap.length) {
      const [d, v] = pop();
      if (d > dist[v]) continue;
      const e = this.inc[v];
      for (let i = 0; i < e.length; i += 3) {
        const u = e[i], nd = d + e[i + 1];
        if (nd < dist[u]) { dist[u] = nd; left[u] = left[v] + e[i + 2]; next[u] = v; push(nd, u); }
      }
    }
    Object.assign(this, { dist, left, next, targetNode: t });
  }

  // The road segment under the player, as a world.segs index.
  segUnder(v) {
    const W = this.world, C = 40;
    let best = -1, bd = 1e9;
    const gx = Math.floor(v.pos.x / C), gz = Math.floor(v.pos.z / C);
    for (let ii = gx - 1; ii <= gx + 1; ii++) for (let jj = gz - 1; jj <= gz + 1; jj++) {
      const cell = W.segGrid.get(ii * 100000 + jj);
      if (!cell) continue;
      for (const si of cell) {
        const s = W.segs[si];
        const dx = s[3] - s[0], dz = s[4] - s[1], l2 = dx * dx + dz * dz || 1e-6;
        let u = ((v.pos.x - s[0]) * dx + (v.pos.z - s[1]) * dz) / l2; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const y = s[2] + (s[5] - s[2]) * u;
        if (Math.abs(y - v.y) > 3) continue;
        const d = Math.hypot(v.pos.x - s[0] - dx * u, v.pos.z - s[1] - dz * u) - s[6];
        if (d < bd) { bd = d; best = si; this._u = u; }
      }
    }
    return bd < 25 ? best : -1;
  }

  update(dt, v, target) {
    this.t += dt;
    const show = this.enabled && this.ok && target && v.kind !== 'boat' && v.kind !== 'air';
    if (!show) { this.mesh.visible = false; return; }
    const key = Math.round(target.x) + ',' + Math.round(target.z) + ',' + Math.round(target.y || 0);
    if (key !== this.targetKey) { this.targetKey = key; this.solve(target); }
    const si = this.segUnder(v);
    if (si < 0) { this.mesh.visible = false; return; }
    const W = this.world, s = W.segs[si], u = this._u, { nx, nz, ny, dist, left, next } = this;
    const a = this.segA[si], b = this.segB[si];
    const px = s[0] + (s[3] - s[0]) * u, pz = s[1] + (s[4] - s[1]) * u, py = s[2] + (s[5] - s[2]) * u;
    const segLen = Math.hypot(s[3] - s[0], s[4] - s[1]);
    // go on to either end of this segment; turning around costs a bit so the arrows do not flip-flop
    const [fx, fz] = v.fwd();
    const ahead = (n) => ((nx[n] - px) * fx + (nz[n] - pz) * fz) >= 0;
    const ca = dist[a] + segLen * u * (this.segOne[si] ? 8 : 1) + (ahead(a) ? 0 : 60);
    const cb = dist[b] + segLen * (1 - u) + (ahead(b) ? 0 : 60);
    let n = ca < cb ? a : b;
    this.behind = !ahead(n) && Math.hypot(nx[n] - px, nz[n] - pz) > 3;
    if (!isFinite(dist[n])) { this.mesh.visible = false; return; }
    // the path ahead as points with running distance
    const pts = [[px, py, pz, 0]];
    let run = 0, lx = px, lz = pz;
    const reach = FIRST + COUNT * SPACING + SPACING;
    for (let guard = 0; guard < 400 && n >= 0; guard++) {
      run += Math.hypot(nx[n] - lx, nz[n] - lz);
      pts.push([nx[n], ny[n] + 0.1, nz[n], run]);
      lx = nx[n]; lz = nz[n];
      if (run > reach) break;
      n = next[n];
    }
    const total = Math.hypot(nx[ca < cb ? a : b] - px, nz[ca < cb ? a : b] - pz) + left[ca < cb ? a : b];
    // chevrons sit at fixed spots on the road and drift toward the target
    const flow = (this.t * 3.2) % SPACING;
    const phase = ((total - flow) % SPACING + SPACING) % SPACING;
    let k = 1, shown = 0;
    for (let i = 0; i < COUNT; i++) {
      const d = FIRST + phase + i * SPACING;
      while (k < pts.length - 1 && pts[k][3] < d) k++;
      const A = pts[k - 1], B = pts[k];
      const span = B[3] - A[3];
      if (!B || d > B[3] || span < 0.01 || d > total - 4) { this._c.setRGB(0, 0, 0); this._s.setScalar(0.0001); this._m.compose(this._p, this._q, this._s); this.mesh.setMatrixAt(i, this._m); this.mesh.setColorAt(i, this._c); continue; }
      const w = (d - A[3]) / span;
      const dx = B[0] - A[0], dz = B[2] - A[2], dy = B[1] - A[1];
      const hl = Math.hypot(dx, dz) || 1;
      // keep to the right-hand lane on two-way roads
      const r = W.roadAt(A[0] + dx * w, A[2] + dz * w, A[1] + dy * w);
      const lane = r && !r.road.o && r.hw > 2.6 ? r.hw * 0.5 : 0;
      this._p.set(A[0] + dx * w - dz / hl * lane, A[1] + dy * w + 0.12, A[2] + dz * w + dx / hl * lane);
      this._e.set(0, Math.atan2(-dz, dx), Math.atan2(dy, hl));
      this._q.setFromEuler(this._e);
      this._s.setScalar(1.35);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      // fade in near the car, out in the distance, with a slow shimmer
      const fade = Math.min(1, (d - 3) / 6) * Math.min(1, (reach - SPACING - d) / 45);
      const glow = 0.55 * Math.max(0, fade) * (0.75 + 0.25 * Math.sin(this.t * 3 - i * 0.9));
      this._c.setRGB(glow, glow * 0.93, glow * 0.62);
      this.mesh.setColorAt(i, this._c);
      shown++;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.visible = shown > 0;
  }
}
