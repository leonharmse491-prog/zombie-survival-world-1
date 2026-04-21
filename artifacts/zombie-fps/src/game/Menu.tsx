import { useState } from "react";
import { MISSIONS, UPGRADES, WEAPONS, WEAPON_ORDER, WeaponId } from "./data";
import { useGame } from "./store";

export function Menu() {
  const phase = useGame((s) => s.phase);
  const setPhase = useGame((s) => s.setPhase);
  const missionsCompleted = useGame((s) => s.missionsCompleted);
  const cash = useGame((s) => s.cash);
  const ownedWeapons = useGame((s) => s.ownedWeapons);
  const ownedUpgrades = useGame((s) => s.ownedUpgrades);
  const startMission = useGame((s) => s.startMission);
  const buyWeapon = useGame((s) => s.buyWeapon);
  const buyUpgrade = useGame((s) => s.buyUpgrade);
  const selectWeapon = useGame((s) => s.selectWeapon);
  const missionId = useGame((s) => s.missionId);

  const [tab, setTab] = useState<"missions" | "arsenal" | "upgrades" | "story">("missions");

  if (phase === "playing") return null;

  const highestCompleted = Math.max(0, ...missionsCompleted);
  const nextMissionId = highestCompleted + 1;

  if (phase === "paused") {
    return (
      <Backdrop>
        <div className="panel max-w-md w-full p-8 text-center">
          <div className="text-xs tracker text-[var(--muted)] uppercase">Paused</div>
          <div className="text-3xl font-bold uppercase tracking-wider mt-2">Mission Paused</div>
          <div className="text-sm text-[var(--muted)] mt-2">Click Resume to lock the cursor and continue.</div>
          <div className="flex gap-3 mt-6 justify-center">
            <button className="btn primary" onClick={() => setPhase("playing")}>Resume</button>
            <button className="btn" onClick={() => setPhase("menu")}>Abandon Mission</button>
          </div>
        </div>
      </Backdrop>
    );
  }

  if (phase === "won") {
    const m = missionId != null ? MISSIONS.find((x) => x.id === missionId) : null;
    return (
      <Backdrop>
        <div className="panel max-w-lg w-full p-8 text-center">
          <div className="text-xs tracker text-[var(--accent-2)] uppercase">Mission Complete</div>
          <div className="text-4xl font-bold uppercase tracking-wider mt-2">{m?.title}</div>
          <div className="text-sm text-[var(--muted)] mt-3">+ ${m?.reward.toLocaleString()} cash</div>
          {m?.unlockWeapon && (
            <div className="text-sm text-[var(--good)] mt-1">UNLOCKED: {WEAPONS[m.unlockWeapon].name}</div>
          )}
          <div className="flex gap-3 mt-8 justify-center">
            <button className="btn primary" onClick={() => setPhase("menu")}>Continue</button>
          </div>
        </div>
      </Backdrop>
    );
  }

  if (phase === "lost") {
    return (
      <Backdrop>
        <div className="panel max-w-lg w-full p-8 text-center">
          <div className="text-xs tracker text-[var(--accent)] uppercase">You Died</div>
          <div className="text-4xl font-bold uppercase tracking-wider mt-2">The Outbreak Wins</div>
          <div className="text-sm text-[var(--muted)] mt-3">
            They got you. The horde will keep coming. Gear up and try again.
          </div>
          <div className="flex gap-3 mt-8 justify-center">
            <button
              className="btn primary"
              onClick={() => {
                if (missionId != null) startMission(missionId);
              }}
            >
              Retry Mission
            </button>
            <button className="btn" onClick={() => setPhase("menu")}>Main Menu</button>
          </div>
        </div>
      </Backdrop>
    );
  }

  if (phase === "briefing") {
    const m = missionId != null ? MISSIONS.find((x) => x.id === missionId) : null;
    if (!m) { setPhase("menu"); return null; }
    return (
      <Backdrop>
        <div className="panel max-w-2xl w-full p-8">
          <div className="text-xs tracker text-[var(--accent)] uppercase">Mission {m.id} Briefing</div>
          <div className="text-3xl font-bold uppercase tracking-wider mt-2">{m.title}</div>
          <p className="text-base text-[var(--text)] mt-4 leading-relaxed">{m.story}</p>
          <div className="grid grid-cols-3 gap-3 mt-6 text-sm">
            <Stat label="Objective" value={m.brief} />
            <Stat label="Difficulty" value={"●".repeat(Math.min(5, Math.round(m.zombieMult * 1.4))) + "○".repeat(Math.max(0, 5 - Math.round(m.zombieMult * 1.4)))} />
            <Stat label="Reward" value={`$${m.reward.toLocaleString()}`} />
          </div>
          <div className="text-xs text-[var(--muted)] mt-6 uppercase tracker">Click Deploy to lock cursor and begin.</div>
          <div className="flex gap-3 mt-4 justify-end">
            <button className="btn ghost" onClick={() => setPhase("menu")}>Back</button>
            <button className="btn primary" onClick={() => startMission(m.id)}>Deploy</button>
          </div>
        </div>
      </Backdrop>
    );
  }

  // Main menu
  return (
    <Backdrop>
      <div className="max-w-5xl w-full">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-xs tracker text-[var(--accent)] uppercase">Replit Studios Presents</div>
            <h1 className="text-5xl font-black uppercase tracking-wider mt-1" style={{ fontStretch: "expanded" }}>
              DEAD <span className="text-[var(--accent)]">FRONTIER</span>
            </h1>
            <div className="text-sm text-[var(--muted)] mt-1 italic">
              "There is no cure. Only ammunition."
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs tracker text-[var(--muted)] uppercase">Operative Funds</div>
            <div className="text-3xl font-bold tracker text-[var(--accent-2)]">${cash.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex gap-1 mb-4">
          {(["missions", "arsenal", "upgrades", "story"] as const).map((t) => (
            <button
              key={t}
              className={`btn ${tab === t ? "primary" : "ghost"}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="panel p-6 min-h-[420px]">
          {tab === "missions" && (
            <div className="grid grid-cols-2 gap-3 scrollbar overflow-auto max-h-[460px]">
              {MISSIONS.map((m) => {
                const completed = missionsCompleted.includes(m.id);
                const locked = m.id > nextMissionId;
                return (
                  <div
                    key={m.id}
                    className={`p-4 border ${locked ? "border-[var(--border)] opacity-40" : completed ? "border-[var(--good)]" : "border-[var(--accent)]"}`}
                    style={{ background: "rgba(0,0,0,0.4)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs tracker text-[var(--muted)] uppercase">Mission {m.id}</div>
                      <div className="text-[10px] tracker uppercase">
                        {locked ? "Locked" : completed ? "Complete" : "Available"}
                      </div>
                    </div>
                    <div className="text-lg font-bold uppercase mt-1">{m.title}</div>
                    <div className="text-xs text-[var(--muted)] mt-1">{m.brief}</div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-[var(--accent-2)] tracker">${m.reward.toLocaleString()}</span>
                      <button
                        className="btn primary"
                        disabled={locked}
                        onClick={() => {
                          useGame.setState({ missionId: m.id });
                          setPhase("briefing");
                        }}
                      >
                        {completed ? "Replay" : "Brief"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "arsenal" && (
            <div className="grid grid-cols-2 gap-3 scrollbar overflow-auto max-h-[460px]">
              {WEAPON_ORDER.map((id) => {
                const w = WEAPONS[id];
                const owned = ownedWeapons.includes(id);
                const lockedByStory = w.unlockMission > Math.max(0, ...missionsCompleted);
                const canAfford = cash >= w.cost;
                return (
                  <div key={id} className="p-4 border border-[var(--border)]" style={{ background: "rgba(0,0,0,0.4)" }}>
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold uppercase">{w.name}</div>
                      <div className="text-xs tracker text-[var(--muted)]">{owned ? "OWNED" : `$${w.cost.toLocaleString()}`}</div>
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">{w.desc}</div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] tracker">
                      <Bar label="DMG" value={Math.min(1, (w.damage * (w.pellets ?? 1)) / 230)} />
                      <Bar label="ROF" value={Math.min(1, w.fireRate / 18)} />
                      <Bar label="MAG" value={Math.min(1, w.magSize / 100)} />
                      <Bar label="RNG" value={Math.min(1, w.range / 220)} />
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      {owned ? (
                        <button className="btn" onClick={() => selectWeapon(id as WeaponId)}>Equip</button>
                      ) : (
                        <button
                          className="btn primary"
                          disabled={lockedByStory || !canAfford}
                          onClick={() => buyWeapon(id as WeaponId)}
                        >
                          {lockedByStory ? `Unlocks M${w.unlockMission}` : canAfford ? "Buy" : "Need cash"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "upgrades" && (
            <div className="grid grid-cols-2 gap-3 scrollbar overflow-auto max-h-[460px]">
              {UPGRADES.map((u) => {
                const owned = ownedUpgrades.includes(u.id);
                const canAfford = cash >= u.cost;
                return (
                  <div key={u.id} className="p-4 border border-[var(--border)]" style={{ background: "rgba(0,0,0,0.4)" }}>
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold uppercase">{u.name}</div>
                      <div className="text-xs tracker text-[var(--muted)]">{owned ? "OWNED" : `$${u.cost.toLocaleString()}`}</div>
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">{u.desc}</div>
                    <div className="mt-3 flex justify-end">
                      <button
                        className="btn primary"
                        disabled={owned || !canAfford}
                        onClick={() => buyUpgrade(u.id)}
                      >
                        {owned ? "Installed" : canAfford ? "Purchase" : "Need cash"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "story" && (
            <div className="prose-invert max-w-none scrollbar overflow-auto max-h-[460px] pr-4 leading-relaxed text-[var(--text)]">
              <div className="text-xs tracker text-[var(--accent)] uppercase mb-2">Field Journal</div>
              <h2 className="text-2xl font-bold uppercase">Day Zero</h2>
              <p className="text-sm text-[var(--muted)]">
                The grid went dark on a Tuesday. By Friday the cities were gone. We don't know what
                Patient Zero was — virologists are still arguing whether it was airborne, waterborne,
                or something deliberate. Doesn't matter now. The dead don't ask questions, and neither do we.
              </p>
              <p className="text-sm text-[var(--muted)] mt-3">
                You are an Operative for the United Resistance. Your job is simple: clear sectors,
                rescue survivors, and push back the rot. Each mission earns you cash and unlocks new
                gear. Save up. Trade up. Survive.
              </p>
              {MISSIONS.map((m) => {
                const completed = missionsCompleted.includes(m.id);
                return (
                  <div key={m.id} className={`mt-5 ${completed ? "" : "opacity-60"}`}>
                    <div className="text-xs tracker text-[var(--muted)] uppercase">Mission {m.id} {completed ? "— Logged" : "— Classified"}</div>
                    <h3 className="text-xl font-bold uppercase">{m.title}</h3>
                    <p className="text-sm">{completed ? m.story : "Mission classified. Complete prior operation to view."}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(circle at 30% 20%, rgba(140,30,30,0.18), transparent 60%), radial-gradient(circle at 80% 80%, rgba(60,40,10,0.2), transparent 60%), rgba(8,8,10,0.85)",
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border)] p-3" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="text-[10px] tracker text-[var(--muted)] uppercase">{label}</div>
      <div className="text-sm font-bold mt-1">{value}</div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-[var(--muted)]">
        <span>{label}</span>
        <span>{Math.round(value * 100)}</span>
      </div>
      <div className="h-1 bg-black/60 mt-0.5">
        <div className="h-full bg-[var(--accent-2)]" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
