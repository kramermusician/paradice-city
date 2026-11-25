// Sunset sky dome: deep blue-violet overhead, orange and pink at the horizon, a warm glow
// and a soft sun disk low over the Gulf. Also used to light the cars (environment map).
import * as THREE from 'three';

export function makeSky(radius = 9000) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uSun: { value: new THREE.Vector3(-0.9, 0.05, 0.4).normalize() },
      uZenith: { value: new THREE.Color(0.10, 0.12, 0.30) },
      uMid: { value: new THREE.Color(0.55, 0.32, 0.45) },
      uHorizon: { value: new THREE.Color(1.0, 0.52, 0.30) },
      uAway: { value: new THREE.Color(0.62, 0.45, 0.55) },
      uSunCol: { value: new THREE.Color(1.0, 0.6, 0.3) },
      uBright: { value: 1.0 },
      uTime: { value: 0 },
      uCloud: { value: 0.46 },     // cloud cover 0..1 (fair-weather cumulus, as in the Longboat Key photos)
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uSun, uZenith, uMid, uHorizon, uAway, uSunCol; uniform float uBright, uTime, uCloud; varying vec3 vDir;
      float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), f.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), f.x), f.y); }
      float cFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * cNoise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 sunH = normalize(vec3(uSun.x, 0.0, uSun.z));
        float toward = dot(normalize(vec3(d.x, 0.0, d.z)), sunH) * 0.5 + 0.5;
        vec3 horizon = mix(uAway, uHorizon, pow(toward, 1.6));
        float up = clamp(h, 0.0, 1.0);
        vec3 col = mix(horizon, uMid, smoothstep(0.0, 0.18, up));
        col = mix(col, uZenith, smoothstep(0.12, 0.7, up));
        if (h < 0.0) col = mix(horizon, uHorizon * 0.55, clamp(-h * 6.0, 0.0, 1.0));
        float c = max(dot(d, normalize(uSun)), 0.0);
        col += uSunCol * (pow(c, 6.0) * 0.45 + pow(c, 60.0) * 0.6);
        col += uSunCol * smoothstep(0.9993, 0.9997, c) * 4.0;
        if (h > 0.015 && uCloud > 0.01) {
          // puffy clouds on a flat layer overhead: lit toward the sun, grey-blue bases, thinning into haze at the horizon
          vec2 cp = d.xz / (h + 0.09) * 0.55 + vec2(uTime * 0.004, uTime * 0.0015);
          float n = cFbm(cp), n2 = cFbm(cp * 2.7 + 5.0);
          float cov = smoothstep(1.0 - uCloud - 0.07, 1.0 - uCloud + 0.16, n * 0.82 + n2 * 0.18 + 0.02);
          float thick = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.33, n);
          vec3 lit = mix(vec3(1.0), uSunCol, 0.35) * (0.92 + 0.5 * pow(c, 4.0));
          vec3 base = mix(horizon, uZenith, 0.35) * 0.8 + vec3(0.1);
          vec3 cl = mix(lit, base, thick * 0.6);
          cl = mix(cl, horizon, 0.25 + 0.5 * (1.0 - smoothstep(0.02, 0.3, h)));
          col = mix(col, cl, cov * smoothstep(0.015, 0.11, h) * 0.93);
        }
        col *= uBright;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}
