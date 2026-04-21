import { Canvas } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Player } from "./Player";
import { WeaponView } from "./WeaponView";
import { World, makeObstacles } from "./World";
import { useZombies, ZombieMeshes, ZombiesAPI } from "./Zombies";
import { useGame } from "./store";
import { obstacleAABB } from "./collision";

export function Scene({
  onMuzzle,
  onShake,
}: {
  onMuzzle: () => void;
  onShake: () => void;
}) {
  const obstacles = useMemo(() => makeObstacles(), []);
  const obstaclesAABB = useMemo(() => obstacles.map((o) => obstacleAABB(o)), [obstacles]);
  const playerPos = useRef(new THREE.Vector3(0, 1.65, 0));
  const zombiesApi = useRef<ZombiesAPI | null>(null);

  return (
    <Canvas
      shadows
      gl={{ antialias: true }}
      camera={{ fov: 75, near: 0.05, far: 250, position: [0, 1.65, 0] }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#0a0a0c"]} />
      <World obstacles={obstacles} />
      <SceneInner
        playerPos={playerPos}
        obstaclesAABB={obstaclesAABB}
        zombiesApi={zombiesApi}
        onMuzzle={onMuzzle}
        onShake={onShake}
      />
    </Canvas>
  );
}

function SceneInner({
  playerPos,
  obstaclesAABB,
  zombiesApi,
  onMuzzle,
  onShake,
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
  obstaclesAABB: ReturnType<typeof makeObstacles> extends infer T
    ? import("./collision").AABB[]
    : never;
  zombiesApi: React.MutableRefObject<ZombiesAPI | null>;
  onMuzzle: () => void;
  onShake: () => void;
}) {
  const zombiesRef = useZombies(playerPos, obstaclesAABB, zombiesApi);
  const currentWeapon = useGame((s) => s.currentWeapon);
  const [firing, setFiring] = useState(false);

  return (
    <>
      <Player
        posRef={playerPos}
        obstaclesAABB={obstaclesAABB}
        zombiesApiRef={zombiesApi}
        onMuzzle={() => {
          setFiring(true);
          setTimeout(() => setFiring(false), 60);
          onMuzzle();
        }}
        onShake={onShake}
      />
      <WeaponView weaponId={currentWeapon} firing={firing} />
      <ZombieMeshes zombiesRef={zombiesRef as any} />
    </>
  );
}
