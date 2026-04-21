import { useEffect, useRef, useState } from "react";
import { MISSIONS, WEAPONS } from "./data";
import { useGame } from "./store";

export function HUD() {
  const phase = useGame((s) => s.phase);
  const health = useGame((s) => s.health);
  const ownedUpgrades = useGame((s) => s.ownedUpgrades);
  const stats = useGame.getState().getStats();
  void ownedUpgrades; // recompute when upgrades change
  const cash = useGame((s) => s.cash);
  const cur = useGame((s) => s.currentWeapon);
  const ammoInMag = useGame((s) => s.ammoInMag[cur]);
  const reserves = useGame((s) => s.reserves[cur]);
  const reloading = useGame((s) => s.reloading);
  const reloadEndsAt = useGame((s) => s.reloadEndsAt);
  const ownedWeapons = useGame((s) => s.ownedWeapons);
  const missionId = useGame((s) => s.missionId);
  const kills = useGame((s) => s.killsThisMission);
  const missionStartTime = useGame((s) => s.missionStartTime);
  const surviveDuration = useGame((s) => s.surviveDuration);
  const damageFlashId = useGame((s) => s.damageFlashId);

  const mission = missionId != null ? MISSIONS.find((m) => m.id === missionId) : null;

  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const loop = () => { setNow(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Survive timer — when it expires, spawn the end-of-mission boss instead
  // of completing immediately. The mission only ends once that boss dies.
  useEffect(() => {
    if (phase !== "playing" || !mission) return;
    if (mission.objective.kind !== "survive") return;
    const elapsed = (now - missionStartTime) / 1000;
    if (elapsed >= surviveDuration) {
      const s = useGame.getState();
      if (!s.endBossPending && !s.endBossSpawned) {
        s.triggerEndBossSpawn();
      }
    }
  }, [now, phase, mission, missionStartTime, surviveDuration]);

  if (phase !== "playing" && phase !== "paused") return null;

  const w = WEAPONS[cur];
  const elapsed = (now - missionStartTime) / 1000;
  const reloadPct = reloading
    ? Math.max(0, Math.min(1, 1 - (reloadEndsAt - now) / Math.max(1, reloadEndsAt - missionStartTime)))
    : 0;
  const reloadProgress = reloading && !w.melee
    ? Math.min(1, 1 - (reloadEndsAt - now) / (w.reloadTime * stats.reloadMult * 1000))
    : 0;
  const endBossPending = useGame.getState().endBossPending;
  const endBossSpawned = useGame.getState().endBossSpawned;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 select-none" key={damageFlashId}>
      {/* Crosshair */}
      <div className="crosshair">
        <div className="dot" />
      </div>

      {/* Mission tracker (top) */}
      {mission && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 panel px-5 py-2 text-center">
          <div className="text-[10px] tracker text-[var(--muted)] uppercase">Mission {mission.id}</div>
          <div className="text-sm font-bold tracker uppercase">{mission.title}</div>
          <div className="text-xs text-[var(--muted)] mt-0.5">
            {(endBossPending || endBossSpawned) ? (
              <span className="text-[var(--accent)] tracker">
                {endBossSpawned ? "KILL THE BOSS — bonus reward" : "Boss inbound..."}
              </span>
            ) : (
              <>
                {mission.objective.kind === "kill" && (
                  <>Eliminate: <span className="text-[var(--accent)] tracker">{kills}</span> / {mission.objective.count}</>
                )}
                {mission.objective.kind === "survive" && (
                  <>Survive: <span className="text-[var(--accent)] tracker">{Math.max(0, surviveDuration - elapsed).toFixed(1)}s</span></>
                )}
                {mission.objective.kind === "boss" && (
                  <>Eliminate: <span className="text-[var(--accent)] tracker">{kills}</span> / {mission.objective.count + 1} (incl. Boss)</>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Top-left: Health + Cash */}
      <div className="absolute top-4 left-4 panel px-4 py-3 min-w-[220px]">
        <div className="flex items-center justify-between text-[10px] uppercase tracker text-[var(--muted)]">
          <span>Health</span>
          <span className="text-white tracker">{Math.ceil(health)} / {stats.maxHealth}</span>
        </div>
        <div className="h-2 mt-1 bg-black/60 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.max(0, (health / stats.maxHealth) * 100)}%`,
              background: health > stats.maxHealth * 0.5 ? "var(--good)" : health > stats.maxHealth * 0.25 ? "var(--accent-2)" : "var(--accent)",
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracker text-[var(--muted)]">Cash</span>
          <span className="text-[var(--accent-2)] font-bold tracker">${cash.toLocaleString()}</span>
        </div>
      </div>

      {/* Bottom-right: Weapon + Ammo */}
      <div className="absolute bottom-6 right-6 panel px-5 py-3 min-w-[220px] text-right">
        <div className="text-[10px] uppercase tracker text-[var(--muted)]">Weapon</div>
        <div className="text-sm font-bold uppercase">{w.name}</div>
        <div className="mt-1 text-3xl font-bold tracker">
          {w.melee ? (
            <span className="text-white">MELEE <span className="text-[var(--muted)] text-lg">/ ∞</span></span>
          ) : reloading ? (
            <span className="text-[var(--accent-2)]">RELOADING</span>
          ) : (
            <>
              <span className={ammoInMag === 0 ? "text-[var(--accent)]" : ""}>{ammoInMag}</span>
              <span className="text-[var(--muted)] text-lg"> / {reserves}</span>
            </>
          )}
        </div>
        {reloading && (
          <div className="h-1 mt-2 bg-black/60 overflow-hidden">
            <div className="h-full bg-[var(--accent-2)]" style={{ width: `${reloadProgress * 100}%` }} />
          </div>
        )}
      </div>

      {/* Bottom-left: Weapon slots */}
      <div className="absolute bottom-6 left-6 flex gap-2">
        {ownedWeapons.map((id, i) => {
          const def = WEAPONS[id];
          const active = id === cur;
          return (
            <div
              key={id}
              className={`panel px-3 py-2 min-w-[58px] text-center ${active ? "ring-2 ring-[var(--accent)]" : ""}`}
              style={{ opacity: active ? 1 : 0.55 }}
            >
              <div className="text-[10px] tracker text-[var(--muted)]">{i + 1}</div>
              <div className="text-[11px] font-bold uppercase">{def.name.split(" ")[0]}</div>
            </div>
          );
        })}
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] tracker uppercase text-[var(--muted)]">
        WASD Move · Shift Sprint · Mouse Aim · LMB Fire/Swing · RMB Aim · R Reload · 1-9 / Wheel Switch · Esc Pause
      </div>
    </div>
  );
}
