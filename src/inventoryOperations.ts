import type { CoreStatKey } from "./flow";
import type { PlayerInventory } from "./inventory";

/**
 * 修改本局金币。
 * 返回新库存，不修改传入对象。
 */
export function changeInventoryGold(
  inventory: PlayerInventory,
  amount: number,
): PlayerInventory {
  return {
    ...inventory,
    gold: Math.max(0, inventory.gold + amount),
  };
}

/**
 * 同时修改多个本局属性。
 *
 * 保留现有规则：
 * - 每个属性变化最低为 -99。
 * - 按输入顺序逐项应用。
 * - 不修改传入库存及其属性对象。
 */
export function changeInventoryStats(
  inventory: PlayerInventory,
  stats: readonly CoreStatKey[],
  amount: number,
): PlayerInventory {
  const statBonuses = { ...inventory.statBonuses };

  for (const stat of stats) {
    statBonuses[stat] = Math.max(
      -99,
      statBonuses[stat] + amount,
    );
  }

  return {
    ...inventory,
    statBonuses,
  };
}

/**
 * 单属性操作复用多属性规则，避免分别维护计算。
 */
export function changeInventoryStat(
  inventory: PlayerInventory,
  stat: CoreStatKey,
  amount: number,
): PlayerInventory {
  return changeInventoryStats(inventory, [stat], amount);
}