// ── GLSL shaders for the SiteNexis cinematic hero ────────────────────────────

// ── Chaos Fragments — disconnected website pieces floating in void ────────────

export const FRAGMENT_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform vec2  uMouse;

  attribute float aSize;
  attribute float aSpeed;
  attribute float aPhase;
  attribute float aType;

  varying float vAlpha;
  varying float vType;
  varying float vScroll;

  void main() {
    vec3 pos = position;

    // Chaotic floating — disconnected, disoriented
    float chaos = 1.0 - uScroll;
    float order = uScroll;

    // Chaos: irregular, random motion
    pos.x += sin(uTime * aSpeed * 0.3 + aPhase) * 0.8 * chaos;
    pos.y += cos(uTime * aSpeed * 0.4 + aPhase * 1.3) * 0.6 * chaos;
    pos.z += sin(uTime * aSpeed * 0.2 + aPhase * 0.7) * 0.5 * chaos;

    // Order: converge toward cluster centers
    float targetRadius = 2.0 + aType * 1.5;
    float angle = aPhase + uTime * 0.1 * order;
    vec3 target = vec3(
      cos(angle) * targetRadius * 0.6,
      sin(angle * 0.7) * targetRadius * 0.4,
      sin(angle * 0.5) * targetRadius * 0.3
    );
    pos = mix(pos, target, order * 0.7);

    // Subtle mouse repulsion
    vec2 delta = uMouse - pos.xy;
    float dist = length(delta);
    float repel = 1.0 - smoothstep(0.0, 4.0, dist);
    pos.xy -= normalize(delta + vec2(0.001)) * repel * 0.3 * chaos;

    // Subtle attraction on scroll
    pos.xy += normalize(delta + vec2(0.001)) * repel * 0.15 * order;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (250.0 / -mv.z) * (0.8 + order * 0.4);

    vAlpha = 0.25 + order * 0.35;
    vType = aType;
    vScroll = uScroll;
  }
`

export const FRAGMENT_FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vType;
  varying float vScroll;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;

    // Different colors for different fragment types
    vec3 colChaos = vec3(0.3, 0.35, 0.45);     // dull grey-blue in chaos
    vec3 colTeal  = vec3(0.043, 0.808, 0.737);  // #0BCEBC
    vec3 colCyan  = vec3(0.0, 0.784, 1.0);      // #00C8FF
    vec3 colViolet = vec3(0.486, 0.361, 1.0);   // purple accent

    vec3 orderedColor = mix(colTeal, colCyan, vType);
    orderedColor = mix(orderedColor, colViolet, step(0.85, vType) * 0.6);

    vec3 color = mix(colChaos, orderedColor, vScroll);

    float glow = exp(-r * 6.0);
    float alpha = glow * vAlpha;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.92));
  }
`

// ── Connection Lines — form as scroll progresses ─────────────────────────────

export const CONNECTION_VERT = /* glsl */ `
  attribute float aProgress;
  uniform float uTime;
  uniform float uScroll;

  varying float vProgress;
  varying float vScroll;

  void main() {
    vProgress = aProgress;
    vScroll = uScroll;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const CONNECTION_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform vec3  uColor;

  varying float vProgress;
  varying float vScroll;

  void main() {
    // Lines only appear as discovery progresses
    float appear = smoothstep(0.2, 0.6, uScroll);

    // Traveling energy pulse
    float t = mod(vProgress - uTime * 0.4, 1.0);
    float pulse = exp(-t * 8.0) * 0.9;

    // Base visibility
    float base = 0.15 * smoothstep(1.0, 0.3, abs(vProgress - 0.5) * 2.0);

    float alpha = (pulse + base) * appear;
    gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 0.85));
  }
`

// ── Discovery Pulse Ring — expanding wave showing intelligence activating ────

export const PULSE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const PULSE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  varying vec2 vUv;

  void main() {
    vec2 center = vec2(0.5);
    float d = length(vUv - center) * 2.0;

    // Pulse expands with scroll
    float pulseRadius = uScroll * 1.2;
    float ring = exp(-pow((d - pulseRadius) * 12.0, 2.0));

    // Secondary rings
    float ring2 = exp(-pow((d - pulseRadius * 0.6) * 10.0, 2.0)) * 0.4;
    float ring3 = exp(-pow((d - pulseRadius * 1.4) * 8.0, 2.0)) * 0.2;

    float alpha = (ring + ring2 + ring3) * smoothstep(0.0, 0.15, uScroll);
    vec3 col = mix(vec3(0.043, 0.808, 0.737), vec3(0.0, 0.784, 1.0), d);

    gl_FragColor = vec4(col, clamp(alpha * 0.6, 0.0, 0.8));
  }
`

// ── Neural Core — forms at center as fragments converge ──────────────────────

export const CORE_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

export const CORE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 2.5);

    // Scan lines
    float scan = pow(max(0.0, sin(vUv.y * 40.0 + uTime * 3.0)), 14.0) * 0.5;

    // Latitude bands
    float band = pow(max(0.0, sin(vUv.y * 8.0 - uTime * 0.8)), 6.0) * 0.2;

    // Data grid
    float gridV = pow(max(0.0, sin(vUv.x * 20.0 + uTime * 0.3)), 18.0) * 0.08;
    float gridH = pow(max(0.0, sin(vUv.y * 14.0 - uTime * 0.2)), 18.0) * 0.08;

    vec3 colA = vec3(0.043, 0.808, 0.737);
    vec3 colB = vec3(0.0, 0.784, 1.0);
    vec3 col = mix(colA, colB, vUv.y + sin(uTime * 0.3) * 0.1);

    float alpha = (fresnel * 0.8 + scan + band + gridV + gridH) * smoothstep(0.3, 0.7, uScroll);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
  }
`

// ── Background void — deep space with subtle nebula ──────────────────────────

export const BG_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const BG_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  varying vec2 vUv;

  // Simple noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 center = vec2(0.5, 0.45);
    float d = length(vUv - center);

    // Chaos: dark, cold void
    vec3 chaosBase = vec3(0.012, 0.016, 0.028);
    float chaosNebula = noise(vUv * 3.0 + uTime * 0.02) * 0.015;

    // Discovery: warm teal glow emerges from center
    float discoveryGlow = exp(-d * 3.2) * 0.04 * uScroll;
    float discoveryNebula = noise(vUv * 2.0 + uTime * 0.05) * 0.02 * uScroll;

    // Violet accent off-center
    float d2 = length(vUv - vec2(0.75, 0.35));
    float violetGlow = exp(-d2 * 4.5) * 0.015 * uScroll;

    vec3 teal = vec3(0.043, 0.808, 0.737);
    vec3 cyan = vec3(0.0, 0.784, 1.0);
    vec3 violet = vec3(0.35, 0.2, 0.8);

    vec3 col = chaosBase + chaosNebula;
    col += teal * discoveryGlow + cyan * discoveryNebula + violet * violetGlow;

    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Legacy exports (kept for compatibility if needed) ─────────────────────────

export const PARTICLE_VERT = FRAGMENT_VERT
export const PARTICLE_FRAG = FRAGMENT_FRAG
export const SPHERE_VERT = CORE_VERT
export const SPHERE_FRAG = CORE_FRAG
export const BEAM_VERT = CONNECTION_VERT
export const BEAM_FRAG = CONNECTION_FRAG
