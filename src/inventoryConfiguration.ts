import {
  getCompanionById,
  getItemById,
  getWeaponById,
} from "./compendium";
import type { PlayerInventory } from "./inventory";

export function equipInventoryWeapon(
  inventory: PlayerInventory,
  weaponId: string,
  locked: boolean,
): PlayerInventory {
  if (
    locked ||
    !inventory.ownedWeaponIds.includes(weaponId) ||
    !getWeaponById(weaponId) ||
    inventory.equippedWeaponId === weaponId
  ) {
    return inventory;
  }

  return {
    ...inventory,
    equippedWeaponId: weaponId,
  };
}

export function equipInventoryItem(
  inventory: PlayerInventory,
  itemId: string,
  locked: boolean,
): PlayerInventory {
  if (
    locked ||
    !inventory.ownedItemIds.includes(itemId) ||
    !getItemById(itemId) ||
    inventory.equippedItemId === itemId
  ) {
    return inventory;
  }

  return {
    ...inventory,
    equippedItemId: itemId,
  };
}

export function changeInventoryCompanionSlot(
  inventory: PlayerInventory,
  slotIndex: number,
  companionId: string | null,
  locked: boolean,
): PlayerInventory {
  if (
    locked ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= inventory.companionSlots.length
  ) {
    return inventory;
  }

  if (
    companionId !== null &&
    (
      !inventory.ownedCompanionIds.includes(companionId) ||
      !getCompanionById(companionId)
    )
  ) {
    return inventory;
  }

  if (inventory.companionSlots[slotIndex] === companionId) {
    return inventory;
  }

  const companionSlots: PlayerInventory["companionSlots"] = [
    ...inventory.companionSlots,
  ];

  // 暂时保留现有定义 ID 上阵规则。
  // 同名多实例支持属于后续工作。
  if (companionId !== null) {
    for (let index = 0; index < companionSlots.length; index += 1) {
      if (companionSlots[index] === companionId) {
        companionSlots[index] = null;
      }
    }
  }

  companionSlots[slotIndex] = companionId;

  return {
    ...inventory,
    companionSlots,
  };
}