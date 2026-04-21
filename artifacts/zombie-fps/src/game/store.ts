import { create } from "zustand";
import {
  BASE_STATS,
  MISSIONS,
  PlayerStats,
  UPGRADES,
  WEAPONS,
  WeaponId,
  WEAPON_ORDER,
} from "./data";

export type Phase = "menu" | "briefing" | "playing" | "paused" | "won" | "lost" | "shop";

export interface GameState {
  phase: Phase;
  cash: number;
  health: number;
  ownedWeapons: WeaponId[];
  ownedUpgrades: string[];
  currentWeapon: WeaponId;
  ammoInMag: Record<WeaponId, number>;
  reserves: Record<WeaponId, number>;
  reloading: boolean;
  reloadEndsAt: number;
  isFiringContinuous: boolean;
  isLocked: boolean;

  missionId: number | null;
  missionsCompleted: number[];
  killsThisMission: number;
  bossKillsThisMission: number;
  bossSpawned: boolean;
  missionStartTime: number;
  surviveDuration: number;
  damageFlashId: number;

  // Actions
  setPhase: (p: Phase) => void;
  startMission: (id: number) => void;
  completeMission: () => void;
  failMission: () => void;
  takeDamage: (amount: number) => void;
  addKill: (boss?: boolean) => void;
  addCash: (n: number) => void;
  buyWeapon: (id: WeaponId) => void;
  buyUpgrade: (id: string) => void;
  selectWeapon: (id: WeaponId) => void;
  startReload: () => void;
  finishReload: () => void;
  consumeAmmo: (n?: number) => boolean;
  resetForNewMission: () => void;
  getStats: () => PlayerStats;
  getMagCap: (id: WeaponId) => number;
}

function defaultAmmo(): Record<WeaponId, number> {
  return WEAPON_ORDER.reduce((acc, id) => {
    acc[id] = WEAPONS[id].magSize;
    return acc;
  }, {} as Record<WeaponId, number>);
}

function defaultReserves(): Record<WeaponId, number> {
  return WEAPON_ORDER.reduce((acc, id) => {
    acc[id] = WEAPONS[id].magSize * 4;
    return acc;
  }, {} as Record<WeaponId, number>);
}

export const useGame = create<GameState>((set, get) => ({
  phase: "menu",
  cash: 0,
  health: 100,
  ownedWeapons: ["pistol"],
  ownedUpgrades: [],
  currentWeapon: "pistol",
  ammoInMag: defaultAmmo(),
  reserves: defaultReserves(),
  reloading: false,
  reloadEndsAt: 0,
  isFiringContinuous: false,
  isLocked: false,

  missionId: null,
  missionsCompleted: [],
  killsThisMission: 0,
  bossKillsThisMission: 0,
  bossSpawned: false,
  missionStartTime: 0,
  surviveDuration: 0,
  damageFlashId: 0,

  setPhase: (p) => set({ phase: p }),

  getStats: () => {
    const owned = get().ownedUpgrades;
    let stats = { ...BASE_STATS };
    for (const id of owned) {
      const u = UPGRADES.find((x) => x.id === id);
      if (u) stats = u.apply(stats);
    }
    return stats;
  },

  getMagCap: (id) => {
    const stats = get().getStats();
    return Math.round(WEAPONS[id].magSize * stats.ammoMult);
  },

  resetForNewMission: () => {
    const stats = get().getStats();
    const ammo: Record<WeaponId, number> = { ...defaultAmmo() };
    const reserves: Record<WeaponId, number> = { ...defaultReserves() };
    for (const id of WEAPON_ORDER) {
      const cap = Math.round(WEAPONS[id].magSize * stats.ammoMult);
      ammo[id] = cap;
      reserves[id] = cap * 4;
    }
    set({
      health: stats.maxHealth,
      ammoInMag: ammo,
      reserves,
      reloading: false,
      reloadEndsAt: 0,
      killsThisMission: 0,
      bossKillsThisMission: 0,
      bossSpawned: false,
      missionStartTime: performance.now(),
      isFiringContinuous: false,
    });
  },

  startMission: (id) => {
    const m = MISSIONS.find((x) => x.id === id);
    if (!m) return;
    set({ missionId: id, surviveDuration: m.objective.kind === "survive" ? m.objective.count : 0 });
    get().resetForNewMission();
    set({ phase: "playing" });
  },

  completeMission: () => {
    const s = get();
    if (s.missionId == null) return;
    const m = MISSIONS.find((x) => x.id === s.missionId);
    if (!m) return;
    const stats = s.getStats();
    const reward = Math.round(m.reward * stats.cashMult);
    const newOwned = [...s.ownedWeapons];
    if (m.unlockWeapon && !newOwned.includes(m.unlockWeapon)) {
      newOwned.push(m.unlockWeapon);
    }
    set({
      phase: "won",
      cash: s.cash + reward,
      missionsCompleted: s.missionsCompleted.includes(s.missionId)
        ? s.missionsCompleted
        : [...s.missionsCompleted, s.missionId],
      ownedWeapons: newOwned,
    });
  },

  failMission: () => set({ phase: "lost" }),

  takeDamage: (amount) => {
    const s = get();
    const stats = s.getStats();
    const reduced = amount * (1 - stats.armor);
    const next = Math.max(0, s.health - reduced);
    set({ health: next, damageFlashId: s.damageFlashId + 1 });
    if (next <= 0 && s.phase === "playing") {
      set({ phase: "lost" });
    }
  },

  addKill: (boss = false) => {
    const s = get();
    const stats = s.getStats();
    const cashReward = Math.round((boss ? 80 : 15) * stats.cashMult);
    const m = s.missionId != null ? MISSIONS.find((x) => x.id === s.missionId) : null;
    let kills = s.killsThisMission + 1;
    let bossKills = s.bossKillsThisMission + (boss ? 1 : 0);
    set({ cash: s.cash + cashReward, killsThisMission: kills, bossKillsThisMission: bossKills });
    if (m && s.phase === "playing") {
      if (m.objective.kind === "kill" && kills >= m.objective.count) {
        get().completeMission();
      } else if (m.objective.kind === "boss" && bossKills >= 1 && kills >= m.objective.count + 1) {
        get().completeMission();
      }
    }
  },

  addCash: (n) => set((s) => ({ cash: s.cash + n })),

  buyWeapon: (id) => {
    const s = get();
    if (s.ownedWeapons.includes(id)) return;
    const w = WEAPONS[id];
    if (s.cash < w.cost) return;
    set({ cash: s.cash - w.cost, ownedWeapons: [...s.ownedWeapons, id] });
  },

  buyUpgrade: (id) => {
    const s = get();
    if (s.ownedUpgrades.includes(id)) return;
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) return;
    if (s.cash < u.cost) return;
    set({ cash: s.cash - u.cost, ownedUpgrades: [...s.ownedUpgrades, id] });
  },

  selectWeapon: (id) => {
    const s = get();
    if (!s.ownedWeapons.includes(id)) return;
    set({ currentWeapon: id, reloading: false, reloadEndsAt: 0 });
  },

  startReload: () => {
    const s = get();
    if (s.reloading) return;
    const w = WEAPONS[s.currentWeapon];
    const cap = s.getMagCap(s.currentWeapon);
    if (s.ammoInMag[s.currentWeapon] >= cap) return;
    if (s.reserves[s.currentWeapon] <= 0) return;
    const stats = s.getStats();
    const time = w.reloadTime * stats.reloadMult * 1000;
    set({ reloading: true, reloadEndsAt: performance.now() + time });
    setTimeout(() => {
      const cur = get();
      if (cur.reloading && cur.currentWeapon === s.currentWeapon) {
        cur.finishReload();
      }
    }, time);
  },

  finishReload: () => {
    const s = get();
    const id = s.currentWeapon;
    const cap = s.getMagCap(id);
    const need = cap - s.ammoInMag[id];
    const take = Math.min(need, s.reserves[id]);
    set({
      reloading: false,
      reloadEndsAt: 0,
      ammoInMag: { ...s.ammoInMag, [id]: s.ammoInMag[id] + take },
      reserves: { ...s.reserves, [id]: s.reserves[id] - take },
    });
  },

  consumeAmmo: (n = 1) => {
    const s = get();
    const id = s.currentWeapon;
    if (s.reloading) return false;
    if (s.ammoInMag[id] < n) {
      get().startReload();
      return false;
    }
    set({ ammoInMag: { ...s.ammoInMag, [id]: s.ammoInMag[id] - n } });
    return true;
  },
}));
