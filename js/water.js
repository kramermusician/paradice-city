// Animated sunset water for the Gulf and Sarasota Bay: layered waves, sky reflection,
// a sun glitter path and turquoise shallows near the shore.
import * as THREE from 'three';

export const waterUniforms = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(-0.9, 0.08, 0.4).normalize() },
  uSunColor: { value: new THREE.Color(1.0, 0.62, 0.32) },
  uSkyColor: { value: new THREE.Color(0.98, 0.62, 0.52) },
  uZenith: { value: new THREE.Color(0.32, 0.36, 0.55) },
  uDeep: { value: new THREE.Color(0.03, 0.12, 0.17) },
  uShallowCol: { value: new THREE.Color(0.12, 0.42, 0.42) },
  uFogColor: { value: new THREE.Color(0.9, 0.62, 0.5) },
  uFogNear: { value: 400 },
  uFogFar: { value: 4200 },
  uShallow: { value: null },
  uRect: { value: new THREE.Vector4() },
};

export function makeWaterMaterial(shallowTex, rect) {
  waterUniforms.uShallow.value = shallowTex;
  waterUniforms.uRect.value.set(...rect);
  return new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSunDir, uSunColor, uSkyColor, uZenith, uDeep, uShallowCol, uFogColor;
      uniform float uFogNear, uFogFar; uniform sampler2D uShallow; uniform vec4 uRect;
      varying vec3 vWorld;
      vec2 wave(vec2 p, vec2 d, float f, float s, float a) {
        float ph = dot(p, d) * f + uTime * s;
        return d * cos(ph) * a * f;
      }
      void main() {
        vec2 p = vWorld.xz;
        vec2 g = vec2(0.0);
        g += wave(p, normalize(vec2(1.0, 0.3)), 0.12, 1.1, 0.35);
        g += wave(p, normalize(vec2(0.6, -0.8)), 0.23, 1.7, 0.18);
        g += wave(p, normalize(vec2(-0.3, 1.0)), 0.51, 2.6, 0.07);
        g += wave(p, normalize(vec2(0.9, 0.9)), 1.13, 3.9, 0.03);
        g += wave(p, normalize(vec2(-1.0, 0.2)), 2.3, 5.3, 0.012);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vWorld);
        float dist = length(cameraPosition - vWorld);
        n = normalize(mix(n, vec3(0.0, 1.0, 0.0), clamp(dist / 2500.0, 0.0, 0.8)));
        vec3 r = reflect(-v, n);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        // sky seen in the reflection: warm near the sun side horizon, cooler up high
        float sunSide = max(dot(normalize(vec3(r.x, 0.0, r.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
        vec3 sky = mix(uSkyColor, uZenith, clamp(r.y * 2.2, 0.0, 1.0));
        sky = mix(sky, uSunColor * 1.2, pow(sunSide, 6.0) * (1.0 - clamp(r.y * 3.0, 0.0, 1.0)) * 0.7);
        vec2 suv = (p - uRect.xy) / uRect.zw;
        float shallow = 0.0;
        if (suv.x > 0.0 && suv.y > 0.0 && suv.x < 1.0 && suv.y < 1.0) shallow = smoothstep(0.2, 0.75, texture2D(uShallow, suv).r) * 0.85;
        vec3 body = mix(uDeep, uShallowCol, shallow);
        vec3 col = mix(body, sky, fres);
        float spec = pow(max(dot(r, uSunDir), 0.0), 220.0) * 6.0 + pow(max(dot(r, uSunDir), 0.0), 28.0) * 0.35;
        col += uSunColor * spec;
        float fog = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
