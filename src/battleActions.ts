import type { BattleState, BattleUnit } from "./game";
import { getCombatantDefinition } from "./combatants";
import { getItemById } from "./compendium";
import { checkActionRestriction } from "./statuses";
import { getWeaponActionDefinitions } from "./weaponActions";
import {
  defineAction,
  type ActionAvailability,
  type ActionSelection,
  type CombatActionDefinition,
  type CombatTargetSelector,
} from "./actionTypes";

export function resolveCombatTargets(
  state: BattleState,
  actor: BattleUnit,
  selection: ActionSelection,
  selector: CombatTargetSelector,
): BattleUnit[] {
  const living = state.units.filter((unit) => unit.alive);

  const allies = living
    .filter((unit) => unit.side === actor.side)
    .sort((left, right) => left.tieOrder - right.tieOrder);

  switch (selector.type) {
    case "self":
      return actor.alive ? [actor] : [];

    case "chosen-enemy":
      return living.filter(
        (unit) =>
          unit.id === selection.enemyId &&
          unit.side !== actor.side,
      );

    case "chosen-ally":
      return allies.filter(
        (unit) => unit.id === selection.allyId,
      );

    case "chosen-other-ally": {
      const selected = allies.find(
        (unit) => unit.id === selection.allyId,
      );

      if (selected && selected.id !== actor.id) {
        return [selected];
      }

      if (selected?.id === actor.id) {
        const fallback = allies.find(
          (unit) => unit.id !== actor.id,
        );
        return fallback ? [fallback] : [];
      }

      // 无效、已死亡或未选择的盟友不偷偷替换为另一名盟友。
      return [];
    }

    case "main-player":
      return living.filter(
        (unit) =>
          unit.role === "player" &&
          unit.side !== actor.side,
      );

    case "all-enemies":
      return living.filter(
        (unit) => unit.side !== actor.side,
      );

    case "all-allies":
      return allies;

    case "ally-role-or-self": {
      const ally = allies.find(
        (unit) => unit.role === selector.roleId,
      );
      return ally ? [ally] : actor.alive ? [actor] : [];
    }
  }
}

export function getUnitActionInfo(
  unit: BattleUnit,
  state?: BattleState,
): CombatActionDefinition[] {
  if (unit.role !== "player") {
    return getCombatantDefinition(unit.role)?.actions ?? [];
  }

  if (!state) {
    return [];
  }

  const weaponActions = getWeaponActionDefinitions(
    state.equippedWeaponId,
    String(unit.weaponState?.blueForm ?? "origin"),
    Number(unit.weaponState?.blueLevel ?? 1),
  );

  const item = getItemById(state.equippedItemId);

  const itemAction = defineAction("player", {
    id: item ? `${item.id}:use` : "player:item",
    category: "item",
    name: item?.actionName ?? "未装备道具",
    description:
      item?.actionDescription ?? "当前没有可以使用的道具。",
    effects:
      item?.battleEffect.type === "heal-self"
        ? [
            {
              type: "heal",
              target: { type: "self" },
              amount: item.battleEffect.amount,
            },
          ]
        : [],
  });

  const guardAction = defineAction("player", {
    id: "player:guard",
    category: "special",
    name: "特殊：防御",
    description: "降低下一次受到的伤害。",
    effects: [
      {
        type: "guard",
        target: { type: "self" },
      },
    ],
  });

  return [...weaponActions, itemAction, guardAction];
}

export function findUnitAction(
  state: BattleState,
  actor: BattleUnit,
  actionId: string,
): CombatActionDefinition | undefined {
  return getUnitActionInfo(actor, state).find(
    (action) =>
      action.id === actionId ||
      action.category === actionId,
  );
}

export function getActionAvailability(
  state: BattleState,
  actorId: string,
  actionId: string,
  selection: ActionSelection,
): ActionAvailability {
  const actor = state.units.find(
    (unit) => unit.id === actorId,
  );

  if (
    state.status !== "playing" ||
    !actor ||
    !actor.alive ||
    actor.apLeft <= 0 ||
    state.currentActorId !== actor.id
  ) {
    return {
      allowed: false,
      reason: "当前不是该单位的可行动时机。",
    };
  }

  const action = findUnitAction(state, actor, actionId);
  if (!action) {
    return {
      allowed: false,
      reason: `不存在行动：${actionId}`,
    };
  }

  const restriction = checkActionRestriction(
    actor,
    action.category,
  );

  if (!restriction.allowed) {
    return restriction;
  }

  if (
    action.requiresFullCharge &&
    actor.charge < actor.maxCharge
  ) {
    return {
      allowed: false,
      reason: `${actor.name}的蓄能槽尚未充满。`,
    };
  }

  if (
    typeof action.chargeCost === "number" &&
    actor.charge < action.chargeCost
  ) {
    return {
      allowed: false,
      reason: `${actor.name}的蓄能不足。`,
    };
  }

  for (const selector of action.targets) {
    const requiresSelection =
      selector.type === "chosen-enemy" ||
      selector.type === "chosen-ally";

    if (
      requiresSelection &&
      resolveCombatTargets(
        state,
        actor,
        selection,
        selector,
      ).length === 0
    ) {
      return {
        allowed: false,
        reason:
          selector.type === "chosen-enemy"
            ? "请先选择一名仍然存活的敌人。"
            : "请先选择一名仍然存活的盟友。",
      };
    }
  }

  // chosen-other-ally 允许该效果 miss，不取消整项行动。
  if (
    action.category === "item" &&
    (
      actor.role !== "player" ||
      !getItemById(state.equippedItemId) ||
      state.itemUsesLeft <= 0
    )
  ) {
    return {
      allowed: false,
      reason: "当前没有可以使用的战斗道具。",
    };
  }

  return { allowed: true };
}