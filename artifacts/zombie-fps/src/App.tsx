import { useEffect, useRef, useState } from "react";
import { Scene } from "./game/Scene";
import { HUD } from "./game/HUD";
import { Menu } from "./game/Menu";
import { useGame } from "./game/store";

export default function App() {
  const phase = useGame((s) => s.phase);
  const damageFlashId = useGame((s) => s.damageFlashId);
  const [muzzleId, setMuzzleId] = useState(0);
  const [shakeId, setShakeId] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pause on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && useGame.getState().phase === "playing") {
        useGame.setState({ phase: "paused" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 ${shakeId ? "shake" : ""} ${phase === "playing" ? "cursor-none" : ""}`}
      key={shakeId}
    >
      <Scene
        onMuzzle={() => setMuzzleId((n) => n + 1)}
        onShake={() => setShakeId((n) => n + 1)}
      />
      <HUD />
      <Menu />
      {phase === "playing" && muzzleId > 0 && (
        <div className="muzzle" key={muzzleId} />
      )}
      {phase === "playing" && damageFlashId > 0 && (
        <div className="damage-vignette" key={`dmg-${damageFlashId}`} />
      )}
    </div>
  );
}
