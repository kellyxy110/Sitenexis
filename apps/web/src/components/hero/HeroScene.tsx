'use client'

import {
  useRef,
  useMemo,
  type MutableRefObject,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import {
  PARTICLE_VERT,
  PARTICLE_FRAG,
  SPHERE_VERT,
  SPHERE_FRAG,
  BG_VERT,
  BG_FRAG,
  BEAM_VERT,
  BEAM_FRAG,
} from './shaders'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HeroSceneProps {
  mouseRef: MutableRefObject<{ x: number; y: number }>
  scrollRef: MutableRefObject<number>
  isMobile: boolean
}

// ── Volumetric background plane ───────────────────────────────────────────────

function BackgroundVoid() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), [])

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={[0, 0, -12]} renderOrder={-1}>
      <planeGeometry args={[60, 34]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={BG_VERT}
        fragmentShader={BG_FRAG}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  )
}

// ── GPU particle field ────────────────────────────────────────────────────────

function ParticleField({
  count,
  mouseRef,
  scrollRef,
}: {
  count: number
  mouseRef: MutableRefObject<{ x: number; y: number }>
  scrollRef: MutableRefObject<number>
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const { camera } = useThree()

  const { positions, sizes, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes     = new Float32Array(count)
    const speeds    = new Float32Array(count)
    const phases    = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const r = Math.random
      positions[i * 3]     = (r() - 0.5) * 20
      positions[i * 3 + 1] = (r() - 0.5) * 10
      positions[i * 3 + 2] = (r() - 0.5) * 16 - 2
      sizes[i]   = 1.5 + r() * 3.5
      speeds[i]  = 0.2 + r() * 0.6
      phases[i]  = r() * Math.PI * 2
    }
    return { positions, sizes, speeds, phases }
  }, [count])

  const uniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uMouse:  { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
    uColorA: { value: new THREE.Color('#0BCEBC') },
    uColorB: { value: new THREE.Color('#00C8FF') },
  }), [])

  const worldMouse = useMemo(() => new THREE.Vector3(), [])
  const camDir     = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    const mat = matRef.current
    mat.uniforms.uTime.value   = clock.getElapsedTime()
    mat.uniforms.uScroll.value = scrollRef.current

    // Convert NDC mouse → world at z=0 plane
    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    worldMouse.set(mx, my, 0.5).unproject(camera)
    camDir.copy(worldMouse).sub(camera.position).normalize()
    const t = -camera.position.z / camDir.z
    worldMouse.copy(camera.position).addScaledVector(camDir, t)
    mat.uniforms.uMouse.value.set(worldMouse.x, worldMouse.y)
  })

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize"    args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aSpeed"   args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aPhase"   args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={PARTICLE_VERT}
        fragmentShader={PARTICLE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ── Perspective wireframe grid ────────────────────────────────────────────────

function SceneGrid({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const gridMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#0BCEBC'),
      wireframe: true,
      transparent: true,
      opacity: 0.04,
    })
    return m
  }, [])

  useFrame(() => {
    if (!meshRef.current) return
    const s = scrollRef.current
    meshRef.current.rotation.x = -0.45 + s * 0.2
    meshRef.current.position.y = -3.5 - s * 2
  })

  return (
    <mesh ref={meshRef} rotation={[-0.45, 0, 0]} position={[0, -3.5, -4]}>
      <planeGeometry args={[40, 40, 32, 32]} />
      <primitive object={gridMat} />
    </mesh>
  )
}

// ── AI signal beams ───────────────────────────────────────────────────────────

const BEAM_NODES: [number, number, number][] = [
  [-4, 2, -3],
  [-2, -1.5, -2],
  [1.5, 1.8, -4],
  [3.5, 0.5, -1.5],
  [4.5, -1, -3],
  [-5, -0.5, -5],
  [0, 2.5, -5],
]

const BEAM_PAIRS = [
  [0, 1], [1, 3], [2, 3], [3, 4], [0, 5], [2, 6],
]

function SignalBeam({ from, to, delay }: { from: [number,number,number]; to: [number,number,number]; delay: number }) {
  const line = useMemo(() => {
    const curve  = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...from),
      new THREE.Vector3(
        (from[0] + to[0]) / 2 + (Math.random() - 0.5) * 1.2,
        (from[1] + to[1]) / 2 + (Math.random() - 0.5) * 1.2,
        (from[2] + to[2]) / 2,
      ),
      new THREE.Vector3(...to),
    ])
    const pts     = curve.getPoints(60)
    const geo     = new THREE.BufferGeometry().setFromPoints(pts)
    const prog    = new Float32Array(pts.length)
    for (let i = 0; i < pts.length; i++) prog[i] = i / (pts.length - 1)
    geo.setAttribute('aProgress', new THREE.BufferAttribute(prog, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:  { value: 0 },
        uDelay: { value: delay },
        uColor: { value: new THREE.Color('#0BCEBC') },
      },
      vertexShader:   BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
    })

    const l = new THREE.Line(geo, mat)
    return l
  }, [from, to, delay])

  useFrame(({ clock }) => {
    const mat = line.material as THREE.ShaderMaterial
    mat.uniforms.uTime.value = clock.getElapsedTime()
  })

  return <primitive object={line} />
}

function SignalBeams() {
  return (
    <>
      {BEAM_PAIRS.map(([a, b], i) => (
        <SignalBeam
          key={i}
          from={BEAM_NODES[a]}
          to={BEAM_NODES[b]}
          delay={i * 0.4}
        />
      ))}
    </>
  )
}

// ── Node dots at beam endpoints ───────────────────────────────────────────────

function BeamNodes() {
  return (
    <>
      {BEAM_NODES.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial
            color="#0BCEBC"
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
    </>
  )
}

// ── Intelligence sphere ───────────────────────────────────────────────────────

function OrbitParticles({ radius }: { radius: number }) {
  const COUNT = 24
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy   = useMemo(() => new THREE.Object3D(), [])

  const offsets = useMemo(() => {
    return Array.from({ length: COUNT }, (_, i) => ({
      angle:  (i / COUNT) * Math.PI * 2,
      ring:   i % 3,          // 0, 1, 2 orbit rings
      speed:  0.25 + (i % 3) * 0.08,
      tilt:   [0, Math.PI / 4, Math.PI / 2][i % 3] as number,
    }))
  }, [])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    offsets.forEach(({ angle, ring, speed, tilt }, i) => {
      const a  = angle + t * speed
      const r  = radius + ring * 0.25
      const px = Math.cos(a) * r
      const pz = Math.sin(a) * r
      // Tilt the orbit plane per ring
      const py = Math.sin(a) * r * Math.sin(tilt) * 0.5

      dummy.position.set(px, py, pz)
      dummy.scale.setScalar(0.04 + (ring === 0 ? 0.02 : 0))
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#00C8FF" transparent opacity={0.85} />
    </instancedMesh>
  )
}

function ScanRings({ radius }: { radius: number }) {
  const ringRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ]

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ringRefs[0].current) ringRefs[0].current.rotation.y = t * 0.4
    if (ringRefs[1].current) {
      ringRefs[1].current.rotation.x = t * 0.25
      ringRefs[1].current.rotation.z = t * 0.15
    }
    if (ringRefs[2].current) ringRefs[2].current.rotation.z = -t * 0.18
  })

  return (
    <>
      <mesh ref={ringRefs[0]}>
        <torusGeometry args={[radius + 0.18, 0.006, 8, 128]} />
        <meshBasicMaterial color="#0BCEBC" transparent opacity={0.5} />
      </mesh>
      <mesh ref={ringRefs[1]} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[radius + 0.38, 0.004, 8, 128]} />
        <meshBasicMaterial color="#00C8FF" transparent opacity={0.3} />
      </mesh>
      <mesh ref={ringRefs[2]} rotation={[0, 0, Math.PI / 5]}>
        <torusGeometry args={[radius + 0.6, 0.003, 8, 128]} />
        <meshBasicMaterial color="#7C5CFF" transparent opacity={0.2} />
      </mesh>
    </>
  )
}

function IntelligenceSphere({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null)
  const matRef   = useRef<THREE.ShaderMaterial>(null)
  const RADIUS   = 1.2

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), [])

  useFrame(({ clock, pointer }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    const s = scrollRef.current

    // Slow float
    groupRef.current.position.y = Math.sin(t * 0.4) * 0.12
    // Subtle cursor tilt
    groupRef.current.rotation.x = -pointer.y * 0.08
    groupRef.current.rotation.y = pointer.x  * 0.12 + t * 0.05
    // Scale out on scroll
    const scale = 1 - s * 0.35
    groupRef.current.scale.setScalar(Math.max(0.3, scale))
    // Opacity on scroll handled by sphere alpha

    if (matRef.current) matRef.current.uniforms.uTime.value = t
  })

  return (
    <group ref={groupRef} position={[3.2, 0, -1.5]}>
      {/* Holographic sphere */}
      <mesh>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={SPHERE_VERT}
          fragmentShader={SPHERE_FRAG}
          uniforms={uniforms}
          transparent
          side={THREE.FrontSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner core glow */}
      <mesh>
        <sphereGeometry args={[RADIUS * 0.55, 32, 32]} />
        <meshBasicMaterial color="#0BCEBC" transparent opacity={0.04} />
      </mesh>

      {/* Scan rings */}
      <ScanRings radius={RADIUS} />

      {/* Orbiting particles */}
      <OrbitParticles radius={RADIUS + 0.5} />

      {/* Point light from sphere */}
      <pointLight color="#0BCEBC" intensity={3} distance={8} decay={2} />
    </group>
  )
}

// ── Camera scroll handler ─────────────────────────────────────────────────────

function CameraRig({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  useFrame(({ camera }) => {
    const s = scrollRef.current
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 7 + s * 4, 0.04)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.5 - s * 0.8, 0.04)
  })
  return null
}

// ── Inner scene ───────────────────────────────────────────────────────────────

function Scene({
  count,
  mouseRef,
  scrollRef,
}: {
  count: number
  mouseRef: MutableRefObject<{ x: number; y: number }>
  scrollRef: MutableRefObject<number>
}) {
  return (
    <>
      <BackgroundVoid />
      <ambientLight intensity={0.15} />
      <CameraRig scrollRef={scrollRef} />
      <SceneGrid scrollRef={scrollRef} />
      <ParticleField count={count} mouseRef={mouseRef} scrollRef={scrollRef} />
      <SignalBeams />
      <BeamNodes />
      <IntelligenceSphere scrollRef={scrollRef} />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.55}
          luminanceSmoothing={0.1}
          intensity={0.9}
          radius={0.6}
          blendFunction={BlendFunction.ADD}
        />
      </EffectComposer>
    </>
  )
}

// ── Canvas export (default) ───────────────────────────────────────────────────

export default function HeroScene({ mouseRef, scrollRef, isMobile }: HeroSceneProps) {
  const count = isMobile ? 450 : 1600

  return (
    <Canvas
      camera={{ position: [0, 1.5, 7], fov: 58 }}
      dpr={[1, isMobile ? 1 : 1.5]}
      gl={{
        antialias: !isMobile,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      style={{ background: '#050816' }}
    >
      <Scene count={count} mouseRef={mouseRef} scrollRef={scrollRef} />
    </Canvas>
  )
}
