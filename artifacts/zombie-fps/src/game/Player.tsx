import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { WEAPONS } from "./data";
import { useGame } from "./store";
import { AABB, raycastAABBs, resolveMove } from "./collision";
import type { Zombie, ZombiesAPI } from "./Zombies";

const PLAYER_RADIUS = 0.45;
const EYE_HEIGHT = 1.65;
const MOUSE_SENS = 0.0028;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

export function Player({
  posRef,
  obstaclesAABB,
  zombiesApiRef,
  onMuzzle,
  onShake,
}: {
  posRef: React.MutableRefObject<THREE.Vector3>;
  obstaclesAABB: AABB[];
  zombiesApiRef: React.MutableRefObject<ZombiesAPI | null>;
  onMuzzle: () => void;
  onShake: () => void;
}) {
  const { camera, gl } = useThree();
  const phase = useGame((s) => s.phase);

  const keys = useRef<Record<string, boolean>>({});
  const mouseDown = useRef(false);
  const rmbDown = useRef(false);
  const lastShot = useRef(0);
  const flameAccum = useRef(0);

  const yaw = useRef(0);
  const pitch = useRef(0);

  // Initial camera position
  useEffect(() => {
    camera.position.set(0, EYE_HEIGHT, 0);
    posRef.current.set(0, EYE_HEIGHT, 0);
    camera.rotation.order = "YXZ";
  }, [camera, posRef]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyR") {
        useGame.getState().startReload();
      }
      const num = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8"].indexOf(e.code);
      if (num >= 0) {
        const owned = useGame.getState().ownedWeapons;
        if (owned[num]) useGame.getState().selectWeapon(owned[num]);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const onMouseDown = (e: MouseEvent) => {
      if (useGame.getState().phase !== "playing") return;
      if (e.button === 0) mouseDown.current = true;
      if (e.button === 2) rmbDown.current = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseDown.current = false;
      if (e.button === 2) rmbDown.current = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (useGame.getState().phase !== "playing") return;
      const owned = useGame.getState().ownedWeapons;
      const cur = useGame.getState().currentWeapon;
      const idx = owned.indexOf(cur);
      const next = e.deltaY > 0 ? (idx + 1) % owned.length : (idx - 1 + owned.length) % owned.length;
      useGame.getState().selectWeapon(owned[next]);
    };
    const onContext = (e: Event) => e.preventDefault();
    const onMouseMove = (e: MouseEvent) => {
      if (useGame.getState().phase !== "playing") return;
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      yaw.current -= dx * MOUSE_SENS;
      pitch.current -= dy * MOUSE_SENS;
      if (pitch.current > PITCH_LIMIT) pitch.current = PITCH_LIMIT;
      if (pitch.current < -PITCH_LIMIT) pitch.current = -PITCH_LIMIT;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("wheel", onWheel);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  // Reset rotation when leaving play (avoid carrying yaw drift into menus visually)
  useEffect(() => {
    if (phase !== "playing") {
      mouseDown.current = false;
      rmbDown.current = false;
    }
  }, [phase]);

  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const move = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (phase !== "playing") return;

    // Apply mouse-look to camera
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");

    const stats = useGame.getState().getStats();
    const sprinting = !!keys.current["ShiftLeft"] || !!keys.current["ShiftRight"];
    const speed = sprinting ? stats.sprintSpeed : stats.walkSpeed;

    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

    move.set(0, 0, 0);
    if (keys.current["KeyW"] || keys.current["ArrowUp"]) move.add(fwd);
    if (keys.current["KeyS"] || keys.current["ArrowDown"]) move.sub(fwd);
    if (keys.current["KeyD"] || keys.current["ArrowRight"]) move.add(right);
    if (keys.current["KeyA"] || keys.current["ArrowLeft"]) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * delta);

    const desX = camera.position.x + move.x;
    const desZ = camera.position.z + move.z;
    const next = resolveMove(camera.position.x, camera.position.z, desX, desZ, PLAYER_RADIUS, obstaclesAABB);
    camera.position.x = Math.max(-79, Math.min(79, next.x));
    camera.position.z = Math.max(-79, Math.min(79, next.z));
    camera.position.y = EYE_HEIGHT;

    // ADS / scope FOV
    const targetFov = rmbDown.current
      ? useGame.getState().currentWeapon === "sniper" ? 25 : 50
      : 75;
    (camera as THREE.PerspectiveCamera).fov += (targetFov - (camera as THREE.PerspectiveCamera).fov) * Math.min(1, delta * 12);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

    posRef.current.copy(camera.position);

    // Shooting
    const game = useGame.getState();
    const w = WEAPONS[game.currentWeapon];
    const interval = 1000 / w.fireRate;
    const now = performance.now();

    const isFlame = w.burn === true;
    if (mouseDown.current && now - lastShot.current >= interval) {
      const fired = tryFire(camera, w, obstaclesAABB, zombiesApiRef.current, stats.damageMult);
      if (fired) {
        lastShot.current = now;
        onMuzzle();
        if (w.recoil > 1.2) onShake();
      }
    }

    if (isFlame && mouseDown.current) {
      flameAccum.current += delta;
    } else {
      flameAccum.current = 0;
    }
  });

  // No DOM controls component needed — we drive the camera ourselves.
  void gl;
  return null;
}

function tryFire(
  camera: THREE.Camera,
  w: ReturnType<typeof getW>,
  obstaclesAABB: AABB[],
  api: ZombiesAPI | null,
  dmgMult: number
): boolean {
  const game = useGame.getState();
  if (!game.consumeAmmo(1)) return false;
  if (!api) return true;

  const origin: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
  const baseDir = new THREE.Vector3();
  camera.getWorldDirection(baseDir).normalize();

  const pellets = w.pellets ?? 1;
  const dmgPer = w.damage * dmgMult;

  for (let p = 0; p < pellets; p++) {
    const dir = baseDir.clone();
    if (w.spread > 0) {
      const yaw = (Math.random() - 0.5) * w.spread * 2;
      const pitch = (Math.random() - 0.5) * w.spread * 2;
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, dir).normalize();
      dir.add(right.multiplyScalar(Math.tan(yaw)));
      dir.add(up.multiplyScalar(Math.tan(pitch)));
      dir.normalize();
    }

    const wallT = raycastAABBs(origin, [dir.x, dir.y, dir.z], obstaclesAABB, w.range);
    let bestT = wallT;
    let bestZ: Zombie | null = null;
    for (const z of api.list) {
      const t = raySphere(origin, [dir.x, dir.y, dir.z], [z.pos.x, z.pos.y + 0.3 * z.size, z.pos.z], 0.85 * z.size, bestT);
      if (t < bestT) {
        bestT = t;
        bestZ = z;
      }
    }
    if (bestZ) {
      api.damage(bestZ.id, dmgPer);
      if (w.burn) api.ignite(bestZ.id, dmgPer * 1.5, 1500);
    } else if (w.splash && wallT < w.range) {
      const t = isFinite(bestT) && bestT < w.range ? bestT : w.range;
      const cx = origin[0] + dir.x * t;
      const cy = origin[1] + dir.y * t;
      const cz = origin[2] + dir.z * t;
      api.splash(new THREE.Vector3(cx, cy, cz), w.splash, dmgPer);
    }
  }

  if (w.splash) {
    const dir = baseDir.clone();
    const wallT = raycastAABBs(origin, [dir.x, dir.y, dir.z], obstaclesAABB, w.range);
    let bestT = wallT;
    let bestZ: Zombie | null = null;
    for (const z of api.list) {
      const t = raySphere(origin, [dir.x, dir.y, dir.z], [z.pos.x, z.pos.y, z.pos.z], 0.85 * z.size, bestT);
      if (t < bestT) { bestT = t; bestZ = z; }
    }
    const t = isFinite(bestT) && bestT < w.range ? bestT : w.range;
    const cx = origin[0] + dir.x * t;
    const cy = origin[1] + dir.y * t;
    const cz = origin[2] + dir.z * t;
    api.splash(new THREE.Vector3(cx, cy, cz), w.splash, w.damage * dmgMult * 0.6);
  }

  return true;
}

function getW(id: string): typeof WEAPONS[keyof typeof WEAPONS] {
  return (WEAPONS as any)[id];
}

function raySphere(o: number[], d: number[], c: number[], r: number, max: number): number {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const sq = Math.sqrt(disc);
  const t = -b - sq;
  if (t < 0 || t > max) return Infinity;
  return t;
}
