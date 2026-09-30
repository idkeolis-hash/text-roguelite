import type {
  BattleState,
  BattleUnit,
  PlayerActionId,
} from "./game";

import {
  addBuiltInStatus,
  addBurningStatuses,
  addStatus,
  getEffectiveBattleStat,
  getStatusByDefinition,
} from "./statuses";

/* ========================================================
   钩子事件
   ======================================================== */

export interface BattleStartedEvent {
  type: "battle-start";
}

export interface RoundStartedEvent {
  type: "round-start";

  /**
   * 当前是第几个战斗回合。
   * 第一回合为1。
   */
  roundNumber: number;
}

export interface RoundEndedEvent {
  type: "round-end";
  roundNumber: number;
}

export interface ActionStartedEvent {
  type: "action-start";
  actorId: string;
}

export interface ActionEndedEvent {
  type: "action-end";
  actorId: string;
}

export interface BeforeActionUsedEvent {
  type: "before-action-used";

  actorId: string;
  actionId: PlayerActionId;

  /**
   * 是否属于蓄能技能或蓄能爆发。
   */
  isChargedAction: boolean;

  /**
   * 钩子可以将其改为true，
   * 取消这次行动。
   */
  canceled: boolean;
}

export interface ActionUsedEvent {
  type: "action-used";
  actorId: string;
  actionId: PlayerActionId;

  /**
   * 钩子可以要求当前行动额外重复。
   *
   * 当前版本仅在玩家的蓄能爆发中实际读取此数值。
   */
  repeatCount: number;
}

export interface AttackHitEvent {
  type: "attack-hit";
  attackerId: string;
  defenderId: string;
  damage: number;
}

export interface AttackedByEnemyEvent {
  type: "attacked-by-enemy";
  attackerId: string;
  defenderId: string;
  damage: number;
}

export interface DamageTakenEvent {
  type: "damage-taken";
  sourceId: string | null;
  targetId: string;
  damage: number;
}

export interface ItemUsedEvent {
  type: "item-used";
  actorId: string;
  itemId: string;
}

export interface UnitDefeatedEvent {
  type: "unit-defeated";
  unitId: string;
  sourceId: string | null;
}

export interface DefeatedUnitEvent {
  type: "defeated-unit";
  attackerId: string;
  defeatedUnitId: string;
}

export interface HpRestoredEvent {
  type: "hp-restored";
  sourceId: string | null;
  targetId: string;
  amount: number;
}

export interface HealedOtherEvent {
  type: "healed-other";
  healerId: string;
  targetId: string;
  amount: number;
}

export type BattleHookEvent =
  | BattleStartedEvent
  | RoundStartedEvent
  | RoundEndedEvent
  | ActionStartedEvent
  | ActionEndedEvent
  | BeforeActionUsedEvent
  | ActionUsedEvent
  | AttackHitEvent
  | AttackedByEnemyEvent
  | DamageTakenEvent
  | ItemUsedEvent
  | UnitDefeatedEvent
  | DefeatedUnitEvent
  | HpRestoredEvent
  | HealedOtherEvent;

/* ========================================================
   钩子定义
   ======================================================== */

export interface BattleHookContext {
  state: BattleState;
  owner: BattleUnit;
  event: BattleHookEvent;

  getUnit: (
    unitId: string,
  ) => BattleUnit | undefined;

  getLivingAllies: () => BattleUnit[];
  getLivingEnemies: () => BattleUnit[];

  log: (message: string) => void;

  /**
   * 记录这个钩子在本场战斗中是否已经使用。
   *
   * 返回true：本次成功占用了次数，可以执行效果。
   * 返回false：此前已经使用过，不能再次执行。
   */
  consumeOnce: (usageName: string) => boolean;
}

export interface BattleHookDefinition {
  id: string;
  name: string;
  listenedEvents: BattleHookEvent["type"][];
  execute: (context: BattleHookContext) => void;
}

function resolveGuidedPinThreshold(
  context: BattleHookContext,
): void {
  const pin = getStatusByDefinition(
    context.owner,
    "guided-pin",
  );

  if (!pin) {
    return;
  }

  if (
    pin.stacks >= 3 &&
    pin.data.thresholdReached !== true
  ) {
    pin.data.thresholdReached = true;
    context.owner.actionPower += 1;
    context.owner.apLeft += 1;
    context.owner.maxCharge = Math.max(
      2,
      context.owner.maxCharge - 2,
    );
    context.owner.charge = Math.min(
      context.owner.charge,
      context.owner.maxCharge,
    );
    context.log(
      `${context.owner.name}首次达到3层引路针，每回合行动次数+1，蓄能上限减少2。`,
    );
  }

  if (
    pin.data.thresholdReached === true &&
    pin.stacks >= 4
  ) {
    pin.stacks = 1;
    addBuiltInStatus(
      context.state,
      context.owner.id,
      "rebirth",
      { value: 50, percent: true },
    );
    context.log(
      `${context.owner.name}的引路针达到4层，重置为1层并获得重生50。`,
    );
  }
}

export const BATTLE_HOOKS: Record<
  string,
  BattleHookDefinition
> = {
  "miracle-compass-battle-start": {
    id: "miracle-compass-battle-start",
    name: "奇迹的引路针：战斗开始",
    listenedEvents: ["battle-start"],
    execute(context) {
      if (context.event.type !== "battle-start") return;
      context.owner.rebirthPolicy = {
        preserveDefinitionIds: ["guided-pin"],
      };
      addBuiltInStatus(context.state, context.owner.id, "rebirth", { value: 50, percent: true });
      addBuiltInStatus(context.state, context.owner.id, "guided-pin", { stacks: 1 });
    },
  },

  "miracle-compass-action-start": {
    id: "miracle-compass-action-start",
    name: "奇迹的引路针：盟友蓄能爆发",
    listenedEvents: ["action-used"],
    execute(context) {
      const pin = getStatusByDefinition(context.owner, "guided-pin");
      if (!pin) return;
      if (context.event.type === "action-used" && context.event.actionId === "burst" && context.event.actorId !== context.owner.id) {
        pin.stacks += 1;
        resolveGuidedPinThreshold(context);
      }
    },
  },

  "unripe-beast-ribbon-damage-taken": {
    id: "unripe-beast-ribbon-damage-taken",
    name: "青涩之兽的发带：受击蓄能",
    listenedEvents: ["damage-taken"],

    execute(context) {
      if (
        context.event.type !== "damage-taken" ||
        context.event.targetId !== context.owner.id ||
        context.owner.charge >= context.owner.maxCharge ||
        context.owner.hookUsage[
          "unripe-beast-ribbon-first-burst:first-burst"
        ]
      ) {
        return;
      }

      context.owner.charge += 1;
      context.log(`${context.owner.name}的青涩之兽发带使其受击蓄能+1。`);
    },
  },

  "unripe-beast-ribbon-first-burst": {
    id: "unripe-beast-ribbon-first-burst",
    name: "青涩之兽的发带：首次爆发",
    listenedEvents: ["action-used"],

    execute(context) {
      if (
        context.event.type !== "action-used" ||
        context.event.actorId !== context.owner.id ||
        context.event.actionId !== "burst" ||
        !context.consumeOnce("first-burst")
      ) {
        return;
      }

      addBurningStatuses(
        context.state,
        context.getLivingEnemies().map((enemy) => enemy.id),
        {
          value: getEffectiveBattleStat(context.owner, "attack") * 0.75,
          duration: 3,
          sourceId: context.owner.id,
        },
      );

      addBuiltInStatus(context.state, context.owner.id, "ailment-nullification", {
        stacks: 2,
      });
      context.log(`${context.owner.name}的青涩之兽发带唤起青焰。`);
    },
  },

  "resonant-prism-battle-start": {
    id: "resonant-prism-battle-start",
    name: "余响棱镜：初始共鸣",
    listenedEvents: ["battle-start"],

    execute(context) {
      if (context.event.type !== "battle-start") {
        return;
      }

      if (
        !context.consumeOnce(
          "initial-charge",
        )
      ) {
        return;
      }

      const previousCharge =
        context.owner.charge;

      context.owner.charge = Math.min(
        context.owner.maxCharge,
        context.owner.charge + 1,
      );

      const gainedCharge =
        context.owner.charge -
        previousCharge;

      context.log(
        `余响棱镜产生共鸣，${context.owner.name}在战斗开始时获得${gainedCharge}点蓄能。`,
      );
    },
  },

  "resonant-prism-repeat-burst": {
    id: "resonant-prism-repeat-burst",
    name: "余响棱镜：爆发复起",
    listenedEvents: ["action-used"],

    execute(context) {
      if (
        context.event.type !==
        "action-used"
      ) {
        return;
      }

      if (
        context.event.actorId !==
          context.owner.id ||
        context.event.actionId !== "burst"
      ) {
        return;
      }

      if (
        !context.consumeOnce(
          "repeat-burst",
        )
      ) {
        return;
      }

      context.event.repeatCount += 1;

      context.log(
        `余响棱镜记录了${context.owner.name}的蓄能爆发。相同的力量正在再次显现。`,
      );
    },
  },
  "hero-armament-battle-start": {
    id: "hero-armament-battle-start",
    name: "勇者武装：状态初始化",
    listenedEvents: ["battle-start"],

    execute(context) {
      if (
        context.event.type !==
        "battle-start"
      ) {
        return;
      }

      if (
        !context.consumeOnce(
          "create-armament-statuses",
        )
      ) {
        return;
      }

      const definitions = [
        {
          definitionId:
            "hero-armament-attack",
          name: "勇者武装·攻击",
          icon: "攻",
          stat: "attack" as const,
        },
        {
          definitionId:
            "hero-armament-defense",
          name: "勇者武装·防御",
          icon: "防",
          stat: "defense" as const,
        },
        {
          definitionId:
            "hero-armament-speed",
          name: "勇者武装·速度",
          icon: "速",
          stat: "speed" as const,
        },
      ];

      for (const definition of definitions) {
        addStatus(
          context.state,
          context.owner.id,
          {
            definitionId:
              definition.definitionId,

            name: definition.name,
            icon: definition.icon,
            tag: "正面",
            duration: -1,

            description:
              "由勇者武装提供。每次自身行动开始时提高10%，最高提高200%。",

            percentModifiers: {
              [definition.stat]: 0,
            },
          },
        );
      }

      context.log(
        `${context.owner.name}的勇者武装开始记录战斗动作。`,
      );
    },
  },

  "hero-armament-action-start": {
    id: "hero-armament-action-start",
    name: "勇者武装：持续适应",
    listenedEvents: ["action-start"],

    execute(context) {
      if (
        context.event.type !==
          "action-start" ||
        context.event.actorId !==
          context.owner.id
      ) {
        return;
      }

      const definitions = [
        {
          id:
            "hero-armament-attack",
          stat: "attack" as const,
        },
        {
          id:
            "hero-armament-defense",
          stat: "defense" as const,
        },
        {
          id:
            "hero-armament-speed",
          stat: "speed" as const,
        },
      ];

      for (const definition of definitions) {
        const status =
          getStatusByDefinition(
            context.owner,
            definition.id,
          );

        if (!status) {
          continue;
        }

        const previous =
          status.percentModifiers[
            definition.stat
          ] ?? 0;

        const next = Math.min(
          2,
          Math.round(
            (previous + 0.1) *
              1000,
          ) / 1000,
        );

        status.percentModifiers[
          definition.stat
        ] = next;

        status.description =
          `由勇者武装提供。当前提高${Math.round(next * 100)}%，每次自身行动开始时提高10%，最高提高200%。`;
      }

      context.log(
        `${context.owner.name}的勇者武装令攻击、防御和速度各提高10%。`,
      );
    },
  },

  "riding-the-wind-action-end": {
    id: "riding-the-wind-action-end",
    name: "乘风：行动结束强化",
    listenedEvents: ["action-end"],

    execute(context) {
      if (
        context.event.type !==
          "action-end" ||
        context.event.actorId !==
          context.owner.id
      ) {
        return;
      }

      const currentSpeed =
        getEffectiveBattleStat(
          context.owner,
          "speed",
        );

      /*
       * 状态只修正实际属性，不直接修改BattleUnit.speed，
       * 因此这里的speed就是战斗开始时记录的速度。
       */
      const battleStartSpeed = Math.max(
        1,
        context.owner.speed,
      );

      /*
       * 公式：
       * 四舍五入（(当前速度 / 战斗开始时速度) × 10%)
       */
      const roundedRatio = Math.round(
        (currentSpeed / battleStartSpeed) * 10,
      );

      const roundedValue =
        roundedRatio;

      const bonusPercent =
        roundedRatio * 0.01;

      if (bonusPercent <= 0) {
        return;
      }

      addStatus(
        context.state,
        context.owner.id,
        {
          definitionId:
            "riding-the-wind-speed",

          name: "乘风·速度",
          icon: "速",
          tag: "正面",
          stacking: "independent",
          duration: 3,

          description:
            `由乘风产生。速度提高${roundedValue}%，持续3回合。`,

          percentModifiers: {
            speed: bonusPercent,
          },
        },
      );

      addStatus(
        context.state,
        context.owner.id,
        {
          definitionId:
            "riding-the-wind-attack",

          name: "乘风·攻击",
          icon: "攻",
          tag: "正面",
          stacking: "independent",
          duration: 3,

          description:
            `由乘风产生。攻击力提高${roundedValue}%，持续3回合。`,

          percentModifiers: {
            attack: bonusPercent,
          },
        },
      );

      context.log(
        `${context.owner.name}乘风而行，速度和攻击力提高${roundedValue}%，持续3回合。`,
      );
    },
  },

  "draw-sword-intercept": {
    id: "draw-sword-intercept",
    name: "拔剑：打断蓄能行动",
    listenedEvents: [
      "before-action-used",
    ],

    execute(context) {
      if (
        context.event.type !==
        "before-action-used"
      ) {
        return;
      }

      const drawSword =
        getStatusByDefinition(
          context.owner,
          "draw-sword",
        );

      if (!drawSword) {
        return;
      }

      const cooldown =
        Number(
          drawSword.data
            .cooldownActions ?? 0,
        );

      if (cooldown > 0) {
        return;
      }

      const actor =
        context.getUnit(
          context.event.actorId,
        );

      if (
        !actor ||
        !actor.alive ||
        actor.side ===
          context.owner.side ||
        !context.event
          .isChargedAction
      ) {
        return;
      }

      context.event.canceled = true;

      /*
       * 直接增加本回合剩余行动次数。
       */
      context.owner.apLeft += 1;

      drawSword.data.cooldownActions =
        7;

      context.log(
        `${context.owner.name}发动拔剑，取消了${actor.name}的蓄能行动，并获得1次额外行动。拔剑进入7次行动的冷却。`,
      );
    },
  },

  "draw-sword-cooldown": {
    id: "draw-sword-cooldown",
    name: "拔剑：行动冷却",
    listenedEvents: ["action-end"],

    execute(context) {
      if (
        context.event.type !==
          "action-end" ||
        context.event.actorId !==
          context.owner.id
      ) {
        return;
      }

      const drawSword =
        getStatusByDefinition(
          context.owner,
          "draw-sword",
        );

      if (!drawSword) {
        return;
      }

      const previousCooldown =
        Number(
          drawSword.data
            .cooldownActions ?? 0,
        );

      if (previousCooldown <= 0) {
        return;
      }

      const nextCooldown =
        Math.max(
          0,
          previousCooldown - 1,
        );

      drawSword.data.cooldownActions =
        nextCooldown;

      if (nextCooldown === 0) {
        context.log(
          `${context.owner.name}的拔剑已经完成冷却。`,
        );
      }
    },
  },
};

/* ========================================================
   执行钩子
   ======================================================== */

export function emitBattleEvent<
  TEvent extends BattleHookEvent,
>(
  state: BattleState,
  event: TEvent,
): TEvent {
  /*
   * 复制角色列表和钩子列表。
   *
   * 这样即使钩子执行期间改变了角色状态，
   * 本轮钩子遍历也不会被破坏。
   */
  const owners = [...state.units];

  for (const owner of owners) {
    const hookIds = Array.from(
      new Set([
        ...(owner.hookIds ?? []),

        ...(
          owner.statuses ?? []
        ).flatMap(
          (status) =>
            status.hookIds ?? [],
        ),
      ]),
    );

    for (const hookId of hookIds) {
      const hook = BATTLE_HOOKS[hookId];

      if (!hook) {
        state.logs.push(
          `钩子错误：没有找到ID为“${hookId}”的钩子定义。`,
        );

        continue;
      }

      if (
        !hook.listenedEvents.includes(
          event.type,
        )
      ) {
        continue;
      }

      const context: BattleHookContext = {
        state,
        owner,
        event,

        getUnit(unitId) {
          return state.units.find(
            (unit) => unit.id === unitId,
          );
        },

        getLivingAllies() {
          return state.units.filter(
            (unit) =>
              unit.alive &&
              unit.side === owner.side,
          );
        },

        getLivingEnemies() {
          return state.units.filter(
            (unit) =>
              unit.alive &&
              unit.side !== owner.side,
          );
        },

        log(message) {
          state.logs.push(message);

          if (state.logs.length > 100) {
            state.logs =
              state.logs.slice(-100);
          }
        },

        consumeOnce(usageName) {
          const usageKey =
            `${hook.id}:${usageName}`;

          const previousUses =
            owner.hookUsage[usageKey] ?? 0;

          if (previousUses >= 1) {
            return false;
          }

          owner.hookUsage[usageKey] =
            previousUses + 1;

          return true;
        },
      };

      hook.execute(context);
    }
  }

  return event;
}

/* ========================================================
   战场监测函数
   ======================================================== */

export type ComparableBattleStat =
  | "attack"
  | "defense"
  | "speed";

export function getHpRatio(
  unit: BattleUnit,
): number {
  if (unit.maxHp <= 0) {
    return 0;
  }

  return unit.hp / unit.maxHp;
}

export function isHpBelowPercent(
  unit: BattleUnit,
  percent: number,
): boolean {
  return getHpRatio(unit) <
    percent / 100;
}

export function isHpAtOrBelowPercent(
  unit: BattleUnit,
  percent: number,
): boolean {
  return getHpRatio(unit) <=
    percent / 100;
}

export function isHpAbovePercent(
  unit: BattleUnit,
  percent: number,
): boolean {
  return getHpRatio(unit) >
    percent / 100;
}

export function isHpAtOrAbovePercent(
  unit: BattleUnit,
  percent: number,
): boolean {
  return getHpRatio(unit) >=
    percent / 100;
}

function getComparableUnits(
  state: BattleState,
  includeDefeated: boolean,
) {
  if (includeDefeated) {
    return state.units;
  }

  return state.units.filter(
    (unit) => unit.alive,
  );
}

/**
 * 并列最高也返回true。
 */
export function isStatHighest(
  state: BattleState,
  unitId: string,
  stat: ComparableBattleStat,
  includeDefeated = false,
): boolean {
  const unit = state.units.find(
    (candidate) =>
      candidate.id === unitId,
  );

  if (!unit) {
    return false;
  }

  const comparedUnits =
    getComparableUnits(
      state,
      includeDefeated,
    );

  if (comparedUnits.length === 0) {
    return false;
  }

  const highestValue = Math.max(
    ...comparedUnits.map(
      (candidate) => candidate[stat],
    ),
  );

  return unit[stat] === highestValue;
}

/**
 * 并列最低也返回true。
 */
export function isStatLowest(
  state: BattleState,
  unitId: string,
  stat: ComparableBattleStat,
  includeDefeated = false,
): boolean {
  const unit = state.units.find(
    (candidate) =>
      candidate.id === unitId,
  );

  if (!unit) {
    return false;
  }

  const comparedUnits =
    getComparableUnits(
      state,
      includeDefeated,
    );

  if (comparedUnits.length === 0) {
    return false;
  }

  const lowestValue = Math.min(
    ...comparedUnits.map(
      (candidate) => candidate[stat],
    ),
  );

  return unit[stat] === lowestValue;
}

export function countLivingEnemies(
  state: BattleState,
  ownerId: string,
): number {
  const owner = state.units.find(
    (unit) => unit.id === ownerId,
  );

  if (!owner) {
    return 0;
  }

  return state.units.filter(
    (unit) =>
      unit.alive &&
      unit.side !== owner.side,
  ).length;
}

export function countLivingAllies(
  state: BattleState,
  ownerId: string,
  includeSelf = true,
): number {
  const owner = state.units.find(
    (unit) => unit.id === ownerId,
  );

  if (!owner) {
    return 0;
  }

  return state.units.filter(
    (unit) =>
      unit.alive &&
      unit.side === owner.side &&
      (includeSelf ||
        unit.id !== owner.id),
  ).length;
}