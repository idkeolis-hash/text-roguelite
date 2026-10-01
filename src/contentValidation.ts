import {
  getCompendiumEntries,
  getCompendiumEntryById,
  type CompendiumKind,
} from "./compendium";
import {
  COMBATANT_DEFINITIONS,
  getCombatantDefinition,
} from "./combatants";
import type { CombatActionDefinition } from "./actionTypes";
import { getWeaponActionDefinitions } from "./weaponActions";
import { hasSpecialActionHandler } from "./weaponActionEffects";
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

  const seenActionIds = new Set<string>();

  function checkActions(
    source: string,
    actions: CombatActionDefinition[],
  ): void {
    if (actions.length === 0) {
      issues.push(`${source}没有注册行动`);
    }

    for (const action of actions) {
      if (!action.id.trim()) {
        issues.push(`${source}存在空行动 ID`);
      }

      if (seenActionIds.has(action.id)) {
        issues.push(`行动 ID 重复：${action.id}`);
      }
      seenActionIds.add(action.id);

      if (!action.name.trim()) {
        issues.push(`行动缺少名称：${action.id}`);
      }

      if (
        action.special &&
        !hasSpecialActionHandler(action.special)
      ) {
        issues.push(
          `行动缺少特殊处理器：${action.id} -> ${action.special}`,
        );
      }

      for (const effect of action.effects) {
        const declared = action.targets.some(
          (target) =>
            JSON.stringify(target) === JSON.stringify(effect.target),
        );

        if (!declared) {
          issues.push(
            `行动效果目标未声明：${action.id}`,
          );
        }

        if (
          effect.type === "damage" &&
          (
            !Number.isFinite(effect.multiplier) ||
            effect.multiplier < 0 ||
            (
              effect.hits !== undefined &&
              (
                !Number.isInteger(effect.hits) ||
                effect.hits < 1
              )
            )
          )
        ) {
          issues.push(`行动伤害配置错误：${action.id}`);
        }
      }

      if (
        typeof action.chargeCost === "number" &&
        (
          !Number.isFinite(action.chargeCost) ||
          action.chargeCost < 0
        )
      ) {
        issues.push(`行动蓄能消耗配置错误：${action.id}`);
      }
    }
  }

  for (const definition of COMBATANT_DEFINITIONS) {
    checkActions(
      `战斗单位 ${definition.id}`,
      definition.actions,
    );

    const ids = new Set(
      definition.actions.map((action) => action.id),
    );

    for (const id of [
      ...(definition.ai?.normalPattern ?? []),
      ...(definition.ai?.fullChargePattern ?? []),
    ]) {
      if (!ids.has(id)) {
        issues.push(
          `战斗单位 ${definition.id} 的 AI 引用了不存在的行动：${id}`,
        );
      }
    }
  }

  for (const weapon of getCompendiumEntries("weapon")) {
    const origin = getWeaponActionDefinitions(
      weapon.id,
      "origin",
      1,
    );

    checkActions(`武器 ${weapon.id}`, origin);

    if (weapon.id === "weapon-blue-slayer") {
      // 蓄能不随形态改变；两种形态下只有特殊行动 ID 不同。
      const originIds = new Set(
        origin.map((action) => action.id),
      );

      checkActions(
        `武器 ${weapon.id} 残火形态`,
        getWeaponActionDefinitions(
          weapon.id,
          "residual",
          2,
        ).filter((action) => !originIds.has(action.id)),
      );
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