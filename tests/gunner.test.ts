import { describe, expect, it } from "vitest";
import { createState } from "../src/game/state";
import { canFreezeForAim } from "../src/game/pause";
import { GUNNER_WEAPON_ORDER, gunnerWeaponAt } from "../src/data/gunnerWeapons";
import {
  currentGunnerWeapon,
  gunnerMoveLocked,
  gunnerShouldFreezeSim,
  gunnerSwitchLocked,
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

  it("locks weapon switching while reloading", () => {
    const state = createState("gunner");
    // Fire the single-shot rocket — clip empties and reload starts immediately.
    __testFireWeapon(state, "rockets");
    expect(state.hero.gunnerReload ?? 0).toBeGreaterThan(0);
    expect(gunnerSwitchLocked(state.hero)).toBe(true);

    const idxBefore = state.hero.gunnerWeaponIndex;
    tickGunnerWeapons(state, { fireHeld: false, cycle: true, dt: 0.016 });
    expect(state.hero.gunnerWeaponIndex).toBe(idxBefore);
    expect(currentGunnerWeapon(state.hero).id).toBe("rockets");
  });

  it("locks switching during inter-shot weapon cooldown", () => {
    const state = createState("gunner");
    state.hero.gunnerWeaponIndex = GUNNER_WEAPON_ORDER.indexOf("ar");
    state.hero.gunnerAmmo = 30;
    state.hero.gunnerReload = 0;
    state.hero.gunnerWeaponCd = 0.1;
    state.hero.gunnerSwapCd = 0;
    expect(gunnerSwitchLocked(state.hero)).toBe(true);
    tickGunnerWeapons(state, { fireHeld: false, cycle: true, dt: 0.001 });
    expect(currentGunnerWeapon(state.hero).id).toBe("ar");
  });

  it("allows switching again once the reload finishes", () => {
    const state = createState("gunner");
    __testFireWeapon(state, "rockets");
    // Run the reload down.
    for (let i = 0; i < 200 && (state.hero.gunnerReload ?? 0) > 0; i++) {
      tickGunnerWeapons(state, { fireHeld: false, cycle: false, dt: 0.1 });
    }
    expect(state.hero.gunnerReload ?? 0).toBe(0);
    expect(gunnerSwitchLocked(state.hero)).toBe(false);
    state.hero.gunnerSwapCd = 0;
    tickGunnerWeapons(state, { fireHeld: false, cycle: true, dt: 0.016 });
    expect(currentGunnerWeapon(state.hero).id).toBe("bolt_sniper");
  });

  it("has the rebalanced reload table (LMG very long, rockets long)", () => {
    expect(gunnerWeaponAt(GUNNER_WEAPON_ORDER.indexOf("lmg")).reload).toBeGreaterThanOrEqual(9);
    expect(gunnerWeaponAt(GUNNER_WEAPON_ORDER.indexOf("rockets")).reload).toBeGreaterThanOrEqual(5);
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
