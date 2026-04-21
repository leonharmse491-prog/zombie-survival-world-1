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
  yaw: number;
  walkPhase: number;
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
      // Find a spawn point: at least MIN_DIST away from player, inside arena,
      // not inside any obstacle. Try several candidates before giving up.
      const MIN_DIST = 25;
      const MAX_DIST = 45;
      let spawnX = 0;
      let spawnZ = 0;
      let valid = false;
      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = MIN_DIST + Math.random() * (MAX_DIST - MIN_DIST);
        const cx = player.x + Math.cos(angle) * dist;
        const cz = player.z + Math.sin(angle) * dist;
        if (cx < -78 || cx > 78 || cz < -78 || cz > 78) continue;
        const dx = cx - player.x;
        const dz = cz - player.z;
        if (Math.hypot(dx, dz) < MIN_DIST) continue;
        // reject if inside an obstacle (with margin)
        let blocked = false;
        for (const o of obstaclesAABB) {
          if (cx > o.minX - 0.8 && cx < o.maxX + 0.8 && cz > o.minZ - 0.8 && cz < o.maxZ + 0.8) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        spawnX = cx;
        spawnZ = cz;
        valid = true;
        break;
      }
      const clampedX = spawnX;
      const clampedZ = spawnZ;
      if (valid) {
      // Mix of shamblers and sprinters — sprinters chase down even a sprinting player.
      // Higher difficulty = more sprinters in the crowd.
      const runnerChance = Math.min(0.85, 0.25 + mission.zombieMult * 0.18);
      const isRunner = Math.random() < runnerChance;
      const speed = isRunner
        ? 6.0 + Math.random() * 1.6   // sprinter: ~6.0–7.6 (player sprint = 9)
        : 3.2 + Math.random() * 1.0;  // shambler: ~3.2–4.2 (player walk = 5)
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
        yaw: Math.atan2(player.x - clampedX, player.z - clampedZ),
        walkPhase: Math.random() * Math.PI * 2,
      });
      }
    }

    // Boss spawn
    if (
      (mission.objective.kind === "boss") &&
      !bossSpawned &&
      useGame.getState().killsThisMission >= Math.max(2, Math.floor(mission.objective.count * 0.4))
    ) {
      let bx = 0, bz = 0, bossValid = false;
      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 12;
        const cx = player.x + Math.cos(angle) * dist;
        const cz = player.z + Math.sin(angle) * dist;
        if (cx < -75 || cx > 75 || cz < -75 || cz > 75) continue;
        let blocked = false;
        for (const o of obstaclesAABB) {
          if (cx > o.minX - 1.5 && cx < o.maxX + 1.5 && cz > o.minZ - 1.5 && cz < o.maxZ + 1.5) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        bx = cx; bz = cz; bossValid = true; break;
      }
      if (bossValid) {
        zombies.current.push({
          id: nextId.current++,
          pos: new THREE.Vector3(bx, 1.6, bz),
          hp: 1500,
          maxHp: 1500,
          speed: 4.5,
          attackCd: 0,
          burnUntil: 0,
          burnDmgPerSec: 0,
          isBoss: true,
          size: 2.2,
          yaw: Math.atan2(player.x - bx, player.z - bz),
          walkPhase: 0,
        });
        useGame.setState({ bossSpawned: true });
      }
    }

    // Update each zombie
    for (const z of zombies.current) {
      // Burn DOT
      if (now < z.burnUntil && z.burnDmgPerSec > 0) {
        z.hp -= z.burnDmgPerSec * delta;
      }
      // Chase the player relentlessly
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
        const movedX = next.x - z.pos.x;
        const movedZ = next.z - z.pos.z;
        z.pos.x = next.x;
        z.pos.z = next.z;
        // Face the player and animate stride
        const targetYaw = Math.atan2(nx, nz);
        let dy = targetYaw - z.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        z.yaw += dy * Math.min(1, delta * 10);
        const moved = Math.hypot(movedX, movedZ);
        if (moved > 0.0001) {
          z.walkPhase += delta * (z.speed * 1.4);
        }
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
        const swing = Math.sin(z.walkPhase) * 0.6;
        const swing2 = Math.sin(z.walkPhase + Math.PI) * 0.6;
        const bob = Math.abs(Math.sin(z.walkPhase)) * 0.08;
        const isSprinter = z.speed > 5.5 && !z.isBoss;
        const lean = isSprinter ? 0.25 : 0.05;
        return (
          <group key={z.id} position={[z.pos.x, bob, z.pos.z]} rotation={[0, z.yaw, 0]}>
            {/* Body */}
            <mesh castShadow position={[0, 0.9 * z.size, 0]} rotation={[lean, 0, 0]}>
              <boxGeometry args={[0.8 * z.size, 1.4 * z.size, 0.5 * z.size]} />
              <meshStandardMaterial color={color} roughness={0.9} emissive={burning ? "#ff5511" : "#000"} emissiveIntensity={burning ? 0.6 : 0} />
            </mesh>
            {/* Head */}
            <mesh castShadow position={[0, 1.85 * z.size, 0.05 * z.size]} rotation={[lean * 0.5, 0, 0]}>
              <boxGeometry args={[0.55 * z.size, 0.55 * z.size, 0.55 * z.size]} />
              <meshStandardMaterial color={headColor} roughness={0.9} />
            </mesh>
            {/* Arms (outstretched, swinging) */}
            <mesh castShadow position={[-0.55 * z.size, 1.25 * z.size, 0.35 * z.size]} rotation={[Math.PI / 4 + swing * 0.3, 0, 0]}>
              <boxGeometry args={[0.22 * z.size, 0.9 * z.size, 0.22 * z.size]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh castShadow position={[0.55 * z.size, 1.25 * z.size, 0.35 * z.size]} rotation={[Math.PI / 4 + swing2 * 0.3, 0, 0]}>
              <boxGeometry args={[0.22 * z.size, 0.9 * z.size, 0.22 * z.size]} />
              <meshStandardMaterial color={color} />
            </mesh>
            {/* Legs (alternating stride) */}
            <mesh castShadow position={[-0.2 * z.size, 0.25 * z.size, swing * 0.15 * z.size]} rotation={[swing * 0.7, 0, 0]}>
              <boxGeometry args={[0.28 * z.size, 0.5 * z.size, 0.28 * z.size]} />
              <meshStandardMaterial color="#1f1f1f" />
            </mesh>
            <mesh castShadow position={[0.2 * z.size, 0.25 * z.size, swing2 * 0.15 * z.size]} rotation={[swing2 * 0.7, 0, 0]}>
              <boxGeometry args={[0.28 * z.size, 0.5 * z.size, 0.28 * z.size]} />
              <meshStandardMaterial color="#1f1f1f" />
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
