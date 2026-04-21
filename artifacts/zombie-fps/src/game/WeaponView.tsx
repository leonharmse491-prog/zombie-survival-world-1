import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { WEAPONS, WeaponId } from "./data";

export function WeaponView({ weaponId, firing }: { weaponId: WeaponId; firing: boolean }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const bobT = useRef(0);
  const recoilT = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    bobT.current += delta;
    if (firing) recoilT.current = Math.min(1, recoilT.current + delta * 8);
    else recoilT.current = Math.max(0, recoilT.current - delta * 4);

    // Attach to camera
    const offset = new THREE.Vector3(0.35, -0.35, -0.7);
    const m = new THREE.Matrix4().makeRotationFromEuler(camera.rotation);
    offset.applyMatrix4(m);
    groupRef.current.position.copy(camera.position).add(offset);
    groupRef.current.rotation.copy(camera.rotation);
    // Recoil tilt
    groupRef.current.rotateX(-recoilT.current * 0.08 + Math.sin(bobT.current * 6) * 0.005);
  });

  const w = WEAPONS[weaponId];
  const long = weaponId === "sniper" ? 0.9 : weaponId === "rifle" || weaponId === "lmg" ? 0.7 : weaponId === "pistol" ? 0.32 : 0.55;
  const thickness = weaponId === "lmg" || weaponId === "grenade" ? 0.18 : 0.12;

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0, -long / 2]}>
        <boxGeometry args={[thickness * 1.1, thickness, long]} />
        <meshStandardMaterial color={w.color} roughness={0.6} />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -thickness * 0.9, -long * 0.15]}>
        <boxGeometry args={[thickness * 0.7, thickness * 1.4, thickness * 0.9]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Barrel */}
      <mesh position={[0, 0, -long]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[thickness * 0.35, thickness * 0.35, 0.1, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Sight */}
      <mesh position={[0, thickness * 0.7, -long * 0.4]}>
        <boxGeometry args={[thickness * 0.4, thickness * 0.4, thickness * 0.4]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
    </group>
  );
}
