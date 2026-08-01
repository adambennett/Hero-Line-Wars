import { describe, expect, it } from "vitest";
import { createState } from "../src/game/state";
import { canFreezeForAim } from "../src/game/pause";
import { GUNNER_WEAPON_ORDER, gunnerWeaponAt } from "../src/data/gunnerWeapons";
import {
  currentGunnerWeapon,
  gunnerMoveLocked,
  gunnerShouldFreezeSim,
  tickGunnerWeapons,
  __testFireWeapon,
} from "../src/systems/gunner";

describe("Gunner weapon FSM", () => {
  it("starts on rockets with a full clip", () => {
    const state = createState("gunner");
    expect(state.hero.heroId).toBe("gunner");
    const w = currentGunnerWeapon(state.hero);
    expect(w.id).toBe("rockets");
    expect(state.hero.gunnerAmmo).toBe(w.clip);
  });

  it("cycles weapons on ultimate and resets ammo", () => {
    const state = createState("gunner");
    tickGunnerWeapons(state, { fireHeld: false, cycle: true, dt: 0.016 });
    expect(currentGunnerWeapon(state.hero).id).toBe("bolt_sniper");
    expect(state.hero.gunnerAmmo).toBe(gunnerWeaponAt(1).clip);
  });

  it("locks movement while sniper-aiming", () => {
    const state = createState("gunner");
    // Cycle to bolt sniper
    tickGunnerWeapons(state, { fireHeld: false, cycle: true, dt: 0.016 });
    expect(currentGunnerWeapon(state.hero).id).toBe("bolt_sniper");
    tickGunnerWeapons(state, { fireHeld: true, cycle: false, dt: 0.1 });
    expect(state.hero.gunnerAiming).toBe(true);
    expect(gunnerMoveLocked(state.hero)).toBe(true);
  });

  it("freezes sim only when canFreezeForAim allows", () => {
    const solo = createState("gunner");
    solo.humanPlayers = 1;
    tickGunnerWeapons(solo, { fireHeld: false, cycle: true, dt: 0.016 });
    tickGunnerWeapons(solo, { fireHeld: true, cycle: false, dt: 0.05 });
    expect(canFreezeForAim(solo)).toBe(true);
    expect(gunnerShouldFreezeSim(solo)).toBe(true);

    const multi = createState("gunner");
    multi.humanPlayers = 2;
    tickGunnerWeapons(multi, { fireHeld: false, cycle: true, dt: 0.016 });
    tickGunnerWeapons(multi, { fireHeld: true, cycle: false, dt: 0.05 });
    expect(canFreezeForAim(multi)).toBe(false);
    expect(gunnerShouldFreezeSim(multi)).toBe(false);
    expect(gunnerMoveLocked(multi.hero)).toBe(true);
  });

  it("laser deals self-damage with clear flash", () => {
    const state = createState("gunner");
    const idx = GUNNER_WEAPON_ORDER.indexOf("laser");
    state.hero.gunnerWeaponIndex = idx;
    state.hero.gunnerAmmo = 1;
    state.hero.gunnerReload = 0;
    state.hero.gunnerWeaponCd = 0;
    const hpBefore = state.hero.hp;
    __testFireWeapon(state, "laser");
    expect(state.hero.hp).toBeLessThan(hpBefore);
    expect(state.hero.gunnerSelfDamageFlash ?? 0).toBeGreaterThan(0);
    expect(state.beam).toBeTruthy();
  });

  it("LMG spin-up increases while held", () => {
    const state = createState("gunner");
    const idx = GUNNER_WEAPON_ORDER.indexOf("lmg");
    state.hero.gunnerWeaponIndex = idx;
    state.hero.gunnerAmmo = 100;
    state.hero.gunnerReload = 0;
    state.hero.gunnerWeaponCd = 0;
    state.hero.gunnerSpin = 0;
    tickGunnerWeapons(state, { fireHeld: true, cycle: false, dt: 0.5 });
    expect(state.hero.gunnerSpin ?? 0).toBeGreaterThan(0.2);
  });
});
