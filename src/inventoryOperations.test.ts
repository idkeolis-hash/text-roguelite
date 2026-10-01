import { describe, expect, it } from "vitest";
import { PROTAGONISTS } from "./content";
import { createStartingInventory } from "./inventory";
import {
  changeInventoryGold,
  changeInventoryStat,
  changeInventoryStats,
} from "./inventoryOperations";

describe("库存基础操作", () => {
  it("金币不小于零，并且不修改原对象", () => {
    const original = createStartingInventory(PROTAGONISTS[0]);
    const originalGold = original.gold;

    const next = changeInventoryGold(original, -10000);

    expect(next.gold).toBe(0);
    expect(original.gold).toBe(originalGold);
    expect(next).not.toBe(original);
  });

  it("属性变化不低于现有下限 -99", () => {
    const original = createStartingInventory(PROTAGONISTS[0]);
    const next = changeInventoryStat(original, "strength", -1000);

    expect(next.statBonuses.strength).toBe(-99);
    expect(original.statBonuses.strength).toBe(0);
    expect(next.statBonuses).not.toBe(original.statBonuses);
  });

  it("多个属性按输入顺序逐项应用", () => {
    const original = createStartingInventory(PROTAGONISTS[0]);
    const next = changeInventoryStats(
      original,
      ["strength", "agility", "strength"],
      1,
    );

    expect(next.statBonuses.strength).toBe(2);
    expect(next.statBonuses.agility).toBe(1);
    expect(original.statBonuses.strength).toBe(0);
  });
});