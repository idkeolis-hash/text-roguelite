import { getCompendiumEntryById } from "./compendium";
import type { FlowReward, FlowRewardKind } from "./flow";
import type { PlayerInventory } from "./inventory";
import { changeInventoryGold } from "./inventoryOperations";

type RewardInventoryKey =
  | "ownedWeaponIds"
  | "ownedRelicIds"
  | "ownedItemIds"
  | "ownedCompanionIds";

const REWARD_INVENTORY_KEYS: Record<
  FlowRewardKind,
  RewardInventoryKey
> = {
  weapon: "ownedWeaponIds",
  relic: "ownedRelicIds",
  item: "ownedItemIds",
  companion: "ownedCompanionIds",
};

function rewardExists(reward: FlowReward): boolean {
  const entry = getCompendiumEntryById(reward.id);
  return entry !== undefined && entry.kind === reward.kind;
}

export function grantInventoryReward(
  inventory: PlayerInventory,
  reward: FlowReward,
): PlayerInventory {
  if (!rewardExists(reward)) {
    return inventory;
  }

  const key = REWARD_INVENTORY_KEYS[reward.kind];
  const ownedIds = inventory[key];

  // 保留当前入库行为。
  // 这里不实现抽取排重，也不实现同伴实例。
  if (ownedIds.includes(reward.id)) {
    return inventory;
  }

  return {
    ...inventory,
    [key]: [...ownedIds, reward.id],
  };
}

export function buyInventoryReward(
  inventory: PlayerInventory,
  reward: FlowReward,
  price: number,
): PlayerInventory {
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    inventory.gold < price ||
    !rewardExists(reward)
  ) {
    return inventory;
  }

  const nextInventory = grantInventoryReward(inventory, reward);

  return changeInventoryGold(nextInventory, -price);
}