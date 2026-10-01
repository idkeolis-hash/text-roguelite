import { describe, expect, it } from "vitest";
import {
  PROTAGONISTS,
  type ProtagonistDefinition,
} from "./content";
import { createStartingInventory } from "./inventory";
import {
  createPlaceholderBattle,
  createTutorialBattle,
  performPlayerAction,
} from "./game";
import { canRetryBattle } from "./battleLifecycle";

describe("战斗基础规则", () => {
  it("只有失败的教程战允许重试", () => {
    expect(canRetryBattle("tutorial", "lost")).toBe(true);
    expect(canRetryBattle("tutorial", "playing")).toBe(false);
    expect(canRetryBattle("tutorial", "won")).toBe(false);

    expect(canRetryBattle("standard", "lost")).toBe(false);
    expect(canRetryBattle("standard", "playing")).toBe(false);
    expect(canRetryBattle("standard", "won")).toBe(false);
  });

  it("创建战斗时我方全员满血", () => {
    const protagonist = PROTAGONISTS[0];
    const inventory = createStartingInventory(protagonist);

    const battles = [
      createTutorialBattle(protagonist, inventory),
      createPlaceholderBattle(
        protagonist,
        inventory,
        1,
        "strength",
      ),
    ];

    for (const battle of battles) {
      for (const unit of battle.units) {
        if (unit.side === "player") {
          expect(unit.hp).toBe(unit.maxHp);
          expect(unit.alive).toBe(true);
        }
      }
    }
  });

  it("高速单位能先完成第二动，但不能超出行动力", () => {
    const protagonist: ProtagonistDefinition = {
      ...PROTAGONISTS[0],
      stats: {
        ...PROTAGONISTS[0].stats,
        speed: 100000,
        actionPower: 2,
      },
    };

    const inventory = {
      ...createStartingInventory(protagonist),
      equippedWeaponId: "weapon-placeholder",
      ownedWeaponIds: ["weapon-placeholder"],
      ownedRelicIds: [],
      companionSlots: [null, null, null, null] as [
        null,
        null,
        null,
        null,
      ],
    };

    const initial = createPlaceholderBattle(
      protagonist,
      inventory,
      1,
      "strength",
    );

    expect(initial.currentActorId).toBe("player");

    const afterFirst = performPlayerAction(
      initial,
      "player",
      "charge",
      null,
    );

    expect(afterFirst.currentActorId).toBe("player");
    expect(
      afterFirst.units.find((unit) => unit.id === "player")?.apLeft,
    ).toBe(1);

    const afterSecond = performPlayerAction(
      afterFirst,
      "player",
      "charge",
      null,
    );

    expect(afterSecond.currentActorId).not.toBe("player");
    expect(
      afterSecond.units.find((unit) => unit.id === "player")?.apLeft,
    ).toBe(0);
    expect(afterSecond.roundNumber).toBe(initial.roundNumber);
  });
});