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
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uSun, uZenith, uMid, uHorizon, uAway, uSunCol; uniform float uBright; varying vec3 vDir;
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
