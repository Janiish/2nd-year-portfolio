// ─────────────────────────────────────────────────────────────
//  GLSL shader library — fully procedural (no textures required)
// ─────────────────────────────────────────────────────────────

// Ashima Arts 3D simplex noise + fBm helpers
export const noise = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p){
  float f = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++){ f += a * snoise(p); p *= 2.03; a *= 0.5; }
  return f;
}
float fbm4(vec3 p){
  float f = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ f += a * snoise(p); p *= 2.07; a *= 0.5; }
  return f;
}
`;

// Shared vertex shader for lit spheres
export const sphereVertex = /* glsl */ `
varying vec3 vPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
void main(){
  vPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const earthFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
${noise}
void main(){
  vec3 p = normalize(vPos);
  float n = fbm(p * 1.7 + vec3(4.1, 0.0, 1.3));
  float land = smoothstep(0.03, 0.07, n);
  float lat = abs(p.y);

  // Oceans
  vec3 deep = vec3(0.012, 0.045, 0.13);
  vec3 shallow = vec3(0.03, 0.2, 0.38);
  vec3 ocean = mix(deep, shallow, smoothstep(-0.3, 0.05, n));

  // Land biomes
  float m = fbm4(p * 5.0 + 3.0);
  vec3 green = vec3(0.09, 0.24, 0.1);
  vec3 desert = vec3(0.56, 0.43, 0.26);
  vec3 rock = vec3(0.33, 0.29, 0.25);
  vec3 landCol = mix(green, desert, smoothstep(-0.15, 0.35, m) * smoothstep(0.65, 0.15, lat));
  landCol = mix(landCol, rock, smoothstep(0.24, 0.42, n));
  vec3 col = mix(ocean, landCol, land);

  float ice = smoothstep(0.8, 0.88, lat + m * 0.08);
  col = mix(col, vec3(0.88, 0.94, 1.0), ice);

  // Lighting
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(vViewDir);
  float ndl = dot(N, uSunDir);
  float day = smoothstep(-0.18, 0.22, ndl);
  vec3 dayCol = col * (0.06 + 1.15 * max(ndl, 0.0));

  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 70.0) * (1.0 - land) * (1.0 - ice);
  dayCol += vec3(1.0, 0.88, 0.7) * spec * 0.7;

  // City lights on the night side
  float cities = smoothstep(0.6, 0.9, snoise(p * 46.0) * 0.5 + 0.5)
               * smoothstep(0.35, 0.7, snoise(p * 7.0) * 0.5 + 0.5);
  cities *= land * (1.0 - ice);
  vec3 nightCol = col * 0.015 + vec3(1.0, 0.6, 0.24) * cities * 1.6;

  vec3 c = mix(nightCol, dayCol, day);

  // Twilight band
  float twilight = smoothstep(0.25, 0.0, abs(ndl)) * 0.35;
  c += vec3(1.0, 0.45, 0.2) * twilight * 0.12;

  // Fresnel rim
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  c += vec3(0.25, 0.6, 1.0) * fres * (0.2 + 0.9 * smoothstep(-0.3, 0.6, ndl));

  gl_FragColor = vec4(c, 1.0);
}
`;

export const cloudFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
${noise}
void main(){
  vec3 p = normalize(vPos);
  float n = fbm4(p * 2.6 + vec3(uTime * 0.012, 0.0, uTime * 0.007));
  n += 0.25 * snoise(p * 9.0 + uTime * 0.02);
  float a = smoothstep(0.08, 0.5, n);
  vec3 N = normalize(vWorldNormal);
  float light = smoothstep(-0.2, 0.45, dot(N, uSunDir));
  vec3 col = vec3(1.0) * (0.03 + 0.97 * light);
  gl_FragColor = vec4(col, a * 0.7 * (0.25 + 0.75 * light));
}
`;

export const atmosphereVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewPos;
varying vec3 vWorldNormal;
void main(){
  vNormal = normalize(normalMatrix * normal);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

export const atmosphereFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uColor;
varying vec3 vNormal;
varying vec3 vViewPos;
varying vec3 vWorldNormal;
void main(){
  float d = dot(normalize(vNormal), normalize(vViewPos));
  float intensity = pow(smoothstep(0.0, 0.5, d), 1.6);
  float sun = smoothstep(-0.5, 0.7, dot(normalize(vWorldNormal), uSunDir));
  gl_FragColor = vec4(uColor * intensity * (0.25 + sun * 1.35), 1.0);
}
`;

export const moonFragment = /* glsl */ `
uniform vec3 uSunDir;
varying vec3 vPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
${noise}
void main(){
  vec3 p = normalize(vPos);
  float n = fbm4(p * 3.0);
  float craters = smoothstep(0.55, 0.75, snoise(p * 12.0) * 0.5 + 0.5);
  vec3 col = mix(vec3(0.42, 0.41, 0.4), vec3(0.72, 0.71, 0.69), n * 0.5 + 0.5);
  col *= 1.0 - craters * 0.35;
  float ndl = max(dot(normalize(vWorldNormal), uSunDir), 0.0);
  gl_FragColor = vec4(col * (0.03 + ndl * 1.1), 1.0);
}
`;

export const starsVertex = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTwinkle;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vTwinkle = 0.6 + 0.4 * sin(uTime * (0.8 + fract(aPhase) * 2.0) + aPhase * 6.2831);
  vColor = aColor;
  gl_PointSize = aSize * uPixelRatio;
}
`;

export const starsFragment = /* glsl */ `
varying vec3 vColor;
varying float vTwinkle;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = pow(smoothstep(0.5, 0.0, d), 2.2);
  gl_FragColor = vec4(vColor * vTwinkle, a);
}
`;

export const nebulaVertex = /* glsl */ `
varying vec3 vPos;
void main(){
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const nebulaFragment = /* glsl */ `
varying vec3 vPos;
${noise}
void main(){
  vec3 d = normalize(vPos);
  float n1 = fbm4(d * 1.8);
  float n2 = fbm4(d * 3.2 + 11.0);
  vec3 violet = vec3(0.22, 0.06, 0.38);
  vec3 teal = vec3(0.0, 0.17, 0.27);
  vec3 col = vec3(0.008, 0.01, 0.025);
  col += violet * smoothstep(0.0, 0.75, n1) * 0.55;
  col += teal * smoothstep(0.05, 0.8, n2) * 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const orbitVertex = /* glsl */ `
attribute float aAngle;
varying float vAngle;
void main(){
  vAngle = aAngle;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const orbitFragment = /* glsl */ `
uniform float uAngle;
uniform vec3 uColor;
uniform float uOpacity;
varying float vAngle;
void main(){
  float diff = mod(uAngle - vAngle, 6.2831853) / 6.2831853;
  float trail = pow(1.0 - diff, 7.0);
  float a = (0.07 + 0.93 * trail) * uOpacity;
  gl_FragColor = vec4(uColor, a);
}
`;
