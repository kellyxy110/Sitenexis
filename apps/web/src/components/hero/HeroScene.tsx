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
  FRAGMENT_VERT,
  FRAGMENT_FRAG,
  CONNECTION_VERT,
  CONNECTION_FRAG,
  PULSE_FRAG,
  PULSE_VERT,
  CORE_VERT,
  CORE_FRAG,
  BG_VERT,
  BG_FRAG,
} from './shaders'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HeroSceneProps {
  mouseRef: MutableRefObject<{ x: number; y: number }>
  scrollRef: MutableRefObject<number>
  isMobile: boolean
}

// ── Background void ──────────────────────────────────────────────────────────

function BackgroundVoid({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uScroll: { value: 0 },
  }), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = clock.getElapsedTime()
    matRef.current.uniforms.uScroll.value = scrollRef.current
  })

  return (
    <mesh position={[0, 0, -14]} renderOrder={-1}>
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

// ── Chaos Fragments — disconnected website particles ─────────────────────────

function ChaosFragments({
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

  const { positions, sizes, speeds, phases, types } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const speeds = new Float32Array(count)
    const phases = new Float32Array(count)
    const types = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const r = Math.random
      // Wide scattered distribution — representing digital chaos
      positions[i * 3] = (r() - 0.5) * 24
      positions[i * 3 + 1] = (r() - 0.5) * 14
      positions[i * 3 + 2] = (r() - 0.5) * 18 - 3
      sizes[i] = 1.2 + r() * 4.0
      speeds[i] = 0.15 + r() * 0.6
      phases[i] = r() * Math.PI * 2
      types[i] = r() // 0-1 determines color/behavior type
    }
    return { positions, sizes, speeds, phases, types }
  }, [count])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
  }), [])

  const worldMouse = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    const mat = matRef.current
    mat.uniforms.uTime.value = clock.getElapsedTime()
    mat.uniforms.uScroll.value = scrollRef.current

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
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aType" args={[types, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={FRAGMENT_VERT}
        fragmentShader={FRAGMENT_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ── Connection Network — lines form between fragments as discovery happens ───

const NODE_POSITIONS: [number, number, number][] = [
  [-5, 2.5, -4],
  [-3, -1.2, -3],
  [-1, 2, -5],
  [1, -0.5, -2],
  [2.5, 1.8, -3.5],
  [4, -1.5, -4],
  [5.5, 0.8, -2.5],
  [-4.5, -2, -5],
  [0.5, 3, -4],
  [3.5, -2.5, -3],
  [-2, 0.5, -2],
  [1.5, -2, -5],
]

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 3], [2, 4], [3, 5], [4, 6], [0, 8],
  [5, 9], [7, 0], [8, 4], [3, 10], [10, 2], [9, 6],
  [1, 11], [11, 5], [7, 1],
]

function ConnectionNetwork({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const linesRef = useRef<THREE.Group>(null)

  const lines = useMemo(() => {
    return CONNECTIONS.map(([a, b], i) => {
      const from = NODE_POSITIONS[a]
      const to = NODE_POSITIONS[b]
      const mid: [number, number, number] = [
        (from[0] + to[0]) / 2 + (Math.random() - 0.5) * 0.8,
        (from[1] + to[1]) / 2 + (Math.random() - 0.5) * 0.8,
        (from[2] + to[2]) / 2,
      ]

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(...from),
        new THREE.Vector3(...mid),
        new THREE.Vector3(...to),
      ])
      const pts = curve.getPoints(48)
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      const prog = new Float32Array(pts.length)
      for (let j = 0; j < pts.length; j++) prog[j] = j / (pts.length - 1)
      geo.setAttribute('aProgress', new THREE.BufferAttribute(prog, 1))

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uScroll: { value: 0 },
          uColor: { value: new THREE.Color(i % 3 === 0 ? '#00C8FF' : i % 3 === 1 ? '#0BCEBC' : '#7C5CFF') },
        },
        vertexShader: CONNECTION_VERT,
        fragmentShader: CONNECTION_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })

      return new THREE.Line(geo, mat)
    })
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    lines.forEach((line) => {
      const mat = line.material as THREE.ShaderMaterial
      mat.uniforms.uTime.value = t
      mat.uniforms.uScroll.value = scrollRef.current
    })
  })

  return (
    <group ref={linesRef}>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  )
}

// ── Network Nodes — glow points at connection intersections ──────────────────

function NetworkNodes({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const COUNT = NODE_POSITIONS.length

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    const s = scrollRef.current
    const appear = Math.max(0, (s - 0.2) / 0.5)

    NODE_POSITIONS.forEach((pos, i) => {
      dummy.position.set(pos[0], pos[1], pos[2])
      const pulse = 1 + Math.sin(t * 2 + i) * 0.15
      const scale = appear * pulse * 0.06
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial color="#0BCEBC" transparent opacity={0.9} />
    </instancedMesh>
  )
}

// ── Discovery Pulse — expanding ring from center ─────────────────────────────

function DiscoveryPulse({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uScroll: { value: 0 },
  }), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = clock.getElapsedTime()
    matRef.current.uniforms.uScroll.value = scrollRef.current
  })

  return (
    <mesh position={[0, 0, -6]} rotation={[0, 0, 0]}>
      <planeGeometry args={[16, 16]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={PULSE_VERT}
        fragmentShader={PULSE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// ── Neural Core — sphere that forms as intelligence converges ─────────────────

function NeuralCore({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const RADIUS = 1.0

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uScroll: { value: 0 },
  }), [])

  useFrame(({ clock, pointer }) => {
    if (!groupRef.current || !matRef.current) return
    const t = clock.getElapsedTime()
    const s = scrollRef.current

    matRef.current.uniforms.uTime.value = t
    matRef.current.uniforms.uScroll.value = s

    // Core only appears after scroll > 0.3
    const appear = Math.max(0, (s - 0.3) / 0.5)
    groupRef.current.scale.setScalar(appear * 0.8)

    // Gentle float
    groupRef.current.position.y = Math.sin(t * 0.5) * 0.1
    groupRef.current.rotation.y = t * 0.08 + pointer.x * 0.1
    groupRef.current.rotation.x = pointer.y * -0.05
  })

  return (
    <group ref={groupRef} position={[3.5, 0.2, -2]}>
      <mesh>
        <sphereGeometry args={[RADIUS, 48, 48]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={CORE_VERT}
          fragmentShader={CORE_FRAG}
          uniforms={uniforms}
          transparent
          side={THREE.FrontSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[RADIUS * 0.4, 24, 24]} />
        <meshBasicMaterial color="#0BCEBC" transparent opacity={0.05} />
      </mesh>

      {/* Orbit rings */}
      <mesh rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[RADIUS + 0.2, 0.005, 8, 96]} />
        <meshBasicMaterial color="#0BCEBC" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 5]}>
        <torusGeometry args={[RADIUS + 0.4, 0.004, 8, 96]} />
        <meshBasicMaterial color="#00C8FF" transparent opacity={0.3} />
      </mesh>

      <pointLight color="#0BCEBC" intensity={4} distance={8} decay={2} />
    </group>
  )
}

// ── Floating text labels — appear during discovery ───────────────────────────

function FloatingLabels({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    const s = scrollRef.current
    const appear = Math.max(0, (s - 0.4) / 0.4)
    groupRef.current.children.forEach((child, i) => {
      child.position.y += Math.sin(t * 0.3 + i) * 0.0005
      const mesh = child as THREE.Mesh
      if (mesh.material && 'opacity' in mesh.material) {
        (mesh.material as THREE.MeshBasicMaterial).opacity = appear * 0.6
      }
    })
  })

  return <group ref={groupRef} />
}

// ── Camera choreography ──────────────────────────────────────────────────────

function CameraRig({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  useFrame(({ camera }) => {
    const s = scrollRef.current

    // Chaos: wide, distant view
    // Discovery: camera moves closer, tilts down slightly
    const targetZ = 8 - s * 2
    const targetY = 1.2 + s * 0.5
    const targetX = s * 0.5

    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.03)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.03)
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.03)
  })
  return null
}

// ── Scene composition ────────────────────────────────────────────────────────

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
      <BackgroundVoid scrollRef={scrollRef} />
      <ambientLight intensity={0.1} />
      <CameraRig scrollRef={scrollRef} />
      <ChaosFragments count={count} mouseRef={mouseRef} scrollRef={scrollRef} />
      <ConnectionNetwork scrollRef={scrollRef} />
      <NetworkNodes scrollRef={scrollRef} />
      <DiscoveryPulse scrollRef={scrollRef} />
      <NeuralCore scrollRef={scrollRef} />
      <FloatingLabels scrollRef={scrollRef} />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.45}
          luminanceSmoothing={0.15}
          intensity={1.1}
          radius={0.7}
          blendFunction={BlendFunction.ADD}
        />
      </EffectComposer>
    </>
  )
}

// ── Canvas export ────────────────────────────────────────────────────────────

export default function HeroScene({ mouseRef, scrollRef, isMobile }: HeroSceneProps) {
  const count = isMobile ? 500 : 2000

  return (
    <Canvas
      camera={{ position: [0, 1.2, 8], fov: 56 }}
      dpr={[1, isMobile ? 1 : 1.5]}
      gl={{
        antialias: !isMobile,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      style={{ background: '#030812' }}
    >
      <Scene count={count} mouseRef={mouseRef} scrollRef={scrollRef} />
    </Canvas>
  )
}
