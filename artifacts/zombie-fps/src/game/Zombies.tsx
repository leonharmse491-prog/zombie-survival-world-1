import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MISSIONS } from "./data";
import { useGame } from "./store";
import { AABB, resolveMove } from "./collision";

export interface Zombie {
  id: number;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  speed: number;
  attackCd: number;
  burnUntil: number;
  burnDmgPerSec: number;
  isBoss: boolean;
  size: number;
}

export interface ZombiesAPI {
  list: Zombie[];
  damage: (id: number, amount: number, isBurn?: boolean) => void;
  splash: (center: THREE.Vector3, radius: number, dmg: number) => void;
  ignite: (id: number, dps: number, durationMs: number) => void;
  getById: (id: number) => Zombie | undefined;
}

export function useZombies(
  playerPos: React.RefObject<THREE.Vector3>,
  obstaclesAABB: AABB[],
  apiRef: React.MutableRefObject<ZombiesAPI | null>
) {
  const zombies = useRef<Zombie[]>([]);
  const nextId = useRef(1);
  const lastSpawn = useRef(0);
  const tick = useRef(0);
  const force = useRef(0);

  const phase = useGame((s) => s.phase);
  const missionId = useGame((s) => s.missionId);
  const bossSpawned = useGame((s) => s.bossSpawned);
  const addKill = useGame((s) => s.addKill);
  const takeDamage = useGame((s) => s.takeDamage);

  const mission = useMemo(
    () => (missionId != null ? MISSIONS.find((m) => m.id === missionId) ?? null : null),
    [missionId]
  );

  // Reset on mission start
  useEffect(() => {
    zombies.current = [];
    nextId.current = 1;
    lastSpawn.current = performance.now();
  }, [missionId, phase]);

  // expose API
  useEffect(() => {
    apiRef.current = {
      get list() { return zombies.current; },
      damage(id, amount, isBurn) {
        const z = zombies.current.find((x) => x.id === id);
        if (!z) return;
        z.hp -= amount;
        if (z.hp <= 0) {
          zombies.current = zombies.current.filter((x) => x.id !== id);
          addKill(z.isBoss);
        }
      },
      splash(center, radius, dmg) {
        for (const z of [...zombies.current]) {
          const d = z.pos.distanceTo(center);
          if (d <= radius) {
            const falloff = 1 - d / radius;
            const amt = dmg * (0.4 + 0.6 * falloff);
            z.hp -= amt;
            if (z.hp <= 0) {
              zombies.current = zombies.current.filter((x) => x.id !== z.id);
              addKill(z.isBoss);
            }
          }
        }
      },
      ignite(id, dps, durationMs) {
        const z = zombies.current.find((x) => x.id === id);
        if (!z) return;
        z.burnDmgPerSec = Math.max(z.burnDmgPerSec, dps);
        z.burnUntil = Math.max(z.burnUntil, performance.now() + durationMs);
      },
      getById(id) {
        return zombies.current.find((x) => x.id === id);
      },
    };
    force.current++;
  });

  useFrame((_, delta) => {
    if (phase !== "playing") return;
    if (!playerPos.current || !mission) return;
    const now = performance.now();
    const player = playerPos.current;

    // Spawn logic
    const desiredCount = Math.min(
      24,
      Math.round((mission.objective.kind === "survive" ? 14 : 10) * mission.zombieMult)
    );
    const spawnInterval = Math.max(450, 2200 / mission.zombieMult);
    if (
      zombies.current.length < desiredCount &&
      now - lastSpawn.current > spawnInterval
    ) {
      lastSpawn.current = now;
      const angle = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * 18;
      const x = player.x + Math.cos(angle) * dist;
      const z = player.z + Math.sin(angle) * dist;
      const clampedX = Math.max(-78, Math.min(78, x));
      const clampedZ = Math.max(-78, Math.min(78, z));
      const isRunner = mission.zombieMult >= 1.8 && Math.random() < 0.35;
      const speed = isRunner ? 4.2 + Math.random() * 0.8 : 1.8 + Math.random() * 0.8;
      const baseHp = 60 + 20 * mission.zombieMult;
      zombies.current.push({
        id: nextId.current++,
        pos: new THREE.Vector3(clampedX, 0.9, clampedZ),
        hp: baseHp,
        maxHp: baseHp,
        speed,
        attackCd: 0,
        burnUntil: 0,
        burnDmgPerSec: 0,
        isBoss: false,
        size: 1,
      });
    }

    // Boss spawn
    if (
      (mission.objective.kind === "boss") &&
      !bossSpawned &&
      useGame.getState().killsThisMission >= Math.max(2, Math.floor(mission.objective.count * 0.4))
    ) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 25;
      const x = player.x + Math.cos(angle) * dist;
      const z = player.z + Math.sin(angle) * dist;
      zombies.current.push({
        id: nextId.current++,
        pos: new THREE.Vector3(x, 1.6, z),
        hp: 1500,
        maxHp: 1500,
        speed: 2.2,
        attackCd: 0,
        burnUntil: 0,
        burnDmgPerSec: 0,
        isBoss: true,
        size: 2.2,
      });
      useGame.setState({ bossSpawned: true });
    }

    // Update each zombie
    for (const z of zombies.current) {
      // Burn DOT
      if (now < z.burnUntil && z.burnDmgPerSec > 0) {
        z.hp -= z.burnDmgPerSec * delta;
      }
      // Move toward player
      const dx = player.x - z.pos.x;
      const dz = player.z - z.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        const stepDist = z.speed * delta;
        const desX = z.pos.x + nx * stepDist;
        const desZ = z.pos.z + nz * stepDist;
        const r = 0.6 * z.size;
        const next = resolveMove(z.pos.x, z.pos.z, desX, desZ, r, obstaclesAABB);
        z.pos.x = next.x;
        z.pos.z = next.z;
      }
      // Attack player
      const attackRange = 1.6 + z.size * 0.6;
      if (dist < attackRange) {
        if (z.attackCd <= 0) {
          const dmg = z.isBoss ? 18 : 8;
          takeDamage(dmg);
          z.attackCd = z.isBoss ? 1.0 : 0.9;
        }
      }
      z.attackCd = Math.max(0, z.attackCd - delta);
    }

    // Remove dead from burn
    const before = zombies.current.length;
    zombies.current = zombies.current.filter((z) => {
      if (z.hp <= 0) {
        addKill(z.isBoss);
        return false;
      }
      return true;
    });
    if (before !== zombies.current.length) tick.current++;

    tick.current++;
  });

  return zombies;
}

export function ZombieMeshes({ zombiesRef }: { zombiesRef: React.RefObject<Zombie[]> }) {
  const groupRef = useRef<THREE.Group>(null);
  // We'll render each zombie individually for simplicity; counts stay modest.
  const dummy = useRef(0);
  useFrame(() => {
    dummy.current++; // force re-render
  });

  // Snapshot to map (acceptable per-frame at modest counts)
  const list = zombiesRef.current ?? [];

  return (
    <group ref={groupRef}>
      {list.map((z) => {
        const burning = performance.now() < z.burnUntil;
        const color = z.isBoss ? "#5a1a1a" : burning ? "#ff7733" : "#3d4a2b";
        const headColor = z.isBoss ? "#7a2222" : "#4a5530";
        return (
          <group key={z.id} position={[z.pos.x, 0, z.pos.z]}>
            {/* Body */}
            <mesh castShadow position={[0, 0.9 * z.size, 0]}>
              <boxGeometry args={[0.8 * z.size, 1.4 * z.size, 0.5 * z.size]} />
              <meshStandardMaterial color={color} roughness={0.9} emissive={burning ? "#ff5511" : "#000"} emissiveIntensity={burning ? 0.6 : 0} />
            </mesh>
            {/* Head */}
            <mesh castShadow position={[0, 1.85 * z.size, 0]}>
              <boxGeometry args={[0.55 * z.size, 0.55 * z.size, 0.55 * z.size]} />
              <meshStandardMaterial color={headColor} roughness={0.9} />
            </mesh>
            {/* Arms (outstretched) */}
            <mesh castShadow position={[-0.6 * z.size, 1.2 * z.size, 0.3 * z.size]} rotation={[Math.PI / 4, 0, 0]}>
              <boxGeometry args={[0.22 * z.size, 0.9 * z.size, 0.22 * z.size]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh castShadow position={[0.6 * z.size, 1.2 * z.size, 0.3 * z.size]} rotation={[Math.PI / 4, 0, 0]}>
              <boxGeometry args={[0.22 * z.size, 0.9 * z.size, 0.22 * z.size]} />
              <meshStandardMaterial color={color} />
            </mesh>
            {/* Legs */}
            <mesh castShadow position={[-0.2 * z.size, 0.2 * z.size, 0]}>
              <boxGeometry args={[0.28 * z.size, 0.4 * z.size, 0.28 * z.size]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh castShadow position={[0.2 * z.size, 0.2 * z.size, 0]}>
              <boxGeometry args={[0.28 * z.size, 0.4 * z.size, 0.28 * z.size]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            {/* HP bar */}
            <group position={[0, 2.45 * z.size, 0]}>
              <mesh>
                <planeGeometry args={[1.2 * z.size, 0.12]} />
                <meshBasicMaterial color="#000" />
              </mesh>
              <mesh position={[-(1.2 * z.size) / 2 + (1.2 * z.size * (z.hp / z.maxHp)) / 2, 0, 0.01]}>
                <planeGeometry args={[1.2 * z.size * Math.max(0, z.hp / z.maxHp), 0.08]} />
                <meshBasicMaterial color={z.isBoss ? "#ff3333" : "#ff5555"} />
              </mesh>
            </group>
            {burning && (
              <pointLight position={[0, 1, 0]} color="#ff7733" intensity={1.5} distance={4} />
            )}
          </group>
        );
      })}
    </group>
  );
}
