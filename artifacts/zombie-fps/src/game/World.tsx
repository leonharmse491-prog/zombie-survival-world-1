import { useMemo } from "react";
import * as THREE from "three";

export interface Obstacle {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
}

// Deterministic PRNG so layout is stable
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeObstacles(): Obstacle[] {
  const rand = mulberry32(1337);
  const out: Obstacle[] = [];

  // Outer walls — keeps player in arena
  const ARENA = 80;
  const WALL_H = 6;
  out.push({ pos: [0, WALL_H / 2, -ARENA], size: [ARENA * 2, WALL_H, 2], color: "#1a1a1f" });
  out.push({ pos: [0, WALL_H / 2, ARENA], size: [ARENA * 2, WALL_H, 2], color: "#1a1a1f" });
  out.push({ pos: [-ARENA, WALL_H / 2, 0], size: [2, WALL_H, ARENA * 2], color: "#1a1a1f" });
  out.push({ pos: [ARENA, WALL_H / 2, 0], size: [2, WALL_H, ARENA * 2], color: "#1a1a1f" });

  // Buildings (large blocks)
  for (let i = 0; i < 14; i++) {
    const w = 6 + rand() * 10;
    const d = 6 + rand() * 10;
    const h = 4 + rand() * 8;
    let x = (rand() - 0.5) * (ARENA * 1.6);
    let z = (rand() - 0.5) * (ARENA * 1.6);
    // Keep clear zone around spawn (origin)
    if (Math.hypot(x, z) < 12) {
      x += Math.sign(x || 1) * 14;
      z += Math.sign(z || 1) * 14;
    }
    out.push({
      pos: [x, h / 2, z],
      size: [w, h, d],
      color: i % 3 === 0 ? "#2b2723" : i % 3 === 1 ? "#3a342b" : "#26282b",
    });
  }

  // Crates
  for (let i = 0; i < 30; i++) {
    const s = 1.2 + rand() * 1.2;
    let x = (rand() - 0.5) * (ARENA * 1.7);
    let z = (rand() - 0.5) * (ARENA * 1.7);
    if (Math.hypot(x, z) < 4) {
      x += 6;
    }
    out.push({
      pos: [x, s / 2, z],
      size: [s, s, s],
      color: rand() > 0.5 ? "#5a3e1a" : "#4a4030",
    });
  }

  // Burnt-out cars (long flat boxes)
  for (let i = 0; i < 8; i++) {
    const x = (rand() - 0.5) * (ARENA * 1.6);
    const z = (rand() - 0.5) * (ARENA * 1.6);
    if (Math.hypot(x, z) < 8) continue;
    out.push({
      pos: [x, 0.8, z],
      size: [4, 1.6, 2],
      color: "#1a1416",
    });
  }

  return out;
}

export function World({ obstacles }: { obstacles: Obstacle[] }) {
  const groundGeo = useMemo(() => new THREE.PlaneGeometry(200, 200), []);
  const groundMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 0.95, metalness: 0 }),
    []
  );

  // Streetlights for atmosphere (purely visual)
  const lights = useMemo(() => {
    const rand = mulberry32(42);
    const arr: { pos: [number, number, number]; color: string }[] = [];
    for (let i = 0; i < 6; i++) {
      arr.push({
        pos: [(rand() - 0.5) * 130, 7, (rand() - 0.5) * 130],
        color: rand() > 0.5 ? "#ff8855" : "#ffaa55",
      });
    }
    return arr;
  }, []);

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        geometry={groundGeo}
        material={groundMat}
        receiveShadow
      />
      {/* Road grid lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[12, 200]} />
        <meshStandardMaterial color="#262626" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <planeGeometry args={[200, 12]} />
        <meshStandardMaterial color="#262626" roughness={1} />
      </mesh>

      {obstacles.map((o, i) => (
        <mesh key={i} position={o.pos} castShadow receiveShadow>
          <boxGeometry args={o.size} />
          <meshStandardMaterial color={o.color} roughness={0.8} />
        </mesh>
      ))}

      {/* Atmospheric point lights */}
      {lights.map((l, i) => (
        <pointLight key={i} position={l.pos} color={l.color} intensity={1.2} distance={20} />
      ))}

      {/* Moonlight */}
      <directionalLight
        position={[40, 60, 20]}
        intensity={0.55}
        color="#9bb6ff"
      />
      <ambientLight intensity={0.18} color="#3a3a55" />
      <hemisphereLight args={["#445577", "#1a1a1a", 0.25]} />
      <fog attach="fog" args={["#0a0a0c", 25, 110]} />
    </group>
  );
}
