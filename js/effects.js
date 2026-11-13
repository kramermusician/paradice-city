// Particles: boat wake foam, bow spray, splashes, confetti.
import * as THREE from 'three';

export class Particles {
  constructor(scene, n = 3000, { color = 0xffffff, flat = false } = {}) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.col = new Float32Array(n * 3).fill(1);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.i = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(1.0, -mv.z); vA = aAlpha; vC = aColor; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = vA * smoothstep(0.5, 0.15, r); gl_FragColor = vec4(vC, a); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, { life = 2, s0 = 0.5, s1 = 2, grav = 0, alpha = 0.8, color = null } = {}) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.grav[i] = grav; this.alpha[i] = alpha;
    this.a0 = this.a0 || new Float32Array(this.n); this.a0[i] = alpha;
    const c = color || [1, 1, 1];
    this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
  }
  update(dt, waterY = -0.35) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = 1 - this.life[i] / this.max[i];
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      const damp = this.grav[i] ? 1 : Math.exp(-1.5 * dt);
      this.vel[i * 3] *= damp; this.vel[i * 3 + 2] *= damp;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.grav[i] && this.pos[i * 3 + 1] < waterY && this.vel[i * 3 + 1] < 0) { this.life[i] = Math.min(this.life[i], 0.15); }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      this.alpha[i] = this.a0[i] * (1 - k) * Math.min(1, k * 8 + 0.2);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aColor.needsUpdate = true;
  }
  setScale(h) { this.mat.uniforms.uScale.value = h * 0.9; }
}
