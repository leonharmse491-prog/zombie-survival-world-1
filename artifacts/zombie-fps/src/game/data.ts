export type WeaponId =
  | "pistol"
  | "smg"
  | "shotgun"
  | "rifle"
  | "sniper"
  | "lmg"
  | "grenade"
  | "flamethrower";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  cost: number;
  unlockMission: number;
  damage: number;
  fireRate: number; // shots per second
  magSize: number;
  reloadTime: number; // seconds
  range: number;
  spread: number; // radians half-angle
  pellets: number;
  recoil: number;
  color: string;
  desc: string;
  splash?: number; // splash radius
  burn?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: "pistol", name: "M9 Pistol", cost: 0, unlockMission: 0,
    damage: 22, fireRate: 4, magSize: 12, reloadTime: 1.2,
    range: 60, spread: 0.012, pellets: 1, recoil: 0.6,
    color: "#888", desc: "Reliable sidearm. Always with you.",
  },
  smg: {
    id: "smg", name: "MP5 SMG", cost: 800, unlockMission: 1,
    damage: 14, fireRate: 12, magSize: 30, reloadTime: 1.6,
    range: 50, spread: 0.04, pellets: 1, recoil: 0.4,
    color: "#3a3a3a", desc: "High fire rate, low damage. Crowd control.",
  },
  shotgun: {
    id: "shotgun", name: "M870 Shotgun", cost: 1500, unlockMission: 2,
    damage: 16, fireRate: 1.4, magSize: 6, reloadTime: 2.2,
    range: 22, spread: 0.16, pellets: 8, recoil: 1.4,
    color: "#5b3a1a", desc: "Devastating up close. Eight pellets per blast.",
  },
  rifle: {
    id: "rifle", name: "M4 Rifle", cost: 2400, unlockMission: 3,
    damage: 32, fireRate: 7, magSize: 30, reloadTime: 2.0,
    range: 90, spread: 0.018, pellets: 1, recoil: 0.7,
    color: "#2b3a1a", desc: "All-purpose carbine. Balanced damage and accuracy.",
  },
  sniper: {
    id: "sniper", name: "AWP Sniper", cost: 3800, unlockMission: 4,
    damage: 220, fireRate: 0.9, magSize: 5, reloadTime: 2.8,
    range: 220, spread: 0.001, pellets: 1, recoil: 2.2,
    color: "#1a1a2a", desc: "One-shot lethal. Hold RMB to scope.",
  },
  lmg: {
    id: "lmg", name: "M249 LMG", cost: 5500, unlockMission: 5,
    damage: 26, fireRate: 14, magSize: 100, reloadTime: 4.5,
    range: 80, spread: 0.05, pellets: 1, recoil: 0.9,
    color: "#222", desc: "Massive belt-fed firepower. Slow reload.",
  },
  grenade: {
    id: "grenade", name: "M79 Launcher", cost: 7000, unlockMission: 6,
    damage: 90, fireRate: 0.7, magSize: 1, reloadTime: 2.5,
    range: 70, spread: 0.0, pellets: 1, recoil: 1.6,
    color: "#3a2a14", desc: "Explosive rounds. Splash damage radius 5m.",
    splash: 5,
  },
  flamethrower: {
    id: "flamethrower", name: "X-15 Flamethrower", cost: 9000, unlockMission: 7,
    damage: 11, fireRate: 18, magSize: 200, reloadTime: 3.5,
    range: 14, spread: 0.10, pellets: 1, recoil: 0.2,
    color: "#5a1a1a", desc: "Wall of fire. Burns enemies over time.",
    burn: true,
  },
};

export const WEAPON_ORDER: WeaponId[] = [
  "pistol", "smg", "shotgun", "rifle", "sniper", "lmg", "grenade", "flamethrower",
];

export interface UpgradeDef {
  id: string;
  name: string;
  cost: number;
  desc: string;
  apply: (s: PlayerStats) => PlayerStats;
}

export interface PlayerStats {
  maxHealth: number;
  sprintSpeed: number;
  walkSpeed: number;
  damageMult: number;
  reloadMult: number;
  ammoMult: number;
  armor: number;
  cashMult: number;
}

export const BASE_STATS: PlayerStats = {
  maxHealth: 100,
  sprintSpeed: 9,
  walkSpeed: 5,
  damageMult: 1,
  reloadMult: 1,
  ammoMult: 1,
  armor: 0,
  cashMult: 1,
};

export const UPGRADES: UpgradeDef[] = [
  { id: "hp1", name: "Body Armor I", cost: 600, desc: "+25 max HP",
    apply: (s) => ({ ...s, maxHealth: s.maxHealth + 25 }) },
  { id: "hp2", name: "Body Armor II", cost: 1400, desc: "+25 max HP",
    apply: (s) => ({ ...s, maxHealth: s.maxHealth + 25 }) },
  { id: "hp3", name: "Body Armor III", cost: 2800, desc: "+50 max HP",
    apply: (s) => ({ ...s, maxHealth: s.maxHealth + 50 }) },
  { id: "armor1", name: "Kevlar Plating", cost: 1800, desc: "Reduce damage 15%",
    apply: (s) => ({ ...s, armor: s.armor + 0.15 }) },
  { id: "armor2", name: "Combat Plating", cost: 3600, desc: "Reduce damage 15%",
    apply: (s) => ({ ...s, armor: s.armor + 0.15 }) },
  { id: "spd1", name: "Lightweight Boots", cost: 800, desc: "+1 walk / +2 sprint",
    apply: (s) => ({ ...s, walkSpeed: s.walkSpeed + 1, sprintSpeed: s.sprintSpeed + 2 }) },
  { id: "dmg1", name: "Hollow Points", cost: 1500, desc: "+15% weapon damage",
    apply: (s) => ({ ...s, damageMult: s.damageMult + 0.15 }) },
  { id: "dmg2", name: "AP Rounds", cost: 3200, desc: "+25% weapon damage",
    apply: (s) => ({ ...s, damageMult: s.damageMult + 0.25 }) },
  { id: "rld1", name: "Quick Hands", cost: 1200, desc: "−25% reload time",
    apply: (s) => ({ ...s, reloadMult: s.reloadMult * 0.75 }) },
  { id: "ammo1", name: "Extended Mags", cost: 1800, desc: "+50% mag size",
    apply: (s) => ({ ...s, ammoMult: s.ammoMult + 0.5 }) },
  { id: "cash1", name: "Scavenger", cost: 1500, desc: "+30% cash from kills",
    apply: (s) => ({ ...s, cashMult: s.cashMult + 0.3 }) },
];

export interface Mission {
  id: number;
  title: string;
  brief: string;
  story: string;
  objective: { kind: "kill" | "survive" | "boss"; count: number };
  zombieMult: number;
  reward: number;
  unlockWeapon?: WeaponId;
}

export const MISSIONS: Mission[] = [
  {
    id: 1,
    title: "Outbreak Day",
    brief: "Eliminate 8 walkers near the safehouse",
    story:
      "Day 1. The radio went dead three hours ago. They're slow, but they don't stop. You need to clear the perimeter before sundown.",
    objective: { kind: "kill", count: 8 },
    zombieMult: 1.0,
    reward: 600,
    unlockWeapon: "smg",
  },
  {
    id: 2,
    title: "Supply Run",
    brief: "Survive 60 seconds in the warehouse district",
    story:
      "There's medical supplies in the warehouse, but the noise will draw a swarm. Hold the line until the chopper marks the drop.",
    objective: { kind: "survive", count: 60 },
    zombieMult: 1.3,
    reward: 1000,
    unlockWeapon: "shotgun",
  },
  {
    id: 3,
    title: "The Horde",
    brief: "Kill 20 walkers as they pour in",
    story:
      "They followed the gunfire. A full horde is closing on the depot. No retreat — thin them out before they reach the survivors.",
    objective: { kind: "kill", count: 20 },
    zombieMult: 1.6,
    reward: 1600,
    unlockWeapon: "rifle",
  },
  {
    id: 4,
    title: "Hold the Bridge",
    brief: "Survive 90 seconds against runners",
    story:
      "A second strain is moving fast and angry. Hold the bridge so the convoy can cross. You won't get a second chance at this.",
    objective: { kind: "survive", count: 90 },
    zombieMult: 2.0,
    reward: 2200,
    unlockWeapon: "sniper",
  },
  {
    id: 5,
    title: "Slaughterhouse",
    brief: "Eliminate 35 infected",
    story:
      "Command wants the meatpacking plant cleared. There's something nesting in there. Drown it in lead.",
    objective: { kind: "kill", count: 35 },
    zombieMult: 2.4,
    reward: 3000,
    unlockWeapon: "lmg",
  },
  {
    id: 6,
    title: "Brute Force",
    brief: "Kill the Brute and 15 escorts",
    story:
      "Recon spotted a mutated host — twice the size, takes a magazine to drop. End it before it reaches the camp.",
    objective: { kind: "boss", count: 15 },
    zombieMult: 2.6,
    reward: 4000,
    unlockWeapon: "grenade",
  },
  {
    id: 7,
    title: "Burn It Down",
    brief: "Survive 120 seconds in the inferno",
    story:
      "The lab is the source. Burn it to the ground. They're going to throw everything they have at you.",
    objective: { kind: "survive", count: 120 },
    zombieMult: 3.0,
    reward: 5500,
    unlockWeapon: "flamethrower",
  },
  {
    id: 8,
    title: "Last Stand",
    brief: "Eliminate the Alpha and 25 infected",
    story:
      "The Alpha is the source intelligence — kill it and the swarm collapses. This is the end of the line. Make it count.",
    objective: { kind: "boss", count: 25 },
    zombieMult: 3.5,
    reward: 9000,
  },
];
