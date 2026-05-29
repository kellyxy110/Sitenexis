// ── GLSL shaders for the SiteNexis cinematic hero ────────────────────────────

export const PARTICLE_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uScroll;

  attribute float aSize;
  attribute float aSpeed;
  attribute float aPhase;

  varying float vAlpha;
  varying float vMouseProx;

  void main() {
    vec3 pos = position;

    // Organic floating motion
    float wave = sin(pos.x * 0.3 + uTime * aSpeed + aPhase) * 0.12;
    pos.y += wave + cos(pos.z * 0.2 + uTime * aSpeed * 0.7 + aPhase) * 0.06;
    pos.x += sin(pos.z * 0.15 + uTime * aSpeed * 0.5) * 0.05;

    // Scroll: compress particles upward
    pos.y -= uScroll * 4.0;

    // Cursor gravity
    vec2 delta = uMouse - pos.xy;
    float dist  = length(delta);
    float pull  = 1.0 - smoothstep(0.0, 5.0, dist);
    pos.xy += normalize(delta + vec2(0.001)) * pull * 0.4;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Size with depth attenuation
    gl_PointSize = aSize * (280.0 / -mv.z);

    float centerFade = clamp(1.0 - length(pos.xz) * 0.07, 0.0, 1.0);
    vAlpha      = centerFade * 0.38;
    vMouseProx  = pull;
  }
`

export const PARTICLE_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  varying float vAlpha;
  varying float vMouseProx;

  void main() {
    vec2  uv  = gl_PointCoord - 0.5;
    float r   = length(uv);
    if (r > 0.5) discard;

    float glow  = exp(-r * 7.0);
    vec3  color = mix(uColorA, uColorB, vMouseProx);
    float alpha = glow * vAlpha * (1.0 + vMouseProx * 2.5);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.9));
  }
`

// ── Holographic sphere ────────────────────────────────────────────────────────

export const SPHERE_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    vNormal  = normalize(normalMatrix * normal);
    vUv      = uv;
    vec4 mv  = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

export const SPHERE_FRAG = /* glsl */ `
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 2.2);

    // Horizontal scan lines
    float scan = pow(max(0.0, sin(vUv.y * 55.0 + uTime * 2.2)), 12.0) * 0.55;

    // Latitude glow bands
    float band = pow(max(0.0, sin(vUv.y * 10.0 - uTime * 0.7)), 8.0) * 0.18;

    // Longitude grid
    float gridV = pow(max(0.0, sin(vUv.x * 24.0)), 16.0) * 0.07;
    float gridH = pow(max(0.0, sin(vUv.y * 16.0)), 16.0) * 0.07;

    vec3  colA = vec3(0.043, 0.808, 0.737); // #0BCEBC teal
    vec3  colB = vec3(0.000, 0.784, 1.000); // #00C8FF cyan
    vec3  col  = mix(colA, colB, vUv.y);

    float alpha = fresnel * 0.75 + scan + band + gridV + gridH;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.98));
  }
`

// ── Background volumetric void ────────────────────────────────────────────────

export const BG_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const BG_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2  center = vec2(0.5, 0.42);
    float d      = length(vUv - center);

    // Primary teal glow — breathes slowly, kept very dark
    float glow1 = exp(-d * 3.5) * (0.025 + sin(uTime * 0.25) * 0.008);

    // Offset violet accent — subtle
    float d2    = length(vUv - vec2(0.72, 0.38));
    float glow2 = exp(-d2 * 4.0) * (0.012 + sin(uTime * 0.18 + 1.2) * 0.004);

    vec3 base   = vec3(0.016, 0.024, 0.042); // deep navy-black
    vec3 teal   = vec3(0.000, 0.784, 1.000);
    vec3 violet = vec3(0.486, 0.361, 1.000);

    vec3 col = base + teal * glow1 + violet * glow2;
    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Signal beam ───────────────────────────────────────────────────────────────

export const BEAM_VERT = /* glsl */ `
  attribute float aProgress;
  varying   float vProgress;

  void main() {
    vProgress   = aProgress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const BEAM_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uDelay;
  uniform vec3  uColor;

  varying float vProgress;

  void main() {
    // Traveling pulse
    float t      = mod(vProgress - uTime * 0.35 + uDelay, 1.0);
    float pulse  = exp(-t * 9.0) + exp(-(1.0 - t) * 9.0);
    pulse        = clamp(pulse * 0.85, 0.0, 1.0);

    // Base line glow
    float base   = 0.12 * smoothstep(1.0, 0.4, abs(vProgress - 0.5) * 2.0);

    gl_FragColor = vec4(uColor, clamp(pulse + base, 0.0, 0.95));
  }
`
