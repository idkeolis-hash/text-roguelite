import { describe, expect, it } from "vitest";
import { PROTAGONISTS } from "./content";
import { createStartingInventory } from "./inventory";
import {
  acquireConfigurationLock,
  isConfigurationLocked,
} from "./configurationLock";
import {
  changeInventoryCompanionSlot,
  equipInventoryItem,
  equipInventoryWeapon,
} from "./inventoryConfiguration";

describe("配置锁", () => {
  it("多个锁必须全部释放才解锁，重复释放安全", () => {
    const releaseFirst = acquireConfigurationLock();
    const releaseSecond = acquireConfigurationLock();

    try {
      expect(isConfigurationLocked()).toBe(true);

      releaseFirst();
      expect(isConfigurationLocked()).toBe(true);

      releaseFirst();
      expect(isConfigurationLocked()).toBe(true);

      releaseSecond();
      expect(isConfigurationLocked()).toBe(false);
    } finally {
      releaseFirst();
      releaseSecond();
    }
  });

  it("锁定时不能通过操作函数修改配置", () => {
    const inventory = createStartingInventory(PROTAGONISTS[0]);

    expect(
      equipInventoryWeapon(inventory, "weapon-placeholder", true),
    ).toBe(inventory);

    expect(
      equipInventoryItem(inventory, "item-test-medicine", true),
    ).toBe(inventory);

    expect(
      changeInventoryCompanionSlot(inventory, 0, null, true),
    ).toBe(inventory);
  });

  it("不能装备未拥有的内容", () => {
    const inventory = createStartingInventory(PROTAGONISTS[0]);

    expect(
      equipInventoryWeapon(inventory, "missing-weapon", false),
    ).toBe(inventory);

    expect(
      equipInventoryItem(inventory, "missing-item", false),
    ).toBe(inventory);

    expect(
      changeInventoryCompanionSlot(
        inventory,
        0,
        "missing-companion",
        false,
      ),
    ).toBe(inventory);
  });

  it("拒绝非法同伴位置", () => {
    const inventory = createStartingInventory(PROTAGONISTS[0]);

    for (const index of [-1, 4, 0.5, Number.NaN]) {
      expect(
        changeInventoryCompanionSlot(inventory, index, null, false),
      ).toBe(inventory);
    }
  });

  it("卸下同伴不修改原来的位置数组", () => {
    const inventory = createStartingInventory(PROTAGONISTS[0]);
    const originalSlots = [...inventory.companionSlots];

    const next = changeInventoryCompanionSlot(
      inventory,
      0,
      null,
      false,
    );

    expect(next.companionSlots[0]).toBeNull();
    expect(inventory.companionSlots).toEqual(originalSlots);
  });
});