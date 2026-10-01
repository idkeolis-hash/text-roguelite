import {
  getCompendiumEntries,
  getCompendiumEntryById,
  type CompendiumKind,
} from "./compendium";
import { getCombatantDefinition } from "./combatants";
import { PROTAGONISTS } from "./content";
import {
  createReward,
  createShopSlots,
  type FlowRewardKind,
} from "./flow";
import { createStartingInventory } from "./inventory";

const COMPENDIUM_KINDS: readonly CompendiumKind[] = [
  "weapon",
  "relic",
  "item",
  "companion",
  "status",
];

const REWARD_KINDS: readonly FlowRewardKind[] = [
  "weapon",
  "relic",
  "item",
  "companion",
];

export function getContentIssues(): string[] {
  const issues: string[] = [];
  const seenIds = new Set<string>();

  function checkReference(
    id: string,
    kind: CompendiumKind,
    source: string,
  ) {
    const entry = getCompendiumEntryById(id);

    if (!entry || entry.kind !== kind) {
      issues.push(`${source}引用了不存在或类型错误的${kind}：${id}`);
    }
  }

  for (const kind of COMPENDIUM_KINDS) {
    for (const entry of getCompendiumEntries(kind)) {
      if (!entry.id.trim()) {
        issues.push(`${kind}存在空 ID`);
      }

      if (seenIds.has(entry.id)) {
        issues.push(`图鉴 ID 重复：${entry.id}`);
      }

      seenIds.add(entry.id);

      if (entry.kind !== kind) {
        issues.push(`图鉴分类错误：${entry.id}`);
      }

      if (
        entry.kind === "companion" &&
        !getCombatantDefinition(entry.combatantRoleId)
      ) {
        issues.push(
          `同伴 ${entry.id} 的战斗定义不存在：${entry.combatantRoleId}`,
        );
      }
    }
  }

  const protagonistIds = new Set<string>();

  for (const protagonist of PROTAGONISTS) {
    if (protagonistIds.has(protagonist.id)) {
      issues.push(`主控 ID 重复：${protagonist.id}`);
    }

    protagonistIds.add(protagonist.id);

    const inventory = createStartingInventory(protagonist);
    const source = `主控 ${protagonist.id} 的初始库存`;

    for (const id of inventory.ownedWeaponIds) {
      checkReference(id, "weapon", source);
    }

    for (const id of inventory.ownedItemIds) {
      checkReference(id, "item", source);
    }

    for (const id of inventory.ownedRelicIds) {
      checkReference(id, "relic", source);
    }

    for (const id of inventory.ownedCompanionIds) {
      checkReference(id, "companion", source);
    }

    if (!inventory.ownedWeaponIds.includes(inventory.equippedWeaponId)) {
      issues.push(`${source}装备了未拥有的武器`);
    }

    if (
      inventory.equippedItemId &&
      !inventory.ownedItemIds.includes(inventory.equippedItemId)
    ) {
      issues.push(`${source}装备了未拥有的道具`);
    }

    for (const id of inventory.companionSlots) {
      if (id !== null && !inventory.ownedCompanionIds.includes(id)) {
        issues.push(`${source}上阵了未拥有的同伴：${id}`);
      }
    }

    for (const [name, value] of Object.entries(protagonist.stats)) {
      if (!Number.isFinite(value)) {
        issues.push(`主控 ${protagonist.id} 的属性 ${name} 不是有限数值`);
      }
    }
  }

  for (const kind of REWARD_KINDS) {
    const reward = createReward(kind);
    checkReference(reward.id, kind, `默认${kind}奖励`);
  }

  for (const slot of createShopSlots()) {
    checkReference(slot.reward.id, slot.reward.kind, `商店 ${slot.id}`);

    if (!Number.isFinite(slot.price) || slot.price < 0) {
      issues.push(`商店 ${slot.id} 的价格不合法`);
    }
  }

  return issues;
}