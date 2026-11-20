// Longboat Cruise: main loop, cameras, vehicle select, swaps, intro and menus.
import * as THREE from 'three';
import { makeSky } from './sky.js';
import { VEHICLES, CREDITS, PLACES, xz, MPH } from './config.js';
import { World } from './world.js';
import { waterUniforms } from './water.js';
import { createVehicle } from './vehicles.js';
import { HUD } from './hud.js';
import { Missions } from './missions.js';
import { Traffic } from './traffic.js';
import { BoatTraffic, Tanker } from './boats.js';
import { loadProps, Turtles, Flora } from './props.js';
import { Particles } from './effects.js';
import { input } from './input.js';
import { Radio } from './radio.js';
import { initAudio, engine, splashSound, chime, screech, setSiren, setRotor } from './audio.js';
import { Police } from './police.js';
import { Bikes } from './bikes.js';
import { Pelicans } from './pelicans.js';
import { BigMap } from './bigmap.js';
import { Nav } from './nav.js';
import { placeDadsPlace, buildDadsPlace, CanalDocks } from './dads.js';
import { buildArmands, armandsPlace } from './armands.js';
import { buildStreetView } from './streetview.js';
import { makeStore, makeWarehouse, makeDock, makeMarker, makeFreezerSet, makeForklift, makeTractor, makeTrailer, rectPoly } from './models.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const G = window.G = { input, time: 0, paused: false, defaultSun: 4.5, defaultAz: 115, camMode: 0, THREE };

// settings that stick between visits (pause menu, Settings)
const CAM_NAMES = ['Chase', 'Driver', 'Overhead'];
const settings = G.settings = { arrows: true, cam: 0, police: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('paradice-settings') || '{}')); } catch (e) { /* private mode */ }
if (params.has('camMode')) settings.cam = +params.get('camMode');
if (params.has('arrows')) settings.arrows = params.get('arrows') !== '0';
settings.cam = [0, 1, 2].includes(settings.cam) ? settings.cam : 0;
G.camMode = settings.cam;
function saveSettings() { try { localStorage.setItem('paradice-settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } }
function setCamMode(m, toast) {
  G.camMode = settings.cam = (m + 3) % 3;
  saveSettings(); showSettings();
  if (toast && G.hud) G.hud.toast(CAM_NAMES[G.camMode] + ' camera', 1.4);
  if (G.active) updateCamera(0.016, true);
}
function showSettings() {
  $('btnArrows').textContent = 'Road arrows: ' + (settings.arrows ? 'on' : 'off');
  $('btnCamera').textContent = 'Camera: ' + CAM_NAMES[G.camMode];
  $('btnPolice').textContent = 'Police patrols: ' + (settings.police ? 'on' : 'off');
  if (G.nav) G.nav.enabled = settings.arrows;
}

// ---------------------------------------------------------------- renderer and scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
G.renderer = renderer;

const scene = new THREE.Scene();
G.scene = scene;
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.4, 20000);
scene.add(camera);
const fogColor = new THREE.Color(0xd99a7c);
scene.fog = new THREE.Fog(fogColor, 450, 4200);

const sky = makeSky(9000);
scene.add(sky);
const sun = new THREE.DirectionalLight(0xffc28a, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 900 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffd6c0, 0x50604a, 1.25);
scene.add(hemi);

const pmrem = new THREE.PMREMGenerator(renderer);
const envSky = makeSky(500);
const envScene = new THREE.Scene(); envScene.add(envSky);
let envRT = null, envEl = 99;
const sunDir = new THREE.Vector3();

// el: degrees above the horizon. azDeg: compass bearing of the sun (115 = the sunrise over Sarasota Bay
// the game opens on, 245 = the Gulf sunset the Sunset Run counts down to).
G.setSun = (el, azDeg = G.defaultAz) => {
  const turned = G.sunAz !== undefined && G.sunAz !== azDeg;
  G.sunEl = el; G.sunAz = azDeg;
  const az = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(el);
  sunDir.set(Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e));
  const k = THREE.MathUtils.clamp((el + 1) / 7, 0, 1);
  for (const s of [sky, envSky]) {
    const u = s.material.uniforms;
    u.uSun.value.copy(sunDir);
    u.uHorizon.value.setRGB(1.0, 0.42 + 0.14 * k, 0.24 + 0.08 * k);
    u.uMid.value.setRGB(0.45 + 0.1 * k, 0.26 + 0.08 * k, 0.42 + 0.06 * k);
    u.uBright.value = 0.6 + 0.3 * k;
  }
  sun.intensity = 0.6 + 2.6 * k;
  sun.color.setRGB(1.0, 0.55 + 0.25 * k, 0.32 + 0.22 * k);
  hemi.intensity = 0.55 + 0.75 * k;
  fogColor.setRGB(0.62 + 0.18 * k, 0.4 + 0.12 * k, 0.42 + 0.06 * k);
  scene.fog.color.copy(fogColor);
  waterUniforms.uFogColor.value.copy(fogColor);
  waterUniforms.uSunDir.value.copy(sunDir);
  waterUniforms.uSkyColor.value.setRGB(0.95, 0.5 + 0.15 * k, 0.42 + 0.1 * k);
  waterUniforms.uSunColor.value.setRGB(1.0, 0.45 + 0.25 * k, 0.2 + 0.15 * k);
  if (turned || Math.abs(el - envEl) > 1.2) {
    envEl = el;
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene);
    if (G.envBroken === undefined) G.envBroken = params.has('noenv') || !envWorks(envRT.texture);
    const env = G.envBroken ? null : envRT.texture;
    scene.environment = env;
    G.envTex = env;
    if (G.selScene) G.selScene.environment = env;
    scene.environmentIntensity = 0.9;
  }
  if (G.envBroken) hemi.intensity += 0.6;
};

// Car material mode (2026-11-15, black cars in Safari on the M1 iMac, not reproducible elsewhere).
// The world draws with MeshLambertMaterial and looks right there; the cars use Standard/Physical PBR.
// Safari gets 'lambert' (the world's own material, known good) unless ?carmat=standard|physical says
// otherwise; every other browser keeps 'physical' (no change). ?diag=1 prints the mode on screen.
const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg/.test(navigator.userAgent);
G.carMat = params.get('carmat') || (isSafari ? 'lambert' : 'physical');
const swapped = new WeakMap();
G.fixMaterial = (m) => {
  if (!m || !m.isMeshStandardMaterial || G.carMat === 'physical') return m;
  if (swapped.has(m)) return swapped.get(m);
  const p = { color: m.color, map: m.map, emissive: m.emissive, emissiveMap: m.emissiveMap, emissiveIntensity: m.emissiveIntensity,
    normalMap: m.normalMap, alphaMap: m.alphaMap, side: m.side, transparent: m.transparent, opacity: m.opacity,
    alphaTest: m.alphaTest, vertexColors: m.vertexColors, fog: m.fog, name: m.name };
  if (m.transmission > 0) { p.transparent = true; p.opacity = Math.min(p.opacity, 0.35); }
  let n;
  if (G.carMat === 'lambert') n = new THREE.MeshLambertMaterial(p);
  else n = new THREE.MeshStandardMaterial({ ...p, roughness: Math.max(m.roughness, 0.35), metalness: Math.min(m.metalness, 0.35), roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap });
  n.userData = m.userData;
  swapped.set(m, n); swapped.set(n, n);
  return n;
};
G.fixMaterials = (root) => root.traverse((o) => {
  if (!o.isMesh || !o.material) return;
  o.material = Array.isArray(o.material) ? o.material.map(G.fixMaterial) : G.fixMaterial(o.material);
});
if (params.has('diag')) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;background:#000c;color:#0f0;font:13px monospace;padding:6px 8px;border-radius:4px;pointer-events:none';
  document.body.appendChild(d);
  setInterval(() => { d.textContent = `carmat=${G.carMat} safari=${isSafari} envBroken=${G.envBroken} programs=${renderer.info.programs?.length} ${navigator.userAgent.replace(/.*(Version\/\S+).*/, '$1')}`; }, 1000);
}

// Fallback sweep: catch anything added to the scene later (traffic, police, props, code-built cars).
if (true) {
  const seen = new WeakSet();
  setInterval(() => {
    if (!G.envBroken && G.carMat === 'physical') return;
    for (const sc of [scene, G.selScene]) if (sc) sc.traverse((o) => {
      if (!o.isMesh) return;
      if (G.carMat !== 'physical') { G.fixMaterials(o); return; }
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || seen.has(m) || !m.isMeshStandardMaterial) continue;
        seen.add(m);
        if (m.metalness > 0.35) { m.metalness = 0.35; m.roughness = Math.max(m.roughness, 0.35); }
      }
    });
  }, 1500);
}

// Some Safari builds (seen on an M1 iMac, 2026-11-15) produce a reflection map that turns
// every MeshStandard/Physical material black. Probe it once: a white non-metal sphere lit
// only by the environment, read back through an 8-bit target. Black or NaN means broken,
// and the cars fall back to plain lights (vehicles.js tones down metalness).
function envWorks(tex) {
  try {
    const rt = new THREE.WebGLRenderTarget(8, 8);
    const s = new THREE.Scene(); s.environment = tex;
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 10); cam.position.z = 3;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.6 }));
    s.add(ball);
    const prevTM = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(rt); renderer.render(s, cam); renderer.setRenderTarget(null);
    renderer.toneMapping = prevTM;
    const px = new Uint8Array(4); renderer.readRenderTargetPixels(rt, 4, 4, 1, 1, px);
    rt.dispose(); ball.geometry.dispose(); ball.material.dispose();
    const ok = px[0] + px[1] + px[2] > 12;
    console.log('env probe', Array.from(px).join(','), ok ? 'ok' : 'BROKEN, using fallback lighting');
    return ok;
  } catch (e) { console.warn('env probe failed', e); return true; }
}
G.setSun(G.defaultSun);

// particles
G.fx = {
  wake: new Particles(scene, 4000),
  spray: new Particles(scene, 2500),
  splash: new Particles(scene, 800),
  confetti: new Particles(scene, 800),
};

// ---------------------------------------------------------------- loading
const world = new World();
G.world = world;
const setLoad = (msg) => { $('loadmsg').textContent = msg; };

function placeStoreAndWarehouse(W) {
  // grocery store on the real footprint at the Shoppes of Bay Isles; front faces east to the lot
  const [px, pz] = xz(...PLACES.publix.ll);
  const sc = { cx: -431, cz: -286 };
  if (Math.hypot(sc.cx - px, sc.cz - pz) > 120) { sc.cx = px; sc.cz = pz; }
  G.store = { cx: sc.cx, cz: sc.cz, w: 68, d: 58, ang: Math.PI / 2 };
  // cold-storage warehouse on Fruitville Road, a block from the Sarasota bayfront, facing the road
  const [wx, wz] = PLACES.warehouse.xz;
  const cx = wx, cz = wz;
  G.warehouse = { cx, cz, ang: 0 };
  W.exclusions.push([G.store.cx, G.store.cz, 48], [cx, cz, 40]);
  placeDadsPlace(W, G);
  { const A = armandsPlace(W); W.exclusions.push([A.x, A.z, A.clear]); }   // St. Armands Circle: the six merged OSM blocks go, js/armands.js builds the shop ring
}

function buildSetPieces() {
  const W = world;
  // store
  const st = G.store;
  const g = makeStore(st.w, st.d);
  g.position.set(st.cx, 0, st.cz); g.rotation.y = st.ang;
  scene.add(g); g.updateMatrixWorld(true);
  st.group = g;
  const dl = g.userData.dockLocal.clone(); g.localToWorld(dl);
  const n = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), st.ang);
  st.dock = { x: dl.x, z: dl.z, heading: Math.atan2(-n.z, n.x) };
  const fr = new THREE.Vector3(0, 0, st.d / 2 + 32); g.localToWorld(fr);
  const look = new THREE.Vector3(st.w * 0.12, 3, st.d / 2); g.localToWorld(look);
  st.front = { x: fr.x, y: 5, z: fr.z, look };
  W.bList[W.addCollider(rectPoly(st.cx, st.cz, st.w, st.d, st.ang), 9)].custom = true;
  // warehouse
  const wh = G.warehouse;
  const { cx, cz } = wh;
  const wg = makeWarehouse(60, 34);
  wg.position.set(wh.cx, 0, wh.cz); wg.rotation.y = wh.ang;
  scene.add(wg);
  W.bList[W.addCollider(rectPoly(wh.cx, wh.cz, 60, 34, wh.ang), 10)].custom = true;
  const snap = (x, z) => W.nearestRoadPoint(x, z, { name: 'Fruitville Road', ground: true });
  const f1 = snap(cx + 52, cz + 34), f2 = snap(cx - 48, cz + 34), ts = snap(cx + 30, cz + 34);
  wh.front = { x: f1.x, z: f1.z };
  wh.side = { x: f2.x, z: f2.z };
  // the westbound side of Fruitville Road, pointed toward the bayfront and the causeway
  wh.truckSpot = { x: ts.x, z: ts.z, heading: Math.cos(ts.heading) < 0 ? ts.heading : ts.heading + Math.PI };
  // Dad's place on Cutter Lane: his house, his dock on the canal behind it (both boats, two kayaks).
  // The gold marker in the street is where a car swaps to his boat.
  buildDadsPlace(scene, W, G);
  buildArmands(scene, W, G);   // St. Armands Circle (2026-11-16)
  if (!params.has("nosv")) buildStreetView(scene, W, G);   // Street View pass (2026-11-20): bridge, Gulf of Mexico Drive, Cutter Lane
  if (!G.dockBoat) {   // Cutter Lane missing from the map data: fall back to the old Harbourside dock
    const [dcx, dcz] = PLACES.dockCar.xz, [dbx, dbz] = PLACES.dockBoat.xz;
    G.dockCar = { x: dcx, z: dcz }; G.dockBoat = { x: dbx, z: dbz, h: 0 }; G.dadsPlace = { x: dcx, z: dcz };
    const dock = makeDock(Math.hypot(dbx - dcx, dbz - dcz) - 2);
    dock.position.set(dcx + 6, 0, dcz + 3.5); dock.rotation.y = Math.atan2(-(dbz - dcz), dbx - dcx);
    scene.add(dock);
  }
  G.dockMarker = makeMarker(0xffd34d, "Dad's place");
  G.dockMarker.position.set(G.dockCar.x, 0, G.dockCar.z);
  G.dockMarker.scale.set(0.6, 0.5, 0.6);
  scene.add(G.dockMarker);
}

// ---------------------------------------------------------------- vehicles
G.vehicles = {};
async function getVehicle(id) {
  if (!G.vehicles[id]) G.vehicles[id] = await createVehicle(VEHICLES.find((v) => v.id === id));
  return G.vehicles[id];
}
function setActive(v) {
  if (G.active && G.active !== v && G.active.kind === 'air') G.active.root.removeFromParent();
  G.active = v;
  if (!v.root.parent) scene.add(v.root);
  if (v.trailerRoot && !v.trailerRoot.parent) scene.add(v.trailerRoot);
  G.hud && G.hud.hint('');
}
G.boatId = 'boat';
G.goBoat = async (x, z, h) => {
  const b = await getVehicle(G.boatId);
  if (G.active && G.active !== b && G.active.kind === 'car') { G.active.vel.set(0, 0); G.active.speed = 0; }
  if (x === undefined) { x = G.dockBoat.x; z = G.dockBoat.z; h = G.dockBoat.h; }
  b.place(x, z, h, -0.35);
  setActive(b);
};
G.backToCar = () => {
  const c = G.car;
  if (G.active && G.active.kind === 'truck') G.leaveTruck(true);
  if (G.active && G.active.kind === 'boat') { G.active.place(G.dockBoat.x, G.dockBoat.z, G.dockBoat.h, -0.35); }
  const r = world.nearestRoadPoint(G.dockCar.x, G.dockCar.z, { ground: true });
  if (G.active && G.active.kind === 'boat') c.place(r.x, r.z, r.heading, 0);
  setActive(c);
};
G.useTruck = async () => {
  const t = await getVehicle('semi');
  if (G.active && G.active.kind === 'car') G.parked = { v: G.active, x: G.active.pos.x, z: G.active.pos.z, h: G.active.heading };
  setActive(t);
  return t;
};
G.leaveTruck = (silent) => {
  const t = G.vehicles.semi;
  if (!t) return;
  t.root.removeFromParent(); t.trailerRoot.removeFromParent(); t.clearFlying();
  const c = G.car;
  const r = world.nearestRoadPoint(t.pos.x, t.pos.z, { ground: true });
  c.place(r.x + Math.cos(r.heading) * 8, r.z - Math.sin(r.heading) * 8, r.heading, 0);
  setActive(c);
};

// the player's boat bumps off Dad's bigger boat at the dock
function dadsDockHit(v) {
  let hit = 0;
  for (const [x, z, r] of G.dadsDockCircles || []) {
    const dx = v.pos.x - x, dz = v.pos.z - z, d = Math.hypot(dx, dz), R = r + 1.4;
    if (d >= R || d < 1e-3) continue;
    const nx = dx / d, nz = dz / d, into = v.vel.x * nx + v.vel.y * nz;
    if (into < 0) { v.vel.x -= nx * into * 1.3; v.vel.y -= nz * into * 1.3; hit = Math.max(hit, -into); }
    v.pos.x += nx * (R - d); v.pos.z += nz * (R - d);
  }
  return hit;
}

function respawnOnRoad(v) {
  const p = G.lastGood || { x: v.pos.x, z: v.pos.z };
  const r = world.nearestRoadPoint(p.x, p.z, { ground: true });
  v.place(r.x, r.z, r.heading, r.y);
  if (v.trailerRoot) v.place(r.x, r.z, r.heading, r.y);
}

// ---------------------------------------------------------------- cameras
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camUp = new THREE.Vector3(1, 0, 0);
let cine = null;
function updateCamera(dt, snap) {
  const v = G.active;
  if (G.freeCam) { camera.position.set(...G.freeCam.pos); camera.lookAt(...G.freeCam.look); return; }   // test screenshots only
  if (params.has('cam')) { const c = params.get('cam').split(',').map(Number); camera.position.set(v.pos.x + c[0], v.y + c[1], v.pos.z + c[2]); camera.lookAt(v.pos.x, v.y, v.pos.z); return; }
  if (cine) {
    camera.position.lerp(cine.pos, Math.min(1, dt * 1.5));
    camLook.lerp(cine.look, Math.min(1, dt * 2));
    camera.lookAt(camLook);
    return;
  }
  const [fx, fz] = v.fwd();
  camera.up.set(0, 1, 0);
  // the driver view swaps a car's body for its cockpit; every other view shows the body
  for (const o of Object.values(G.vehicles)) if (o.cockpit) { const drv = o === v && G.camMode === 1 && !cine; o.cockpit.visible = drv; o.model.visible = !drv; }
  if (G.camMode === 1 && v.kind === 'air') { airDriverView(v); return; }
  if (G.camMode === 1) {
    // driver's seat, looking down the road
    const seat = v.seat || v.hood;
    v.root.updateMatrixWorld(true);
    const p = seat.clone(); v.body.localToWorld(p);
    const ahead = seat.clone().add(new THREE.Vector3(30, -1.2, -seat.z * 0.6)); v.body.localToWorld(ahead);
    camera.position.copy(p); camera.lookAt(ahead);
    camPos.copy(p); camLook.copy(ahead);
    return;
  }
  if (v.kind === 'air' && G.camMode !== 2) { airCamera(v, dt, snap); return; }
  const big = v.kind === 'truck';
  if (G.camMode === 2) {
    // overhead: straight down, the way you are heading is up the screen
    const sp = Math.abs(v.speed);
    const h = (big ? 80 : v.kind === 'boat' ? 70 : v.fly === 'jet' ? 140 : v.kind === 'air' ? 60 : 44) + Math.min(v.kind === 'air' ? 90 : 30, sp * 0.9);
    const lead = Math.min(26, v.speed * 0.6) + (big ? -4 : 3);
    const want = new THREE.Vector3(v.pos.x + fx * lead, v.y + h, v.pos.z + fz * lead);
    if (snap) { camPos.copy(want); camUp.set(fx, 0, fz); }
    camPos.lerp(want, 1 - Math.exp(-dt * 4));
    camUp.lerp(new THREE.Vector3(fx, 0, fz), 1 - Math.exp(-dt * 3.5));
    if (camUp.lengthSq() < 1e-4) camUp.set(fx, 0, fz);
    camera.position.copy(camPos);
    camera.up.copy(camUp).normalize();
    camLook.set(camPos.x, v.y, camPos.z);
    camera.lookAt(camLook);
    return;
  }
  const dist = big ? 24 : v.kind === 'boat' ? (v.def.boat ? 7.5 : 13) : 7.6 + Math.min(2.5, Math.abs(v.speed) * 0.05);
  const hgt = big ? 8 : v.kind === 'boat' ? (v.def.boat ? 2.8 : 4.6) : 3.0;
  // look back smoothly along velocity when reversing hard
  let hx = fx, hz = fz;
  if (v.speed < -3) { hx = -fx; hz = -fz; }
  const want = new THREE.Vector3(v.pos.x - hx * dist, v.y + hgt, v.pos.z - hz * dist);
  const r = world.roadAt(want.x, want.z, v.y);
  want.y = Math.max(want.y, (r ? r.y : 0) + 1.2);
  const look = new THREE.Vector3(v.pos.x + fx * 4, v.y + (big ? 3 : 1.3), v.pos.z + fz * 4);
  if (snap) { camPos.copy(want); camLook.copy(look); }
  camPos.lerp(want, 1 - Math.exp(-dt * (big ? 3 : 5)));
  camLook.lerp(look, 1 - Math.exp(-dt * 10));
  camera.position.copy(camPos);
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake; camera.position.y += (Math.random() - 0.5) * G.shake; G.shake *= Math.exp(-dt * 6); }
  camera.lookAt(camLook);
}
// chase camera for the flyers: behind and above along the flight path, rolled a little with the jet's bank
const _d3 = new THREE.Vector3(), _up = new THREE.Vector3();
function airCamera(v, dt, snap) {
  const [fx, fz] = v.fwd();
  const jet = v.fly === 'jet', heli = v.fly === 'heli';
  const g = jet ? v.gamma : 0;
  _d3.set(fx * Math.cos(g), Math.sin(g), fz * Math.cos(g));
  const dist = jet ? 24 + Math.min(10, v.speed * 0.04) : heli ? 17 : 6.5 + Math.min(4, Math.abs(v.speed) * 0.08);
  const hgt = jet ? 6 : heli ? 6 : 2.4;
  const want = new THREE.Vector3(v.pos.x - _d3.x * dist, v.y + hgt - _d3.y * dist * 0.6, v.pos.z - _d3.z * dist);
  want.y = Math.max(want.y, v.groundAt(world, want.x, want.z, want.y + 2) + 1.5);
  const look = new THREE.Vector3(v.pos.x + _d3.x * 10, v.y + (jet ? 3 : heli ? 1.5 : 1.3) + _d3.y * 10, v.pos.z + _d3.z * 10);
  if (snap) { camPos.copy(want); camLook.copy(look); }
  camPos.lerp(want, 1 - Math.exp(-dt * (jet ? 6 : 5)));
  camLook.lerp(look, 1 - Math.exp(-dt * 10));
  camera.position.copy(camPos);
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake; camera.position.y += (Math.random() - 0.5) * G.shake; G.shake *= Math.exp(-dt * 6); }
  _up.set(0, 1, 0).applyAxisAngle(_d3, jet ? v.bank * 0.35 : 0);
  camera.up.copy(_up);
  camera.lookAt(camLook);
}
function airDriverView(v) {
  v.root.updateMatrixWorld(true);
  const p = v.seat.clone(); v.body.localToWorld(p);
  const ahead = v.seat.clone().add(new THREE.Vector3(40, -2, 0)); v.body.localToWorld(ahead);
  camera.up.set(0, 1, 0).applyQuaternion(v.body.getWorldQuaternion(new THREE.Quaternion()));
  camera.position.copy(p); camera.lookAt(ahead);
  camPos.copy(p); camLook.copy(ahead);
}
G.celebrate = (front, cb) => {
  cine = { pos: new THREE.Vector3(front.x, front.y, front.z), look: front.look.clone() };
  for (let i = 0; i < 300; i++) {
    const c = [[1, 0.2, 0.3], [1, 0.85, 0.2], [0.2, 0.8, 0.6], [0.3, 0.5, 1]][i % 4];
    G.fx.confetti.emit(front.look.x + (Math.random() - 0.5) * 14, 9 + Math.random() * 3, front.look.z + (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, { life: 5, s0: 0.25, s1: 0.25, grav: 1.5, alpha: 1, color: c });
  }
  setTimeout(() => { cb(); }, 5500);
  G.onCardClose = () => { cine = null; };
};

// ---------------------------------------------------------------- intro: the freezer warehouse
let intro = null;
G.startIntro = (done) => {
  if (!intro) {
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x05080d);
    s.fog = new THREE.Fog(0x0a1220, 15, 70);
    s.add(makeFreezerSet());
    const trailer = makeTrailer();
    trailer.position.set(0, 0, 26); trailer.rotation.y = -Math.PI / 2;
    const tractor = makeTractor();
    tractor.position.set(0, 0, 28.5); tractor.rotation.y = -Math.PI / 2;
    s.add(trailer, tractor);
    const lifts = [makeForklift(), makeForklift(), makeForklift()];
    lifts.forEach((f) => s.add(f));
    const glow = new THREE.PointLight(0xff2040, 40, 18, 1.5); glow.position.set(0, 3, 13); s.add(glow);
    const cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
    intro = { s, trailer, lifts, cam };
  }
  intro.t = 0; intro.done = done; intro.loaded = 4;
  intro.trailer.userData.setCount(4);
  G.mode = 'intro';
  $('introText').style.display = 'block';
  $('hud').style.display = 'none';
  $('toast').classList.remove('show'); G.hud.toastT = 0;
  G.hud.mission(''); G.hud.hint('');
};
function updateIntro(dt) {
  const I = intro;
  I.t += dt;
  const T = 13;
  I.lifts.forEach((f, i) => {
    const ph = ((I.t * 0.32 + i / 3) % 1);
    const sx = -10 + i * 4.5, start = new THREE.Vector3(sx, 0, -8), end = new THREE.Vector3((i - 1) * 0.8, 0, 9.4);
    let p, carrying;
    if (ph < 0.45) { p = start.clone().lerp(end, ph / 0.45); carrying = true; }
    else if (ph < 0.55) { p = end.clone(); carrying = ph < 0.5; }
    else { p = end.clone().lerp(start, (ph - 0.55) / 0.45); carrying = false; }
    const dir = ph < 0.5 ? end.clone().sub(start) : start.clone().sub(end);
    f.position.copy(p);
    f.rotation.y = Math.atan2(-dir.z, dir.x) + (ph >= 0.55 ? Math.PI : 0);
    f.userData.forks.position.y = carrying ? 0.6 + Math.sin(I.t * 3 + i) * 0.05 : 0.1;
    f.userData.crate.visible = carrying;
    const key = 'c' + i;
    if (ph > 0.5 && !I[key]) { I[key] = true; I.loaded = Math.min(36, I.loaded + 3); I.trailer.userData.setCount(I.loaded); }
    if (ph < 0.5) I[key] = false;
  });
  const k = I.t / T;
  I.cam.position.set(-12 + k * 6, 2.6 + k * 3.5, -17 + k * 13);
  I.cam.lookAt(-2 + k * 2, 1.4, 8 + k * 3);
  renderer.render(I.s, I.cam);
  if (I.t > T || (I.t > 0.6 && (input.any || input.throttle || input.confirm))) {
    $('introText').style.display = 'none';
    $('hud').style.display = 'block';
    G.mode = 'play';
    const cb = I.done; I.done = null;
    cb && cb().then?.(() => updateCamera(0.016, true));
    setTimeout(() => updateCamera(0.016, true), 50);
  }
}

// ---------------------------------------------------------------- select screen
const sel = G.sel = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200), idx: 0, holder: new THREE.Group(), token: 0 };
{
  const s = sel.scene;
  G.selScene = s; s.environment = G.envTex;
  const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
  const c = bg.getContext('2d'); const gr = c.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#2b2f5a'); gr.addColorStop(0.55, '#e0806a'); gr.addColorStop(0.75, '#ffb46e'); gr.addColorStop(1, '#3a2a35');
  c.fillStyle = gr; c.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(bg); t.colorSpace = THREE.SRGBColorSpace; s.background = t;
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.25, 48), new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.3, metalness: 0.5 }));
  plat.position.y = -0.125; plat.receiveShadow = true; s.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.04, 6, 64), new THREE.MeshBasicMaterial({ color: 0xffb46e }));
  ring.rotation.x = Math.PI / 2; s.add(ring);
  const key = new THREE.DirectionalLight(0xffd2a8, 3); key.position.set(-6, 5, 4); s.add(key);
  const rim = new THREE.DirectionalLight(0x9ab0ff, 1.5); rim.position.set(5, 3, -6); s.add(rim);
  s.add(new THREE.HemisphereLight(0xffe0d0, 0x302830, 1.0));
  s.add(sel.holder);
  sel.cam.position.set(0, 2.2, 9.5); sel.cam.lookAt(0, 0.6, 0);
}
function buildSelectList() {
  const list = $('vlist');
  list.innerHTML = '';
  VEHICLES.forEach((v, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="vn">${v.name}</span><span class="vy">${v.year}</span>`;
    b.dataset.id = v.id;
    b.onclick = () => { initAudio(); showVehicle(i); };
    b.ondblclick = () => startDrive();
    list.appendChild(b);
  });
}
async function showVehicle(i) {
  sel.idx = (i + VEHICLES.length) % VEHICLES.length;
  [...$('vlist').children].forEach((b, k) => b.classList.toggle('on', k === sel.idx));
  const def = VEHICLES[sel.idx];
  $('vname').textContent = def.name;
  $('vyear').textContent = def.year + (def.note ? ' . ' + def.note : '');
  $('vcredit').textContent = CREDITS[def.credit] || '';
  const tok = ++sel.token;
  $('vload').style.display = 'block';
  const v = await getVehicle(def.id);
  if (tok !== sel.token) return;
  $('vload').style.display = 'none';
  sel.holder.clear();
  const disp = new THREE.Group();
  if (def.kind === 'truck') {
    const t = makeTractor(), tr = makeTrailer(); tr.userData.setCount(36);
    tr.position.x = t.userData.hitch; disp.add(t, tr); disp.scale.setScalar(0.31);
    // put the middle of the whole rig (bumper to tailgate) on the turntable's center
    const rb = new THREE.Box3().setFromObject(disp);
    disp.position.x = -(rb.min.x + rb.max.x) / 2; disp.position.z = -(rb.min.z + rb.max.z) / 2;
  } else {
    const m = v.model.clone(true); m.visible = true; disp.add(m);
    const pin = v.pin.clone(true); pin.position.copy(v.pin.position); pin.scale.copy(v.pin.scale); disp.add(pin);
    pin.userData.hub = pin.children[1];
    if (def.kind === 'boat') { disp.position.y = 0.55; disp.scale.setScalar(0.85); }
    if (def.kind === 'air') {
      // the jet and helicopter shrink to fit the turntable, the jetpack pilot grows
      const bb = new THREE.Box3().setFromObject(disp), size = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
      const k = def.fly === 'jetpack' ? 2.4 : Math.min(1, 6.6 / size);
      disp.scale.setScalar(k);
      disp.position.x = -(bb.min.x + bb.max.x) / 2 * k;
    }
  }
  sel.holder.add(disp);
  sel.disp = disp;
}
function updateSelect(dt) {
  sel.holder.rotation.y += dt * 0.45;
  if (sel.disp && sel.disp.children) sel.disp.traverse((o) => { if (o.userData.hub && o.userData.hub.isObject3D) o.userData.hub.rotation.x += dt * 4; });
  if (input.up) showVehicle(sel.idx - 1);
  if (input.down) showVehicle(sel.idx + 1);
  if (input.confirm) startDrive();
  if (G.started && G.active && (input.vehicles || input.pause)) closeSelect();
  renderer.render(sel.scene, sel.cam);
}
async function startDrive() {
  initAudio();
  if (G.radio) G.radio.start();
  const def = VEHICLES[sel.idx];
  $('select').style.display = 'none';
  $('hud').style.display = 'block';
  G.mode = 'play';
  stopMissionQuietly();
  const from = G.active && G.started ? { x: G.active.pos.x, z: G.active.pos.z, h: G.active.heading, y: G.active.y, kind: G.active.kind } : null;
  if (G.active && G.active.kind === 'truck') G.leaveTruck(true);
  const carDef = def.kind === 'car' ? def : (G.car ? G.car.def : VEHICLES[0]);
  const car = await getVehicle(carDef.id);
  if (G.car && G.car !== car) G.car.root.removeFromParent();
  G.car = car;
  if (def.kind === 'boat' && def.id !== G.boatId) {
    // switching hulls (Dad's boat or the jet ski): the old one leaves the dock
    const old = G.vehicles[G.boatId]; if (old) old.root.removeFromParent();
    G.boatId = def.id;
  }
  const boat = await getVehicle(G.boatId);
  scene.add(boat.root);
  if (!G.started) boat.place(G.dockBoat.x, G.dockBoat.z, G.dockBoat.h, -0.35);
  if (def.kind === 'air') {
    const f = await getVehicle(def.id);
    let x, z, h;
    if (from) { x = from.x; z = from.z; h = from.h; }
    else {
      const sp = world.nearestRoadPoint(...xz(...PLACES.spawn.ll), { name: 'Gulf of Mexico Drive', ground: true });
      x = sp.x; z = sp.z; h = Math.cos(sp.heading) > 0 ? sp.heading + Math.PI : sp.heading;
    }
    if (!G.started) { const r = world.nearestRoadPoint(x, z, { ground: true }); car.place(r.x, r.z, r.heading, 0); }
    car.root.removeFromParent();
    if (from && from.kind === 'air' && G.active === f) { /* same flyer: carry on */ }
    else f.launch(x, z, h, world);
    if (!f.root.parent) scene.add(f.root);
    setActive(f);
    G.hud.toast(def.fly === 'jet' ? 'Fighter jet: W throttle, A/D bank, Space pull up, Shift dive' : 'Space to climb, Shift to come down, W to fly forward', 4);
  } else if (def.kind === 'boat') {
    const r = world.nearestRoadPoint(G.dockCar.x, G.dockCar.z, { ground: true });
    car.place(r.x, r.z, r.heading, 0); scene.add(car.root);
    await G.goBoat();
  } else if (def.kind === 'truck') {
    const t = await G.useTruck();
    const s = G.warehouse.truckSpot;
    t.place(s.x, s.z, s.heading, 0);
    car.place(s.x, s.z + 6, s.heading, 0); car.root.removeFromParent();
  } else {
    if (!G.started || params.has('spawn')) {
      const s0 = startPose();
      car.place(s0.x, s0.z, s0.h, s0.y);
      if (!G.started) { const k = 13; car.vel.set(Math.cos(s0.h) * k, -Math.sin(s0.h) * k); car.speed = k; } // already rolling toward St. Armands
    } else if (from && (from.kind === 'boat' || from.kind === 'air')) {
      // from the water or the sky: the nearest road below
      const r = world.nearestRoadPoint(from.x, from.z, { ground: true });
      car.place(r.x, r.z, r.heading, 0);
    } else if (G.active) car.place(G.active.pos.x, G.active.pos.z, G.active.heading, G.active.y);
    if (!car.root.parent) scene.add(car.root);
    setActive(car);
  }
  G.started = true;
  updateCamera(0.016, true);
}
// Opening shot (Kramer, 2026-11-18): coming down off the New Pass bridge from Longboat Key at sunrise,
// headed for St. Armands Circle and on to downtown Sarasota. ?spawn=key puts you back on Gulf of Mexico Drive.
function startPose() {
  if (params.get('spawn') !== 'key') {
    const deck = world.roads.find((r) => r.n === 'John Ringling Parkway' && r.b);
    if (deck) {
      const p = deck.p, n = p.length / 3;
      // the deck runs north to south or south to north; drive it toward St. Armands (south, +z)
      const south = p[(n - 1) * 3 + 1] > p[1];
      const at = (k) => south ? k : n - 1 - k, i = at(Math.floor(n * 0.55)), j = at(Math.floor(n * 0.55) + 1);
      const x = p[i * 3], z = p[i * 3 + 1], y = p[i * 3 + 2];
      return { x, z, y, h: Math.atan2(-(p[j * 3 + 1] - z), p[j * 3] - x) };
    }
  }
  const sp = world.nearestRoadPoint(...xz(...PLACES.spawn.ll), { name: 'Gulf of Mexico Drive', ground: true });
  return { x: sp.x, z: sp.z, y: 0, h: Math.cos(sp.heading) > 0 ? sp.heading + Math.PI : sp.heading };
}
G.openSelect = () => {
  G.mode = 'select';
  $('select').style.display = 'flex';
  $('hud').style.display = 'none';
  $('menu').style.display = 'none';
  $('selBack').style.display = G.started ? 'block' : 'none';
  screech(0); engine(0, 0, 'car', false);
  // start on the vehicle you are in
  if (G.active) { const i = VEHICLES.findIndex((d) => d.id === G.active.def.id); if (i >= 0) sel.idx = i; }
  showVehicle(sel.idx);
};
function closeSelect() {
  $('select').style.display = 'none';
  $('hud').style.display = 'block';
  G.mode = 'play';
  updateCamera(0.016, true);
}
$('selBack').onclick = closeSelect;
// changing vehicles ends a mission without the end card
function stopMissionQuietly() {
  const M = G.missions;
  if (!M || !M.active) return;
  const id = M.active.id;
  M.end('Mission stopped', 'You changed vehicles.', false);
  G.hud.closeCard(); G.paused = false;
  if (G.store && G.store.group.userData.bday) G.store.group.userData.bday.visible = false;
  M.showStartMarkers(true);
  if (id === 'run' && G.active && G.active.kind === 'truck') G.leaveTruck(true);
}

// ---------------------------------------------------------------- pause menu
function openMenu() {
  G.mode = 'menu';
  const m = $('menu');
  m.style.display = 'flex';
  const ms = $('menuMissions');
  ms.innerHTML = '';
  for (const d of G.missions.defs) {
    const b = document.createElement('button');
    b.innerHTML = `<b>${d.name}</b><br><small>${d.desc}</small>`;
    b.onclick = () => { closeMenu(); if (G.missions.active) G.missions.end('Mission stopped', 'You left the mission.', false); G.missions.teleportTo(d.id); updateCamera(0.016, true); };
    ms.appendChild(b);
  }
}
function closeMenu() { $('menu').style.display = 'none'; G.mode = 'play'; }
$('btnResume').onclick = closeMenu;
$('btnVehicle').onclick = () => { closeMenu(); G.openSelect(); };
$('btnCredits').onclick = () => { $('credits').style.display = 'block'; };
$('btnCreditsClose').onclick = () => { $('credits').style.display = 'none'; };
$('btnArrows').onclick = () => { settings.arrows = !settings.arrows; saveSettings(); showSettings(); };
$('btnCamera').onclick = () => setCamMode(G.camMode + 1);
$('btnTraffic').onclick = () => { G.traffic.enabled = !G.traffic.enabled; if (G.boats) G.boats.enabled = G.traffic.enabled; if (G.bikes) G.bikes.enabled = G.traffic.enabled; $('btnTraffic').textContent = 'Traffic: ' + (G.traffic.enabled ? 'on' : 'off'); };
$('btnPolice').onclick = () => { settings.police = !settings.police; saveSettings(); if (!settings.police) G.police.stop(true); showSettings(); };
function fillCredits() {
  const seen = new Set();
  $('creditList').innerHTML = VEHICLES.filter((v) => !seen.has(v.credit) && seen.add(v.credit)).map((v) => `<li><b>${v.name}</b>: ${CREDITS[v.credit]}</li>`).join('')
    + ['police', 'yacht', 'lng', 'turtle', 'palms', 'bush'].map((k) => `<li>${CREDITS[k]}</li>`).join('');
}

// ---------------------------------------------------------------- map target (dropped on the big map)
G.setWaypoint = (p) => {
  G.waypoint = p ? { x: p.x, z: p.z, y: 0 } : null;
  if (!G.wpMarker) {
    G.wpMarker = makeMarker(0xff4fd8, 'Target');
    // a tall beam so the target shows from the sky too
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 600, 16, 1, true).translate(0, 300, 0),
      new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    G.wpMarker.add(beam);
    scene.add(G.wpMarker);
  }
  G.wpMarker.visible = !!p;
  if (p) {
    const r = world.roadAt(p.x, p.z, 0);
    G.wpMarker.position.set(p.x, r ? r.y : world.isLand(p.x, p.z) ? 0 : -0.3, p.z);
    G.hud.toast('Target set. Follow the pink X' + (settings.arrows ? ' and the road arrows' : ''), 2.5);
  }
  $('wp').style.display = p ? 'block' : 'none';
};
function updateWaypoint(dt, v) {
  const w = G.waypoint;
  if (!w) return;
  G.wpMarker.userData.ring.rotation.z += dt;
  const dx = w.x - v.pos.x, dz = w.z - v.pos.z, d = Math.hypot(dx, dz);
  const miles = d / 1609.34;
  // which way to turn: angle between heading and the target, screen-up is straight ahead
  const rel = Math.atan2(-dz, dx) - v.heading;
  $('wpArrow').style.transform = `rotate(${-rel}rad)`;
  $('wpDist').textContent = miles >= 0.1 ? miles.toFixed(1) + ' mi' : Math.round(d * 3.281) + ' ft';
  if (d < (v.kind === 'air' ? 45 : 22)) { chime('win'); G.hud.toast('You made it to the target', 2.5); G.setWaypoint(null); }
}

// ---------------------------------------------------------------- play loop
let areaT = 0, area = '';
function updatePlay(dt) {
  const v = G.active;
  if (input.camera) setCamMode(G.camMode + 1, true);
  if (input.pause) { openMenu(); return; }
  if (input.vehicles) { G.openSelect(); return; }
  if (input.map) { G.bigmap.open(); return; }
  const frozen = G.paused || G.hud.cardOpen();
  const inp = frozen ? { throttle: 0, brake: 1, steer: 0, handbrake: false } : input;
  v.events.length = 0;
  v.update(dt, inp, world, G.fx);
  // the parked boat keeps bobbing at the dock
  const boat = G.vehicles[G.boatId];
  if (boat && boat !== v) boat.update(dt, { throttle: 0, brake: 0, steer: 0 }, world, null);
  if (v.kind !== 'boat') {
    const hit = Math.max(G.traffic.collide(v), G.bikes.collide(v), G.police.collide(v));
    if (hit > 3) v.events.push({ type: 'crash', impact: hit });
  } else {
    const hit = Math.max(G.boats.collide(v), G.docks.collide(v), dadsDockHit(v));
    if (hit) { v.sync(); if (hit > 3) v.events.push({ type: 'crash', impact: hit }); }
  }
  for (const e of v.events) {
    if (e.type === 'crash') { G.shake = Math.min(0.6, e.impact * 0.03); }
    if (e.type === 'pullup') { G.hud.toast('Pull up! Pull up!', 1.6); chime('bad'); }
    if (e.type === 'water' && !G.sinking) {
      G.sinking = 1.4;
      splashSound();
      for (let i = 0; i < 160; i++) G.fx.splash.emit(v.pos.x + (Math.random() - 0.5) * 3, -0.2, v.pos.z + (Math.random() - 0.5) * 3, v.vel.x * 0.2 + (Math.random() - 0.5) * 6, 4 + Math.random() * 7, v.vel.y * 0.2 + (Math.random() - 0.5) * 6, { life: 1.4, s0: 0.4, s1: 1.2, grav: 9.8, alpha: 0.9 });
      G.hud.toast('Splash! Back to the nearest road.', 2);
    }
  }
  if (G.sinking) {
    G.sinking -= dt;
    v.y -= dt * 1.2; v.vel.multiplyScalar(Math.exp(-dt * 3)); v.sync();
    if (G.sinking <= 0) { G.sinking = 0; respawnOnRoad(v); updateCamera(dt, true); }
  } else if (v.kind !== 'boat' && v.lastRoad && v.y < 0.5) {
    G.lastGoodT = (G.lastGoodT || 0) + dt;
    if (G.lastGoodT > 1) { G.lastGoodT = 0; G.lastGood = { x: v.pos.x, z: v.pos.z }; }
  }
  // swaps at the dock
  if (!G.missions.active || G.missions.active.id === 'traps') {
    if (v.kind === 'car' && Math.hypot(v.pos.x - G.dockCar.x, v.pos.z - G.dockCar.z) < 10) {
      G.hud.hint("Press E to take Dad's boat");
      if (input.interact) { G.goBoat(); chime('good'); updateCamera(dt, true); }
    } else if (v.kind === 'boat' && Math.hypot(v.pos.x - G.dockBoat.x, v.pos.z - G.dockBoat.z) < 20) {
      G.hud.hint('Press E to tie up and drive the car');
      if (input.interact) { G.backToCar(); chime('good'); updateCamera(dt, true); }
    } else if (!G.missions.active) G.hud.hint('');
  }
  G.missions.update(dt);
  G.traffic.update(dt, v);
  G.boats.update(dt, v, G.fx, !G.boatsSeeded); G.boatsSeeded = true;
  G.tanker.update(dt);
  G.turtles.update(dt, v);
  areaT -= dt;
  if (areaT <= 0) { areaT = 0.5; area = world.areaName(v.pos.x, v.pos.z, v.lastRoad); }
  G.police.update(dt, v, settings.police && !G.missions.active);
  G.bikes.update(dt, v);
  G.pelicans.update(dt, v, G.traffic.enabled);
  const limit = v.kind === 'boat' || v.kind === 'air' ? null : G.missions.limitAt(v);
  const marks = G.missions.minimapMarkers().concat(G.police.minimapMarkers());
  if (G.waypoint) marks.push({ x: G.waypoint.x, z: G.waypoint.z, color: '#ff4fd8', big: true, letter: 'X' });
  G.hud.update(dt, v, limit, area, marks);
  updateWaypoint(dt, v);
  engine(Math.min(1, Math.abs(v.speed) / v.top), v.kind === 'air' ? Math.max(inp.throttle || 0, Math.abs(inp.lift || 0)) : inp.throttle || 0, v.fly || v.kind, true);
  setRotor(G.missions.helis.length + (v.fly === 'heli' ? 1 : 0) + G.police.heliCount());
  // tires: loud with the handbrake on at speed, a quieter chirp in any big slide
  const spd = Math.abs(v.speed), slide = v.drift || 0;
  const onTires = v.kind !== 'boat' && v.kind !== 'air' && !G.sinking && !frozen;
  screech(!onTires ? 0 : inp.handbrake && spd > 4 ? THREE.MathUtils.clamp(spd / 22 + slide / 14, 0.3, 1) : slide > 7 ? 0.25 : 0);
  G.nav.update(dt, v, G.missions.navTarget() || G.waypoint);
  // arrows only show ahead of the car, so say so when the route is behind it
  G.behindT = G.nav.mesh.visible && G.nav.behind && Math.abs(v.speed) > 4 ? (G.behindT || 0) + dt : 0;
  if (G.behindT > 2.5) { G.behindT = -6; G.hud.toast('Turn around: the road arrows are behind you', 2.5); }
  updateCamera(dt);
}

let last = performance.now();
let fpsAcc = 0, fpsN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) { G.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  G.time += dt;
  input.update();
  waterUniforms.uTime.value = G.time;
  if (G.mode === 'select') { updateSelect(dt); return; }
  if (G.mode === 'intro') { updateIntro(dt); return; }
  if (G.mode === 'map') { screech(0); engine(0, 0, 'car', false); G.bigmap.update(dt); return; }
  if (G.mode !== 'play') screech(0);
  if (G.mode === 'menu') { if (input.pause) closeMenu(); }
  if (G.mode === 'play' && G.active) updatePlay(dt);
  if (G.radio && G.mode === 'play') { if (input.radioNext) G.radio.step(1); if (input.radioPrev) G.radio.step(-1); }
  if (G.hud && G.hud.cardOpen() && input.confirm && G.hud.cardButtons) { const [, fn] = G.hud.cardButtons[0]; G.hud.closeCard(); G.onCardClose && G.onCardClose(); G.onCardClose = null; fn(); }
  if (!G.active) return;
  for (const p of Object.values(G.fx)) { p.update(dt); p.setScale(innerHeight); }
  const ap = G.active.pos;
  sun.position.set(ap.x + sunDir.x * 300, Math.max(40, sunDir.y * 300 + 60), ap.z + sunDir.z * 300);
  sun.target.position.set(ap.x, 0, ap.z);
  sky.position.copy(camera.position);
  const high = G.active.kind === 'air' ? THREE.MathUtils.clamp((G.active.y - 40) / 260, 0, 1) : 0;
  world.viewDist = 4300 + high * 3200;
  scene.fog.far = 4200 + high * 4000; scene.fog.near = 450 + high * 900;
  world.update(camera.position);
  if (G.flora) G.flora.update(dt, G.active.pos);
  if (G.docks) G.docks.update(G.active.pos);
  G.dockMarker.userData.ring.rotation.z += dt;
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const c of [camera, sel.cam]) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); }
  if (G.bigmap) G.bigmap.resize();
  if (intro) { intro.cam.aspect = innerWidth / innerHeight; intro.cam.updateProjectionMatrix(); }
});
document.addEventListener('click', (e) => { if (e.target.closest('#card button')) { G.onCardClose && G.onCardClose(); G.onCardClose = null; } });

// ---------------------------------------------------------------- boot
document.addEventListener('drive', () => startDrive());
async function boot() {
  try {
    world.beforeBuildings = placeStoreAndWarehouse;
    const propsReady = loadProps();
    await world.load(scene, setLoad);
    setLoad('Unloading the yachts');
    await propsReady;
    setLoad('Setting the scene');
    buildSetPieces();
    G.hud = new HUD(world);
    G.missions = new Missions(G);
    G.missions.setup();
    G.traffic = new Traffic(scene, world);
    G.boats = new BoatTraffic(scene, world);
    G.tanker = new Tanker(scene, world);
    G.turtles = new Turtles(scene, world);
    G.flora = new Flora(scene, world);
    G.docks = new CanalDocks(scene, world, G);
    G.nav = new Nav(scene, world);
    G.police = new Police(scene, world, G);
    G.bikes = new Bikes(scene, world);
    G.pelicans = new Pelicans(scene, world, G);
    G.bigmap = new BigMap(G);
    showSettings();
    G.radio = new Radio((m) => G.hud.toast(m, 3));
    G.radio.load();
    fillCredits();
    buildSelectList();
    setLoad('Polishing the silver cars');
    await getVehicle(VEHICLES[0].id);
    setLoad('Warming up the helicopters');
    G.missions.prewarm(renderer, camera, [...G.police.prewarmList(), ...G.bikes.prewarmList()]);
    G.setWaypoint(null);
    $('loading').style.display = 'none';
    G.openSelect();
    requestAnimationFrame(frame);
    G.ready = true;
    console.log(`Paradice City ready: ${world.roads.length} roads, ${world.bList.length} buildings, ${world.palmCount} palms, ${world.houseCount} houses, ${G.docks.count.lots} canal docks, ${G.docks.count.boats} docked boats`);
    if (params.has('auto')) await autoShot(params.get('auto'));
  } catch (e) {
    console.error(e);
    setLoad('Something went wrong: ' + e.message);
  }
}
boot();

// ---------------------------------------------------------------- test hooks for headless screenshots
async function autoShot(what) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  G.wait = wait;
  if (what === 'select') { await showVehicle(Math.max(0, VEHICLES.findIndex((v) => v.id === params.get('car')))); return; }
  sel.idx = VEHICLES.findIndex((v) => v.id === (params.get('car') || 'porsche-911'));
  if (what === 'boat') sel.idx = VEHICLES.findIndex((v) => v.id === 'boat');
  await startDrive();
  const v = G.active;
  if (what === 'drive') {
    v.vel.set(Math.cos(v.heading) * 22, -Math.sin(v.heading) * 22);
  } else if (what === 'bridge') {
    const W = world;
    let best = null;
    for (const r of W.roads) if (/John Ringling/.test(r.n) && r.b) for (let i = 0; i < r.p.length - 3; i += 3) if (r.p[i + 2] > 12 && (!best || r.p[i + 2] < best.y)) best = { x: r.p[i], z: r.p[i + 1], y: r.p[i + 2], h: Math.atan2(-(r.p[i + 4] - r.p[i + 1]), r.p[i + 3] - r.p[i]) };
    // drive west toward the sunset
    let h = best.h; if (Math.cos(h) > 0) h += Math.PI;
    v.place(best.x, best.z, h, best.y);
    v.vel.set(Math.cos(h) * 18, -Math.sin(h) * 18);
  } else if (what === 'boat') {
    const b = G.missions.buoys[1];
    v.place(b.x - 30, b.z + 12, 0.35, -0.35);
    v.vel.set(Math.cos(0.35) * 12, -Math.sin(0.35) * 12);
    G.missions.begin('traps');
  } else if (what === 'dock') {
    const t = await G.useTruck();
    const d = G.store.dock;
    const fx = Math.cos(d.heading), fz = -Math.sin(d.heading);
    const kx = d.x + fx * t.tLen, kz = d.z + fz * t.tLen;
    t.place(kx - fx * t.hitchX, kz - fz * t.hitchX, d.heading, 0);
    G.store.group.userData.bday.visible = true;
    G.missions.showStartMarkers(false);
  } else if (what === 'golf') {
    const c = G.missions.carts[0];
    const r = world.nearestRoadPoint(c.A.x, c.A.z, { ground: true });
    v.place(r.x - Math.cos(r.heading) * 40, r.z + Math.sin(r.heading) * 40, r.heading, 0);
    v.vel.set(Math.cos(r.heading) * 8, -Math.sin(r.heading) * 8);
  } else if (what === 'intro') {
    G.startIntro(async () => {});
  }
  updateCamera(0.016, true);
}
