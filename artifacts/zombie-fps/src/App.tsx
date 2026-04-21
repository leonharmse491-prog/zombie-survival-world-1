import { useEffect, useRef, useState } from "react";
import { Scene } from "./game/Scene";
import { HUD } from "./game/HUD";
import { Menu } from "./game/Menu";
import { useGame } from "./game/store";

export default function App() {
  const phase = useGame((s) => s.phase);
  const isLocked = useGame((s) => s.isLocked);
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
    <div ref={containerRef} className={`fixed inset-0 ${shakeId ? "shake" : ""}`} key={shakeId}>
      <Scene
        onMuzzle={() => setMuzzleId((n) => n + 1)}
        onShake={() => setShakeId((n) => n + 1)}
      />
      <HUD />
      <Menu />
      {phase === "playing" && !isLocked && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 cursor-pointer select-none"
          onClick={() => {
            const canvas = containerRef.current?.querySelector("canvas");
            if (canvas) {
              const p = (canvas as HTMLCanvasElement).requestPointerLock();
              if (p && typeof (p as Promise<void>).catch === "function") {
                (p as Promise<void>).catch(() => {});
              }
            }
          }}
        >
          <div className="text-center px-6 py-5 rounded-xl border border-white/10 bg-black/65 shadow-2xl">
            <div className="text-xs tracking-[0.3em] text-[var(--muted)]">READY</div>
            <div className="mt-1 text-2xl font-extrabold tracking-wider">CLICK TO ENGAGE</div>
            <div className="mt-2 text-sm text-[var(--muted)]">
              Mouse aims · LMB fires · Esc pauses
            </div>
          </div>
        </div>
      )}
      {phase === "playing" && muzzleId > 0 && (
        <div className="muzzle" key={muzzleId} />
      )}
      {phase === "playing" && damageFlashId > 0 && (
        <div className="damage-vignette" key={`dmg-${damageFlashId}`} />
      )}
    </div>
  );
}
