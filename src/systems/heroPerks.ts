/**
 * Aggregate and apply hero-specific level-up perks.
 * Shared by SP (`state.ts`) and mpSim via bag-swapped `levelPassives`.
 */
import type { HeroId } from "../data/heroes";
import {
  HERO_PERKS,
  isHeroPerkId,
  type HeroPerkDef,
  type PerkEffects,
} from "../data/heroPerks";
import type { GunnerWeaponId } from "../data/gunnerWeapons";
import type { LevelPassiveId } from "../data/xp";
import type { GameState } from "../game/state";

export type AggregatedPerks = {
  damageMul: number;
  attackCdMul: number;
  moveSpeedFlat: number;
  maxHpFlat: number;
  mobilityCdMul: number;
  ultimateCdMul: number;
  abilityDamageMul: number;
  abilityAreaMul: number;
  passiveMul: number;
  mineDamageMul: number;
  mineArmMul: number;
  momentumGainMul: number;
  momentumCapBonus: number;
  guns: Partial<
    Record<
      GunnerWeaponId,
      { damageMul: number; clipBonus: number; reloadMul: number; cdMul: number }
    >
  >;
};

const EMPTY: AggregatedPerks = {
  damageMul: 1,
  attackCdMul: 1,
  moveSpeedFlat: 0,
  maxHpFlat: 0,
  mobilityCdMul: 1,
  ultimateCdMul: 1,
  abilityDamageMul: 1,
  abilityAreaMul: 1,
  passiveMul: 1,
  mineDamageMul: 1,
  mineArmMul: 1,
  momentumGainMul: 1,
  momentumCapBonus: 0,
  guns: {},
};

function mulIn(effects: PerkEffects, key: keyof PerkEffects, acc: number): number {
  const v = effects[key];
  return typeof v === "number" ? acc * v : acc;
}

/** Content-keyed cache — arrays are mutated in place when picking drafts. */
const cache = new Map<string, AggregatedPerks>();

function cacheKey(levelPassives: readonly LevelPassiveId[], heroId: HeroId): string {
  return `${heroId}|${levelPassives.join(",")}`;
}

export function aggregateHeroPerks(
  levelPassives: readonly LevelPassiveId[],
  heroId: HeroId,
): AggregatedPerks {
  const key = cacheKey(levelPassives, heroId);
  const hit = cache.get(key);
  if (hit) return hit;

  const out: AggregatedPerks = {
    ...EMPTY,
    guns: {},
  };

  for (const id of levelPassives) {
    if (!isHeroPerkId(id)) continue;
    const def = HERO_PERKS[id];
    if (!def || def.heroId !== heroId) continue;
    const e = def.effects;
    out.damageMul = mulIn(e, "damageMul", out.damageMul);
    out.attackCdMul = mulIn(e, "attackCdMul", out.attackCdMul);
    out.mobilityCdMul = mulIn(e, "mobilityCdMul", out.mobilityCdMul);
    out.ultimateCdMul = mulIn(e, "ultimateCdMul", out.ultimateCdMul);
    out.abilityDamageMul = mulIn(e, "abilityDamageMul", out.abilityDamageMul);
    out.abilityAreaMul = mulIn(e, "abilityAreaMul", out.abilityAreaMul);
    out.passiveMul = mulIn(e, "passiveMul", out.passiveMul);
    out.mineDamageMul = mulIn(e, "mineDamageMul", out.mineDamageMul);
    out.mineArmMul = mulIn(e, "mineArmMul", out.mineArmMul);
    out.momentumGainMul = mulIn(e, "momentumGainMul", out.momentumGainMul);
    out.moveSpeedFlat += e.moveSpeedFlat ?? 0;
    out.maxHpFlat += e.maxHpFlat ?? 0;
    out.momentumCapBonus += e.momentumCapBonus ?? 0;

    if (e.gun) {
      const g = out.guns[e.gun] ?? {
        damageMul: 1,
        clipBonus: 0,
        reloadMul: 1,
        cdMul: 1,
      };
      g.damageMul *= e.gunDamageMul ?? 1;
      g.clipBonus += e.gunClipBonus ?? 0;
      g.reloadMul *= e.gunReloadMul ?? 1;
      g.cdMul *= e.gunCdMul ?? 1;
      // Drum Mag also buffs BR / shotgun lightly
      out.guns[e.gun] = g;
      if (e.gun === "ar") {
        for (const extra of ["br", "shotgun"] as GunnerWeaponId[]) {
          const x = out.guns[extra] ?? {
            damageMul: 1,
            clipBonus: 0,
            reloadMul: 1,
            cdMul: 1,
          };
          x.clipBonus += e.gunClipBonus ?? 0;
          x.reloadMul *= e.gunReloadMul ?? 1;
          out.guns[extra] = x;
        }
      }
      if (e.gun === "bolt_sniper") {
        const auto = out.guns.auto_sniper ?? {
          damageMul: 1,
          clipBonus: 0,
          reloadMul: 1,
          cdMul: 1,
        };
        auto.damageMul *= e.gunDamageMul ?? 1;
        out.guns.auto_sniper = auto;
      }
    }
  }

  cache.set(key, out);
  return out;
}

export function perksForState(state: GameState): AggregatedPerks {
  return aggregateHeroPerks(state.levelPassives, state.hero.heroId);
}

export function gunnerWeaponMods(
  state: GameState,
  weaponId: GunnerWeaponId,
): { damageMul: number; clipBonus: number; reloadMul: number; cdMul: number } {
  const g = perksForState(state).guns[weaponId];
  return {
    damageMul: g?.damageMul ?? 1,
    clipBonus: g?.clipBonus ?? 0,
    reloadMul: g?.reloadMul ?? 1,
    cdMul: g?.cdMul ?? 1,
  };
}

/** One-shot flat HP from newly chosen perk (damage mul etc. are live aggregates). */
export function applyHeroPerkOnChoose(state: GameState, def: HeroPerkDef): void {
  if (def.heroId !== state.hero.heroId) return;
  const flat = def.effects.maxHpFlat ?? 0;
  if (flat > 0) {
    state.hero.maxHp += flat;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + flat);
  }
  const spd = def.effects.moveSpeedFlat ?? 0;
  if (spd > 0) state.hero.speedBonus += spd;
}

export function perkEligibleForHero(perkId: string, heroId: HeroId): boolean {
  if (!isHeroPerkId(perkId)) return true; // base passives always ok
  return HERO_PERKS[perkId]?.heroId === heroId;
}
