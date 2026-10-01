import type {
  ProtagonistDefinition,
} from "./content";

import { getCombatantDefinition } from "./combatants";

import type {
  ActionEffectContext,
  ActionSelection,
  CombatActionDefinition,
  CombatDamageType,
} from "./actionTypes";

import {
  findUnitAction,
  getActionAvailability,
  resolveCombatTargets,
} from "./battleActions";

import {
  executeSpecialAction,
  hasSpecialActionHandler,
} from "./weaponActionEffects";

export { getUnitActionInfo } from "./battleActions";
export { getActionAvailability } from "./battleActions";

import {
  getCompanionById,
  getItemById,
  getRelicHookIds,
  getWeaponById,
} from "./compendium";

import {
  emitBattleEvent,
} from "./hooks";
import {
  addBuiltInStatus,
  addBurningStatuses,
  basicChargeIsLocked,
  consumeImbalanceForCharge,
  consumeReprise,
  consumeStatusLayer,
  getEffectiveBattleStat,
  getStatusByDefinition,
  getStatusNumber,
  getStatusesByDefinition,
  hasStatus,
  notifyStatusDamageTaken,
  preventDefeatByStatus,
  preventDamageByStatus,
  resolveForcedAttackTarget,
  tickStatusDurations,
  type BattleStatusEffect,
  type RebirthStatusPolicy,
} from "./statuses";

import type {
  PlayerInventory,
} from "./inventory";

export type Side = "player" | "enemy";
export type DamageType =
  CombatDamageType;
export type BattleStatus = "playing" | "won" | "lost";

export type BattleKind =
  | "tutorial"
  | "standard";

/**
 * "player"保留给主控。
 *
 * 其他值都对应combatants.ts中的定义ID。
 */
export type UnitRole = string;

export type CoreActionId =
  | "basic"
  | "skill"
  | "charge"
  | "charged-skill"
  | "burst";

/**
 * 数据驱动的角色可以拥有任意行动ID。
 */
export type PlayerActionId = string;

export type EnemyActionInfo = CombatActionDefinition;

export interface BattleUnit {
  id: string;
  name: string;
  role: UnitRole;
  side: Side;

  maxHp: number;
  hp: number;

  attack: number;
  defense: number;
  speed: number;
  actionPower: number;

  strength: number;
  agility: number;
  constitution: number;
  intelligence: number;
  perception: number;
  charisma: number;

  nextActionAt: number;
  tieOrder: number;
  apLeft: number;

  alive: boolean;
  guarded: boolean;

  /**
   * 每个角色拥有自己的蓄能槽。
   */
  charge: number;
  maxCharge: number;

  /**
   * AI已经执行过的动作数量。
   */
  actionsTaken: number;

  /**
   * 已经使用过多少次满蓄动作。
   * 用于让AI交替使用蓄能技能和蓄能爆发。
   */
  fullChargeActionsUsed: number;

  /**
   * 当前单位携带的遗物。
   */
  relicIds: string[];

  /**
   * 当前单位安装的所有战斗钩子。
   */
  hookIds: string[];

  /**
   * 钩子在本场战斗中的使用次数。
   *
   * 每次创建新BattleState时都会重新清空。
   */
  hookUsage: Record<string, number>;
   /**
   * 当前单位拥有的状态。
   */
  statuses: BattleStatusEffect[];

  /** 不属于可净化状态的常驻层数，例如遗物提供的坚持。 */
  persistentLayers?: Record<string, number>;
  rebirthPolicy?: RebirthStatusPolicy;
  weaponState?: Record<string, number | string | boolean>;
}

export interface BattleState {
  battleKind: BattleKind;
  units: BattleUnit[];
  currentActorId: string | null;

    /**
   * 当前战斗回合。
   * 战斗尚未进入第一回合时为0。
   */
  roundNumber: number;

  status: BattleStatus;
  logs: string[];

  equippedWeaponId: string;
  equippedItemId: string;

  itemUsesLeft: number;

  playerActivations: number;
  teleporting: boolean;

  /**
   * 每当战斗推进一步时增加。
   *
   * 即使同一个敌人连续行动，React也能检测到变化，
   * 从而再次执行敌方AI。
   */
  actionSerial: number;
   /**
   * 用于生成状态实例的唯一ID。
   */
  nextStatusId: number;
}

const ACTION_INTERVAL_BASE = 10000;


function copyState(
  state: BattleState,
): BattleState {
  return {
    ...state,

    units: state.units.map(
      (unit) => ({
        ...unit,

        relicIds: [
          ...(unit.relicIds ?? []),
        ],

        hookIds: [
          ...(unit.hookIds ?? []),
        ],

        hookUsage: {
          ...(unit.hookUsage ?? {}),
        },
        persistentLayers: {
          ...(unit.persistentLayers ?? {}),
        },
        rebirthPolicy: unit.rebirthPolicy
          ? {
              preserveDefinitionIds: [
                ...(unit.rebirthPolicy.preserveDefinitionIds ?? []),
              ],
            }
          : undefined,
        weaponState: {
          ...(unit.weaponState ?? {}),
        },
         statuses: (
          unit.statuses ?? []
        ).map((status) => ({
          ...status,

          fixedModifiers: {
            ...status.fixedModifiers,
          },

          percentModifiers: {
            ...status.percentModifiers,
          },

          hookIds: [
            ...status.hookIds,
          ],

          data: {
            ...status.data,
          },
        })),
      }),
    ),

    logs: [...state.logs],
  };
}

function addLog(state: BattleState, message: string) {
  state.logs.push(message);

  if (state.logs.length > 100) {
    state.logs = state.logs.slice(-100);
  }
}

function getUnit(state: BattleState, id: string) {
  return state.units.find((unit) => unit.id === id);
}

function getLivingUnits(state: BattleState) {
  return state.units.filter((unit) => unit.alive);
}

/**
 * 修改单位的行动力属性。
 *
 * 这个数值会在之后每个回合开始时，
 * 决定单位获得多少行动次数。
 */
export function modifyActionPower(
  state: BattleState,
  targetId: string,
  amount: number,
): number {
  const target = getUnit(
    state,
    targetId,
  );

  if (!target) {
    return 0;
  }

  target.actionPower = Math.max(
    0,
    target.actionPower + amount,
  );

  return target.actionPower;
}

/**
 * 只修改当前回合剩余行动力。
 *
 * 适用于：
 * - 令目标本回合少行动一次；
 * - 令目标本回合额外行动一次；
 * - round-start触发的每回合行动力奖励。
 */
export function modifyRemainingActions(
  state: BattleState,
  targetId: string,
  amount: number,
): number {
  const target = getUnit(
    state,
    targetId,
  );

  if (!target || !target.alive) {
    return 0;
  }

  target.apLeft = Math.max(
    0,
    target.apLeft + amount,
  );

  return target.apLeft;
}

/**
 * 计算单位积满一次行动条所需要的时间。
 *
 * 速度越高，结果越小，因此越早行动。
 */
function getActionInterval(
  unit: BattleUnit,
): number {
  const effectiveSpeed =
    getEffectiveBattleStat(
      unit,
      "speed",
    );

  return (
    ACTION_INTERVAL_BASE /
    Math.max(1, effectiveSpeed)
  );
}

/**
 * 将行动力转换为本回合真正可用的行动次数。
 *
 * 当前行动力按照整数处理，并且不能小于0。
 */
function getRoundActionPower(
  unit: BattleUnit,
): number {
  return Math.max(
    0,
    Math.floor(unit.actionPower),
  );
}

function getStatusSourceId(
  status: BattleStatusEffect,
): string | null {
  const sourceId =
    status.data.sourceId;

  return (
    typeof sourceId === "string" &&
    sourceId.length > 0
  )
    ? sourceId
    : null;
}

function processRoundStartStatuses(
  state: BattleState,
): void {
  for (const unit of state.units) {
    if (!unit.alive) {
      continue;
    }

    const regenerationStatuses = [
      ...getStatusesByDefinition(
        unit,
        "regeneration",
      ),
    ];

    for (
      const regeneration
      of regenerationStatuses
    ) {
      const percent =
        getStatusNumber(
          regeneration,
          "value",
        );

      const healAmount = Math.max(
        0,
        Math.round(
          unit.maxHp *
          percent /
          100,
        ),
      );

      const actualHeal = restoreHp(
        state,
        getStatusSourceId(
          regeneration,
        ),
        unit.id,
        healAmount,
      );

      addLog(
        state,
        `${unit.name}的再生恢复了${actualHeal}点生命。`,
      );
    }

    const erosion = getStatusByDefinition(
      unit,
      "erosion-fire",
    );

    if (
      erosion &&
      Math.random() < Math.min(1, erosion.stacks * 0.2)
    ) {
      addBuiltInStatus(state, unit.id, "healing-blocked", {
        duration: 1,
      });
    }
  }
}

function processRoundEndStatuses(
  state: BattleState,
): void {
  for (const unit of state.units) {
    if (!unit.alive) {
      continue;
    }

    const burningStatuses = [
      ...getStatusesByDefinition(
        unit,
        "burning",
      ),
    ];

    for (
      const burning
      of burningStatuses
    ) {
      if (!unit.alive) {
        break;
      }

      dealFixedDamage(
        state,
        getStatusSourceId(
          burning,
        ),
        unit.id,
        getStatusNumber(
          burning,
          "value",
        ),
        "燃烧",
      );
    }

    if (hasStatus(unit, "residual-fire")) {
      const enemies = state.units.filter(
        (candidate) =>
          candidate.side === "enemy" &&
          candidate.alive,
      );
      addBurningStatuses(
        state,
        enemies.map((enemy) => enemy.id),
        {
          value: getEffectiveBattleStat(unit, "attack") * 0.75,
          duration: 2,
          sourceId: unit.id,
        },
      );
    }

    const poisonStatuses = [
      ...getStatusesByDefinition(
        unit,
        "poison",
      ),
    ];

    for (
      const poison
      of poisonStatuses
    ) {
      if (!unit.alive) {
        break;
      }

      const damage = Math.max(
        1,
        Math.round(
          unit.maxHp *
          getStatusNumber(
            poison,
            "value",
          ) /
          100,
        ),
      );

      dealFixedDamage(
        state,
        getStatusSourceId(
          poison,
        ),
        unit.id,
        damage,
        "中毒",
      );
    }
  }
}

/**
 * 返回true表示本次行动被状态取消。
 */
function processActionStartStatuses(
  state: BattleState,
  actor: BattleUnit,
): boolean {
  const bleedingStatuses = [
    ...getStatusesByDefinition(
      actor,
      "bleeding",
    ),
  ];

  for (
    const bleeding
    of bleedingStatuses
  ) {
    if (!actor.alive) {
      return true;
    }

    const damage = Math.max(
      1,
      Math.round(
        actor.hp *
        getStatusNumber(
          bleeding,
          "value",
        ) /
        100,
      ),
    );

    dealFixedDamage(
      state,
      getStatusSourceId(
        bleeding,
      ),
      actor.id,
      damage,
      "流血",
    );
  }

  if (!actor.alive) {
    return true;
  }

  if (hasStatus(actor, "frozen")) {
    addLog(
      state,
      `${actor.name}被冻结，无法行动。`,
    );

    return true;
  }

  if (hasStatus(actor, "sleep")) {
    addLog(
      state,
      `${actor.name}正在睡眠，无法行动。`,
    );

    return true;
  }

  if (
    consumeStatusLayer(
      state,
      actor,
      "paralysis",
    )
  ) {
    addLog(
      state,
      `${actor.name}受到麻痹影响，本次行动被取消。`,
    );

    return true;
  }

  if (
    hasStatus(actor, "fear") &&
    Math.random() < 0.5
  ) {
    consumeStatusLayer(state, actor, "fear");
    addLog(state, `${actor.name}因恐惧取消了本次行动。`);
    return true;
  }

  if (
    hasStatus(actor, "confusion") &&
    Math.random() < 0.5
  ) {
    const selfDamage = Math.max(
      1,
      Math.round(
        getEffectiveBattleStat(
          actor,
          "attack",
        ),
      ),
    );

    addLog(
      state,
      `${actor.name}受到困惑影响，攻击了自己。`,
    );

    dealFixedDamage(
      state,
      actor.id,
      actor.id,
      selfDamage,
      "困惑",
    );

    return true;
  }

  return false;
}

/**
 * 开始新的战斗回合。
 *
 * 每回合都会：
 * 1. 重新读取所有单位当前的行动力；
 * 2. 重新读取所有单位当前的速度；
 * 3. 将所有人的行动条从0开始计算。
 */
function startNextRound(
  state: BattleState,
): BattleState {
  if (state.status !== "playing") {
    return state;
  }

  state.roundNumber += 1;
  state.currentActorId = null;

  for (const unit of state.units) {
    if (!unit.alive) {
      unit.apLeft = 0;
      continue;
    }

    /*
     * 当前行动力决定本回合能行动多少次。
     */
    unit.apLeft =
      getRoundActionPower(unit);

    /*
     * 行动条从0开始积攒。
     * 第一次积满所需时间由当前速度决定。
     */
    unit.nextActionAt =
      getActionInterval(unit);
  }

  addLog(
    state,
    `第${state.roundNumber}回合开始。`,
  );

  /*
   * 先刷新基础行动力，再派发回合开始事件。
   *
   * 这样未来的“每回合行动力+1”效果，
   * 可以在round-start钩子中直接修改apLeft。
   */
  emitBattleEvent(state, {
    type: "round-start",
    roundNumber: state.roundNumber,
  });

    processRoundStartStatuses(state);

  const anyoneCanAct =
    state.units.some(
      (unit) =>
        unit.alive &&
        unit.apLeft > 0,
    );

  /*
   * 防止所有角色行动力都变成0时无限递归。
   */
  if (!anyoneCanAct) {
    addLog(
      state,
      "所有存活单位的行动力都为0，战斗暂时无法继续。",
    );

    state.currentActorId = null;
    state.actionSerial += 1;

    return state;
  }

  return beginNextAction(state);
}

/**
 * 结束当前回合。
 */
function finishCurrentRound(
  state: BattleState,
): BattleState {
  if (
    state.status !== "playing" ||
    state.roundNumber <= 0
  ) {
    return state;
  }

  addLog(
    state,
    `第${state.roundNumber}回合结束。`,
  );

  emitBattleEvent(state, {
    type: "round-end",
    roundNumber: state.roundNumber,
  });

  processRoundEndStatuses(state);

  const player =
    getUnit(state, "player");

  if (
    player &&
    !player.alive
  ) {
    state.status = "lost";
    state.currentActorId = null;
    state.actionSerial += 1;

    return state;
  }

  if (checkStandardVictory(state)) {
    return state;
  }

  /*
   * 回合结束效果执行完毕后，
   * 再减少状态持续时间。
   */
  tickStatusDurations(state);

  return startNextRound(state);
}
/**
 * 从所有仍有本回合行动力的单位中，
 * 找出下一名行动者。
 */
function beginNextAction(
  state: BattleState,
): BattleState {
  if (state.status !== "playing") {
    return state;
  }

  const availableUnits =
    getLivingUnits(state).filter(
      (unit) => unit.apLeft > 0,
    );

  /*
   * 没有人剩余行动力，当前回合结束。
   */
  if (availableUnits.length === 0) {
    return finishCurrentRound(state);
  }

  availableUnits.sort((a, b) => {
    const timeDifference =
      a.nextActionAt -
      b.nextActionAt;

    /*
     * 避免浮点数产生极小误差。
     */
    if (
      Math.abs(timeDifference) >
      0.000001
    ) {
      return timeDifference;
    }

    return a.tieOrder - b.tieOrder;
  });

  const nextActor =
    availableUnits[0];

  state.currentActorId =
    nextActor.id;

  state.actionSerial += 1;

  /*
   * 教程中的playerActivations只统计主控，
   * 不统计猫等同伴。
   */
  if (nextActor.role === "player") {
    state.playerActivations += 1;
  }

  addLog(
    state,
    `轮到${nextActor.name}行动。本回合剩余行动力：${nextActor.apLeft}。`,
  );
  emitBattleEvent(state, {
    type: "action-start",
    actorId: nextActor.id,
  });

  if (
    processActionStartStatuses(
      state,
      nextActor,
    )
  ) {
    nextActor.actionsTaken += 1;

    const player =
      getUnit(state, "player");

    if (
      player &&
      !player.alive
    ) {
      state.status = "lost";
      state.currentActorId = null;
      state.actionSerial += 1;

      return state;
    }

    if (checkStandardVictory(state)) {
      return state;
    }

    return finishOneAction(state);
  }

  return state;
}

/**
 * 当前单位完成一次行动。
 *
 * 和旧系统不同：
 * 即使当前单位还有行动力，也不会立刻连续行动。
 * 每一次行动后都会重新比较全场行动条。
 */
function finishOneAction(
  state: BattleState,
): BattleState {
  if (
    state.status !== "playing" ||
    !state.currentActorId
  ) {
    return state;
  }

  const actor = getUnit(state, state.currentActorId);

  if (actor) {
    if (actor.alive) {
      emitBattleEvent(state, {
        type: "action-end",
        actorId: actor.id,
      });
    }

    actor.apLeft = Math.max(0, actor.apLeft - 1);
    actor.nextActionAt += getActionInterval(actor);
  }

  state.currentActorId = null;
  state.actionSerial += 1;

  const player = getUnit(state, "player");

  if (player && (!player.alive || player.hp <= 0)) {
    player.hp = 0;
    player.alive = false;
    state.status = "lost";
    addLog(state, `${player.name}失去战斗能力。`);
    return state;
  }

  if (checkStandardVictory(state)) {
    return state;
  }

  return beginNextAction(state);
}

function calculateDamage(
  attacker: BattleUnit,
  defender: BattleUnit,
  multiplier: number,
  damageType: DamageType,
) {
  const effectiveAttack =
    getEffectiveBattleStat(
      attacker,
      "attack",
    );

  const effectiveDefense =
    getEffectiveBattleStat(
      defender,
      "defense",
    );

  const baseDamage = Math.max(
    1,
    effectiveAttack * multiplier -
      effectiveDefense,
  );

  const attackerAttribute =
    damageType === "physical"
      ? attacker.strength
      : attacker.intelligence;

  const defenderAttribute =
    damageType === "physical"
      ? defender.perception
      : defender.charisma;

  const attributeDifference =
    attackerAttribute - defenderAttribute;

  const damage =
    baseDamage * Math.pow(1.1, attributeDifference);

  return Math.max(1, Math.round(damage));
}

interface DamageResult {
  damage: number;
  defeated: boolean;
  guardConsumed: boolean;

  /**
   * 嘲讽或守护可能改变实际受击者。
   */
  defenderId: string | null;
}

function emitResolvedDamageEvents(
  state: BattleState,
  attacker: BattleUnit,
  defender: BattleUnit,
  damage: number,
  defeated: boolean,
) {
  emitBattleEvent(state, {
    type: "attack-hit",
    attackerId: attacker.id,
    defenderId: defender.id,
    damage,
  });

  if (attacker.side !== defender.side) {
    emitBattleEvent(state, {
      type: "attacked-by-enemy",
      attackerId: attacker.id,
      defenderId: defender.id,
      damage,
    });
  }

  emitBattleEvent(state, {
    type: "damage-taken",
    sourceId: attacker.id,
    targetId: defender.id,
    damage,
  });

  if (!defeated) {
    return;
  }

  emitBattleEvent(state, {
    type: "defeated-unit",
    attackerId: attacker.id,
    defeatedUnitId: defender.id,
  });

  emitBattleEvent(state, {
    type: "unit-defeated",
    unitId: defender.id,
    sourceId: attacker.id,
  });
}

interface DealDamageOptions {
  /**
   * false用于反击，避免反击之间无限循环。
   */
  canTriggerCounter?: boolean;

  /**
   * 追伤造成的固定伤害不再次触发追伤。
   */
  canTriggerPursuit?: boolean;

  /**
   * false表示DoT等非攻击伤害。
   */
  isAttack?: boolean;

  /**
   * 全体攻击不受嘲讽和守护影响。
   */
  canRedirect?: boolean;
  finalDamageBonus?: number;
}

function dealDamage(
  state: BattleState,
  attackerId: string,
  defenderId: string,
  multiplier: number,
  damageType: DamageType,
  options: DealDamageOptions = {},
): DamageResult {
  const attacker =
    getUnit(state, attackerId);

  const intendedDefender =
    getUnit(state, defenderId);

  if (
    !attacker ||
    !intendedDefender ||
    !attacker.alive ||
    !intendedDefender.alive
  ) {
    return {
      damage: 0,
      defeated: false,
      guardConsumed: false,
      defenderId: null,
    };
  }

  const isAttack =
    options.isAttack ?? true;

  const defender =
    isAttack &&
    (options.canRedirect ?? true)
      ? resolveForcedAttackTarget(
          state,
          attacker,
          intendedDefender,
        )
      : intendedDefender;

  if (
    preventDamageByStatus(
      state,
      defender,
    )
  ) {
    return {
      damage: 0,
      defeated: false,
      guardConsumed: false,
      defenderId: defender.id,
    };
  }

  let damage = calculateDamage(
    attacker,
    defender,
    multiplier,
    damageType,
  );

  damage = Math.round(
    damage * (1 + Math.max(0, options.finalDamageBonus ?? 0)),
  );

  if (hasStatus(defender, "residual-fire")) {
    const burningCount = getBurningCount(attacker);
    damage = Math.max(
      1,
      Math.round(
        damage * (1 - Math.min(0.5, burningCount * 0.05)),
      ),
    );
  }

  let guardConsumed = false;

  if (defender.guarded) {
    damage = Math.max(
      1,
      Math.round(damage * 0.55),
    );

    defender.guarded = false;
    guardConsumed = true;
  }

  const remainingHp =
    defender.hp - damage;

  /*
   * 教程中的魔将不能被真正击杀。
   */
  if (
    state.battleKind === "tutorial" &&
    defender.role === "mage-general" &&
    remainingHp <= 0
  ) {
    defender.hp = 1;
    state.teleporting = true;

    notifyStatusDamageTaken(
      state,
      defender,
    );

    emitResolvedDamageEvents(
      state,
      attacker,
      defender,
      damage,
      false,
    );

    return {
      damage,
      defeated: false,
      guardConsumed,
      defenderId: defender.id,
    };
  }

  defender.hp = Math.max(
    0,
    remainingHp,
  );

  let defeated = false;

  if (defender.hp <= 0) {
    if (
      preventDefeatByStatus(
        state,
        defender,
        defender.rebirthPolicy,
      )
    ) {
      defender.hp = Math.max(1, defender.hp);
    } else {
      defender.alive = false;
      defender.apLeft = 0;
      defeated = true;
    }
  }

  notifyStatusDamageTaken(
    state,
    defender,
  );

  emitResolvedDamageEvents(
    state,
    attacker,
    defender,
    damage,
    defeated,
  );

  /*
   * 追伤的每个实例独立触发。
   */
  if (
    isAttack &&
    !defeated &&
    (options.canTriggerPursuit ?? true)
  ) {
    const pursuits = [
      ...getStatusesByDefinition(
        attacker,
        "pursuit-damage",
      ),
    ];

    for (const pursuit of pursuits) {
      if (!defender.alive) {
        break;
      }

      const extraDamage = Math.max(
        0,
        Math.round(
          getStatusNumber(
            pursuit,
            "value",
          ),
        ),
      );

      if (extraDamage <= 0) {
        continue;
      }

      dealFixedDamage(
        state,
        attacker.id,
        defender.id,
        extraDamage,
        "追伤",
      );
    }
  }

  /*
   * 反击的每个实例独立触发。
   * 反击本身不会再次触发反击。
   */
  if (
    isAttack &&
    defender.alive &&
    attacker.alive &&
    (options.canTriggerCounter ?? true)
  ) {
    const counters = [
      ...getStatusesByDefinition(
        defender,
        "counter",
      ),
    ];

    for (const counter of counters) {
      if (
        !defender.alive ||
        !attacker.alive
      ) {
        break;
      }

      const counterMultiplier =
        getStatusNumber(
          counter,
          "value",
        );

      if (counterMultiplier <= 0) {
        continue;
      }

      const counterResult =
        dealDamage(
          state,
          defender.id,
          attacker.id,
          counterMultiplier,
          "physical",
          {
            canTriggerCounter: false,
            canTriggerPursuit: true,
            isAttack: true,
            canRedirect: false,
          },
        );

      const actualTarget =
        counterResult.defenderId
          ? getUnit(
              state,
              counterResult.defenderId,
            )
          : attacker;

      addLog(
        state,
        `${defender.name}发动反击，对${actualTarget?.name ?? attacker.name}造成${counterResult.damage}点物理伤害。`,
      );
    }
  }

  return {
    damage,
    defeated,
    guardConsumed,
    defenderId: defender.id,
  };
}

function dealFixedDamage(
  state: BattleState,
  sourceId: string | null,
  targetId: string,
  amount: number,
  reason: string,
): DamageResult {
  const target =
    getUnit(state, targetId);

  if (
    !target ||
    !target.alive ||
    amount <= 0
  ) {
    return {
      damage: 0,
      defeated: false,
      guardConsumed: false,
      defenderId: target?.id ?? null,
    };
  }

  if (
    preventDamageByStatus(
      state,
      target,
    )
  ) {
    return {
      damage: 0,
      defeated: false,
      guardConsumed: false,
      defenderId: target.id,
    };
  }

  const damage = Math.max(
    1,
    Math.round(amount),
  );

  const remainingHp =
    target.hp - damage;

  if (
    state.battleKind === "tutorial" &&
    target.role === "mage-general" &&
    remainingHp <= 0
  ) {
    target.hp = 1;
    state.teleporting = true;

    notifyStatusDamageTaken(
      state,
      target,
    );

    emitBattleEvent(state, {
      type: "damage-taken",
      sourceId,
      targetId: target.id,
      damage,
    });

    addLog(
      state,
      `${target.name}因${reason}受到${damage}点伤害。`,
    );

    return {
      damage,
      defeated: false,
      guardConsumed: false,
      defenderId: target.id,
    };
  }

  target.hp = Math.max(
    0,
    remainingHp,
  );

  let defeated =
    target.hp <= 0;

  if (defeated) {
    if (
      preventDefeatByStatus(
        state,
        target,
        target.rebirthPolicy,
      )
    ) {
      target.hp = Math.max(1, target.hp);
      defeated = false;
    } else {
      target.alive = false;
      target.apLeft = 0;
    }
  }

  notifyStatusDamageTaken(
    state,
    target,
  );

  emitBattleEvent(state, {
    type: "damage-taken",
    sourceId,
    targetId: target.id,
    damage,
  });

  if (defeated) {
    emitBattleEvent(state, {
      type: "unit-defeated",
      unitId: target.id,
      sourceId,
    });
  }

  addLog(
    state,
    `${target.name}因${reason}受到${damage}点伤害。`,
  );

  if (defeated) {
    addLog(
      state,
      `${target.name}失去战斗能力。`,
    );
  }

  return {
    damage,
    defeated,
    guardConsumed: false,
    defenderId: target.id,
  };
}

function gainCharge(
  state: BattleState,
  unit: BattleUnit,
  amount: number,
) {
  const previous = unit.charge;

  if (
    amount > 0 &&
    consumeImbalanceForCharge(
      state,
      unit,
    )
  ) {
    return {
      previous,
      current: unit.charge,
      prevented: true,
    };
  }

  unit.charge = Math.min(
    unit.maxCharge,
    unit.charge + amount,
  );

  return {
    previous,
    current: unit.charge,
    prevented: false,
  };
}

function restoreHp(
  state: BattleState,
  healerId: string | null,
  targetId: string,
  amount: number,
) {
  const target = getUnit(
    state,
    targetId,
  );

  if (
    !target ||
    !target.alive ||
    amount <= 0
  ) {
    return 0;
  }

  if (
    hasStatus(
      target,
      "healing-blocked",
    )
  ) {
    addLog(
      state,
      `${target.name}受到禁疗影响，本次生命回复为0。`,
    );

    return 0;
  }

  const actualHeal = Math.min(
    amount,
    target.maxHp - target.hp,
  );

  if (actualHeal <= 0) {
    return 0;
  }

  target.hp += actualHeal;

  emitBattleEvent(state, {
    type: "hp-restored",
    sourceId: healerId,
    targetId: target.id,
    amount: actualHeal,
  });

  if (
    healerId &&
    healerId !== target.id
  ) {
    emitBattleEvent(state, {
      type: "healed-other",
      healerId,
      targetId: target.id,
      amount: actualHeal,
    });
  }

  return actualHeal;
}

function checkTeleportCondition(state: BattleState) {
  const mage = getUnit(state, "enemy-mage");

  if (!mage || !mage.alive || state.teleporting) {
    return;
  }

  const lowHp = mage.hp <= mage.maxHp * 0.4;
  const battleHasLastedLongEnough =
    state.playerActivations >= 6;

  if (lowHp || battleHasLastedLongEnough) {
    state.teleporting = true;

    addLog(
      state,
      "魔将不再继续进攻，开始准备传送。必须在其下次行动前作出反应。",
    );
  }
}

function checkStandardVictory(
  state: BattleState,
): boolean {
  if (
    state.battleKind !== "standard" ||
    state.status !== "playing"
  ) {
    return false;
  }

  const anyLivingEnemy =
    state.units.some(
      (unit) =>
        unit.side === "enemy" &&
        unit.alive,
    );

  if (anyLivingEnemy) {
    return false;
  }

  state.status = "won";
  state.currentActorId = null;
  state.actionSerial += 1;

  addLog(
    state,
    "所有敌人都已失去战斗能力。",
  );

  return true;
}

export interface BattleFormation {
  /**
   * 玩家主控，固定为顺序0。
   */
  player: BattleUnit;

  /**
   * 敌人按照画面上从左到右的顺序传入。
   */
  enemies: BattleUnit[];

  /**
   * 同伴按照同伴位置1到4的顺序传入。
   */
  companions: BattleUnit[];
}

/**
 * 根据阵型自动分配行动条相同时的顺序。
 *
 * 顺序规则：
 *
 * 主控
 * 敌人1
 * 同伴1
 * 敌人2
 * 同伴2
 * 敌人3
 * 同伴3
 * ……
 *
 * 某个位置不存在时，会直接跳过，
 * 后面的顺序数字自动接上，不会产生空号。
 */
export function arrangeBattleFormation(
  formation: BattleFormation,
): BattleUnit[] {
  const orderedUnits: BattleUnit[] = [];

  let nextTieOrder = 0;

  formation.player.tieOrder =
    nextTieOrder;

  nextTieOrder += 1;

  orderedUnits.push(
    formation.player,
  );

  const formationLength = Math.max(
    formation.enemies.length,
    formation.companions.length,
  );

  for (
    let positionIndex = 0;
    positionIndex < formationLength;
    positionIndex += 1
  ) {
    const enemy =
      formation.enemies[positionIndex];

    if (enemy) {
      enemy.tieOrder =
        nextTieOrder;

      nextTieOrder += 1;

      orderedUnits.push(enemy);
    }

    const companion =
      formation.companions[
        positionIndex
      ];

    if (companion) {
      companion.tieOrder =
        nextTieOrder;

      nextTieOrder += 1;

      orderedUnits.push(companion);
    }
  }

  return orderedUnits;
}

/**
 * 根据combatants.ts中的定义创建战斗单位。
 *
 * 创建普通敌人和同伴时都使用这个函数。
 */
function createDefinedBattleUnit(
  roleId: string,
  instanceId: string,
  side: Side,
): BattleUnit {
  const definition =
    getCombatantDefinition(roleId);

  if (!definition) {
    throw new Error(
      `没有找到战斗单位定义：${roleId}`,
    );
  }

  return {
    id: instanceId,
    name: definition.name,
    role: definition.id,
    side,

    maxHp:
      definition.stats.maxHp,
    hp:
      definition.stats.maxHp,

    attack:
      definition.stats.attack,
    defense:
      definition.stats.defense,
    speed:
      definition.stats.speed,
    actionPower:
      definition.stats.actionPower,

    strength:
      definition.stats.strength,
    agility:
      definition.stats.agility,
    constitution:
      definition.stats.constitution,
    intelligence:
      definition.stats.intelligence,
    perception:
      definition.stats.perception,
    charisma:
      definition.stats.charisma,

    nextActionAt: 0,
    tieOrder: -1,
    apLeft: 0,

    alive: true,
    guarded: false,

    charge: 0,
    maxCharge:
      definition.maxCharge,

    actionsTaken: 0,
    fullChargeActionsUsed: 0,

    relicIds: [],
    hookIds: [],
    hookUsage: {},
      statuses: [],
  };
}

function createCompanionUnit(
  companionId: string,
  slotIndex: number,
): BattleUnit | undefined {
  const companion =
    getCompanionById(companionId);

  if (!companion) {
    return undefined;
  }

  return createDefinedBattleUnit(
    companion.combatantRoleId,
    `companion-slot-${slotIndex}`,
    "player",
  );
}

export function createTutorialBattle(
  protagonist: ProtagonistDefinition,
  inventory: PlayerInventory,
): BattleState {
  /*
   * 战斗中的遗物来自当前背包。
   */
  const startingRelicIds = [
    ...inventory.ownedRelicIds,
  ];

  /*
   * 根据遗物找到需要安装的钩子。
   */
  const startingHookIds =
    getRelicHookIds(
      startingRelicIds,
    );

  const companions =
    inventory.companionSlots
      .map((companionId, slotIndex) => {
        if (!companionId) {
          return undefined;
        }

        return createCompanionUnit(
          companionId,
          slotIndex,
        );
      })
      .filter(
        (
          companion,
        ): companion is BattleUnit =>
          companion !== undefined,
      );

  const equippedItem =
    getItemById(
      inventory.equippedItemId,
    );

    const equippedWeapon =
    getWeaponById(
      inventory.equippedWeaponId,
    );

  const player: BattleUnit = {
    id: "player",
    name: protagonist.name,
    role: "player",
    side: "player",

    maxHp: protagonist.stats.maxHp,
    hp: protagonist.stats.maxHp,

    attack: protagonist.stats.attack,
    defense: protagonist.stats.defense,
    speed: protagonist.stats.speed,
    actionPower: protagonist.stats.actionPower,

    strength: protagonist.stats.strength,
    agility: protagonist.stats.agility,
    constitution: protagonist.stats.constitution,
    intelligence: protagonist.stats.intelligence,
    perception: protagonist.stats.perception,
    charisma: protagonist.stats.charisma,

    nextActionAt: 0,
    tieOrder: -1,
    apLeft: 0,

    alive: true,
    guarded: false,

    charge: 0,
    maxCharge:
      equippedWeapon?.maxCharge ??
      4,

    actionsTaken: 0,
    fullChargeActionsUsed: 0,
    relicIds: startingRelicIds,
    hookIds: startingHookIds,
    hookUsage: {},
      statuses: [],
    weaponState: {
      blueForm: "origin",
      blueLevel: 1,
    },
    rebirthPolicy:
      inventory.equippedWeaponId === "weapon-endless-pale-sword"
        ? {
            preserveDefinitionIds: [
              "guided-pin",
              "star-enchantment",
            ],
          }
        : undefined,
  };

  const mageGeneral =
  createDefinedBattleUnit(
    "mage-general",
    "enemy-mage",
    "enemy",
  );

const shieldSoldier =
  createDefinedBattleUnit(
    "shield-soldier",
    "enemy-shield",
    "enemy",
  );

const scytheSoldier =
  createDefinedBattleUnit(
    "scythe-soldier",
    "enemy-scythe",
    "enemy",
  );

  const battleUnits =
    arrangeBattleFormation({
      player,

      /*
       * 敌人按照画面从左到右排列。
       */
      enemies: [
        mageGeneral,
        shieldSoldier,
        scytheSoldier,
      ],

      /*
       * 同伴已经按照位置1到4创建。
       */
      companions,
    });

  const state: BattleState = {
    battleKind: "tutorial",
    units: battleUnits,

    currentActorId: null,

    roundNumber: 0,

    status: "playing",

    logs: [
      "战斗开始。",
      `当前武器：${
        equippedWeapon?.name ??
        "未知武器"
      }。`,
    ],

    equippedWeaponId:
      inventory.equippedWeaponId,

    equippedItemId:
      inventory.equippedItemId,

    itemUsesLeft:
      equippedItem?.maxUsesPerBattle ??
      0,
    playerActivations: 0,
    teleporting: false,

    actionSerial: 0,
    nextStatusId: 1,
  };

   if (startingRelicIds.length > 0) {
    addLog(
      state,
      `初始遗物ID：${startingRelicIds.join("、")}。`,
    );
  } else {
    addLog(
      state,
      "当前角色没有携带初始遗物。",
    );
  }

  if (startingHookIds.length > 0) {
    addLog(
      state,
      `已安装战斗钩子：${startingHookIds.join("、")}。`,
    );
  } else {
    addLog(
      state,
      "当前角色没有安装任何战斗钩子。",
    );
  }

  emitBattleEvent(state, {
    type: "battle-start",
  });

  return startNextRound(state);
}

export type PlaceholderBattleType =
  | "strength"
  | "chariot"
  | "moon";

export function createPlaceholderBattle(
  protagonist: ProtagonistDefinition,
  inventory: PlayerInventory,
  areaNumber: number,
  battleType: PlaceholderBattleType,
): BattleState {
  const startingRelicIds = [
    ...inventory.ownedRelicIds,
  ];

  const startingHookIds =
    getRelicHookIds(
      startingRelicIds,
    );

  const companions =
    inventory.companionSlots
      .map(
        (
          companionId,
          slotIndex,
        ) => {
          if (!companionId) {
            return undefined;
          }

          return createCompanionUnit(
            companionId,
            slotIndex,
          );
        },
      )
      .filter(
        (
          companion,
        ): companion is BattleUnit =>
          companion !== undefined,
      );

  const equippedItem =
    getItemById(
      inventory.equippedItemId,
    );

  const equippedWeapon =
    getWeaponById(
      inventory.equippedWeaponId,
    );

  const player: BattleUnit = {
    id: "player",
    name: protagonist.name,
    role: "player",
    side: "player",

    maxHp:
      protagonist.stats.maxHp,
    hp:
      protagonist.stats.maxHp,

    attack:
      protagonist.stats.attack,
    defense:
      protagonist.stats.defense,
    speed:
      protagonist.stats.speed,
    actionPower:
      protagonist.stats.actionPower,

    strength:
      protagonist.stats.strength,
    agility:
      protagonist.stats.agility,
    constitution:
      protagonist.stats.constitution,
    intelligence:
      protagonist.stats.intelligence,
    perception:
      protagonist.stats.perception,
    charisma:
      protagonist.stats.charisma,

    nextActionAt: 0,
    tieOrder: -1,
    apLeft: 0,

    alive: true,
    guarded: false,

    charge: 0,
    maxCharge:
      equippedWeapon?.maxCharge ??
      4,

    actionsTaken: 0,
    fullChargeActionsUsed: 0,

    relicIds: startingRelicIds,
    hookIds: startingHookIds,
    hookUsage: {},
      statuses: [],
  };

  const enemyCount =
    battleType === "chariot"
      ? 2
      : 1;

  const baseScale =
    1 +
    (areaNumber - 1) * 0.12;

  const typeScale =
    battleType === "strength"
      ? 1
      : battleType === "chariot"
        ? 1.12
        : 1.5;

  const finalScale =
    baseScale * typeScale;

  const enemies =
    Array.from({
      length: enemyCount,
    }).map((_, index) => {
      const enemy =
        createDefinedBattleUnit(
          "shield-soldier",
          `flow-enemy-${index}`,
          "enemy",
        );

      enemy.name =
        battleType === "moon"
          ? "月下盾矛兵"
          : enemyCount > 1
            ? `盾矛兵${index + 1}`
            : "盾矛兵";

      enemy.maxHp = Math.round(
        enemy.maxHp * finalScale,
      );

      if (battleType === "moon") {
        enemy.maxHp = Math.round(
          enemy.maxHp * 1.45,
        );
      }

      enemy.hp = enemy.maxHp;

      enemy.attack = Math.round(
        enemy.attack * finalScale,
      );

      enemy.defense = Math.round(
        enemy.defense *
          Math.max(
            1,
            finalScale * 0.85,
          ),
      );

      enemy.speed = Math.round(
        enemy.speed *
          Math.max(
            1,
            1 +
              (areaNumber - 1) *
                0.04,
          ),
      );

      enemy.strength +=
        Math.floor(
          (areaNumber - 1) / 2,
        );

      enemy.constitution +=
        Math.floor(
          (areaNumber - 1) / 2,
        );

      return enemy;
    });

  const battleUnits =
    arrangeBattleFormation({
      player,
      enemies,
      companions,
    });

  const state: BattleState = {
    battleKind: "standard",

    units: battleUnits,

    currentActorId: null,
    roundNumber: 0,
    status: "playing",

    logs: [
      `第${areaNumber}区域战斗开始。`,
      `当前武器：${
        equippedWeapon?.name ??
        "未知武器"
      }。`,
    ],

    equippedWeaponId:
      inventory.equippedWeaponId,

    equippedItemId:
      inventory.equippedItemId,

    itemUsesLeft:
      equippedItem
        ?.maxUsesPerBattle ??
      0,

    playerActivations: 0,
    teleporting: false,
    actionSerial: 0,
    nextStatusId: 1,
  };

  emitBattleEvent(state, {
    type: "battle-start",
  });

  return startNextRound(state);
}

function getBurningCount(unit: BattleUnit): number {
  return getStatusesByDefinition(unit, "burning").length;
}

function createActionContext(
  state: BattleState,
  actor: BattleUnit,
  action: CombatActionDefinition,
  selection: ActionSelection,
  executionIndex: number,
  executionData: Record<string, number>,
): ActionEffectContext {
  return {
    state,
    actor,
    action,
    selection,
    executionIndex,
    executionData,

    targets(selector) {
      return resolveCombatTargets(
        state,
        actor,
        selection,
        selector,
      );
    },

    redirect(target) {
      return resolveForcedAttackTarget(
        state,
        actor,
        target,
      );
    },

    attack(
      target,
      multiplier,
      damageType,
      area = false,
      finalDamageBonus = 0,
    ) {
      const result = dealDamage(
        state,
        actor.id,
        target.id,
        multiplier,
        damageType,
        {
          canRedirect: !area,
          finalDamageBonus,
        },
      );

      const actual = result.defenderId
        ? getUnit(state, result.defenderId)
        : undefined;

      if (actual) {
        addLog(
          state,
          `${action.name}对${actual.name}造成${result.damage}点${
            damageType === "physical" ? "物理" : "能量"
          }伤害。`,
        );

        if (result.guardConsumed) {
          addLog(
            state,
            `${actual.name}的防御状态降低了本次伤害。`,
          );
        }

        if (result.defeated) {
          addLog(
            state,
            `${actual.name}失去战斗能力。`,
          );
        }
      }

      return actual;
    },

    fixedDamage(target, amount, reason) {
      dealFixedDamage(
        state,
        actor.id,
        target.id,
        amount,
        reason,
      );
    },

    heal(target, amount) {
      const healed = restoreHp(
        state,
        actor.id,
        target.id,
        Math.max(0, Math.round(amount)),
      );

      addLog(
        state,
        `${action.name}使${target.name}恢复${healed}点生命。`,
      );

      return healed;
    },

    gainCharge(target, amount) {
      const result = gainCharge(state, target, amount);

      addLog(
        state,
        `${target.name}的蓄能从${result.previous}变为${result.current}。`,
      );
    },

    log(message) {
      addLog(state, message);
    },
  };
}

function executeActionEffects(
  context: ActionEffectContext,
): void {
  if (!context.actor.alive) {
    return;
  }

  for (const effect of context.action.effects) {
    if (!context.actor.alive) {
      break;
    }

    const targets = context.targets(effect.target);

    if (targets.length === 0) {
      context.log(
        `${context.action.name}的${effect.target.type}效果 miss。`,
      );
      continue;
    }

    for (const target of targets) {
      if (!context.actor.alive) {
        break;
      }

      switch (effect.type) {
        case "damage": {
          const hits = Math.max(
            1,
            Math.floor(effect.hits ?? 1),
          );

          const area =
            effect.target.type === "all-enemies" ||
            effect.target.type === "all-allies";

          for (let hit = 0; hit < hits; hit += 1) {
            if (!target.alive || !context.actor.alive) {
              break;
            }

            context.attack(
              target,
              effect.multiplier,
              effect.damageType,
              area,
            );
          }
          break;
        }

        case "gain-charge":
          if (
            context.action.category === "basic" &&
            target.id === context.actor.id &&
            basicChargeIsLocked(context.actor)
          ) {
            break;
          }

          context.gainCharge(target, effect.amount);
          break;

        case "guard":
          target.guarded = true;
          context.log(`${target.name}获得防御状态。`);
          break;

        case "heal":
          context.heal(
            target,
            (effect.amount ?? 0) +
              target.maxHp * (effect.maxHpRatio ?? 0),
          );
          break;
      }
    }
  }

  if (context.actor.alive) {
    executeSpecialAction(context);
  }
}

function applyActionChargeCost(
  state: BattleState,
  actor: BattleUnit,
  action: CombatActionDefinition,
): void {
  if (action.chargeCost === undefined) {
    return;
  }

  if (action.chargeCost === "all") {
    actor.charge = 0;
    addLog(state, `${actor.name}消耗全部蓄能。`);
    return;
  }

  actor.charge = Math.max(
    0,
    actor.charge - action.chargeCost,
  );

  addLog(
    state,
    `${actor.name}消耗${action.chargeCost}点蓄能。`,
  );
}

/**
 * 唯一公共行动入口。
 * 玩家、同伴和敌人都在此完成检查、效果与结算。
 */
function performUnitAction(
  state: BattleState,
  actor: BattleUnit,
  actionId: string,
  selection: ActionSelection,
): BattleState {
  const availability = getActionAvailability(
    state,
    actor.id,
    actionId,
    selection,
  );

  if (!availability.allowed) {
    addLog(
      state,
      availability.reason ?? "当前无法使用该行动。",
    );
    return state;
  }

  const action = findUnitAction(state, actor, actionId);
  if (!action) {
    return state;
  }

  if (
    action.special &&
    !hasSpecialActionHandler(action.special)
  ) {
    addLog(
      state,
      `行动错误：缺少特殊处理器 ${action.special}。`,
    );
    return state;
  }

  const before = emitBattleEvent(state, {
    type: "before-action-used",
    actorId: actor.id,

    // 暂时保留旧钩子的 actionId 语义。
    actionId: action.category,
    actionDefinitionId: action.id,

    isChargedAction:
      action.category === "charged-skill" ||
      action.category === "burst",
    canceled: false,
  });

  if (before.canceled) {
    addLog(
      state,
      `${actor.name}的${action.name}被取消。`,
    );

    actor.actionsTaken += 1;
    return finishOneAction(state);
  }

  const repriseCount =
    action.weaponAction &&
    consumeReprise(state, actor, action.category)
      ? 1
      : 0;

  const costTiming =
    action.chargeCostTiming ?? "after-effects";

  if (costTiming === "before-effects") {
    applyActionChargeCost(state, actor, action);
  }

  addLog(state, `${actor.name}使用${action.name}。`);

  const executionData: Record<string, number> = {};

  executeActionEffects(
    createActionContext(
      state,
      actor,
      action,
      selection,
      0,
      executionData,
    ),
  );

  if (action.category === "item") {
    state.itemUsesLeft = Math.max(
      0,
      state.itemUsesLeft - 1,
    );

    emitBattleEvent(state, {
      type: "item-used",
      actorId: actor.id,
      itemId: state.equippedItemId,
    });
  }

  const used = emitBattleEvent(state, {
    type: "action-used",
    actorId: actor.id,
    actionId: action.category,
    actionDefinitionId: action.id,
    repeatCount: 0,
  });

  // 现有钩子的重复请求继续仅用于爆发。
  const hookRepeats =
    action.category === "burst"
      ? Math.max(0, Math.floor(used.repeatCount))
      : 0;

  const repeats = repriseCount + hookRepeats;

  for (
    let index = 0;
    index < repeats && actor.alive;
    index += 1
  ) {
    addLog(
      state,
      `${action.name}额外执行第${index + 1}次效果。`,
    );

    // 使用本次行动定义快照，不因青羽中途变形而换行动。
    executeActionEffects(
      createActionContext(
        state,
        actor,
        action,
        selection,
        index + 1,
        executionData,
      ),
    );
  }

  if (costTiming === "after-effects") {
    applyActionChargeCost(state, actor, action);
  }

  if (
    action.basicCharge &&
    actor.alive &&
    !basicChargeIsLocked(actor)
  ) {
    gainCharge(state, actor, 1);
  }

  if (action.requiresFullCharge) {
    actor.fullChargeActionsUsed += 1;
  }

  actor.actionsTaken += 1;

  if (state.battleKind === "tutorial") {
    checkTeleportCondition(state);
  }

  return finishOneAction(state);
}

export function performPlayerAction(
  originalState: BattleState,
  actorId: string,
  actionId: PlayerActionId,
  selectionOrEnemyId: ActionSelection | string | null,
): BattleState {
  const state = copyState(originalState);
  const actor = getUnit(state, actorId);

  if (!actor || actor.side !== "player") {
    return state;
  }

  // 兼容既有测试和外部调用；页面改用完整选择对象。
  const selection: ActionSelection =
    typeof selectionOrEnemyId === "object" &&
    selectionOrEnemyId !== null
      ? { ...selectionOrEnemyId }
      : {
          enemyId: selectionOrEnemyId,
          allyId: actor.id,
        };

  return performUnitAction(
    state,
    actor,
    actionId,
    selection,
  );
}

function chooseEnemyAction(
  state: BattleState,
  enemy: BattleUnit,
): CombatActionDefinition | undefined {
  const definition = getCombatantDefinition(enemy.role);
  if (!definition) {
    return undefined;
  }

  const selection: ActionSelection = {
    enemyId:
      state.units.find(
        (unit) =>
          unit.role === "player" &&
          unit.side !== enemy.side &&
          unit.alive,
      )?.id ?? null,
    allyId: enemy.id,
  };

  const usable = (action: CombatActionDefinition) =>
    getActionAvailability(
      state,
      enemy.id,
      action.id,
      selection,
    ).allowed;

  const ai = definition.ai;
  if (!ai) {
    return definition.actions.find(usable);
  }

  const full = enemy.charge >= enemy.maxCharge;
  const pattern =
    full && ai.fullChargePattern.length > 0
      ? ai.fullChargePattern
      : ai.normalPattern;

  const start = full
    ? enemy.fullChargeActionsUsed
    : enemy.actionsTaken;

  for (let offset = 0; offset < pattern.length; offset += 1) {
    const id = pattern[(start + offset) % pattern.length];
    const action = definition.actions.find(
      (candidate) => candidate.id === id,
    );

    if (action && usable(action)) {
      return action;
    }
  }

  return definition.actions.find(usable);
}

export function performEnemyAction(
  originalState: BattleState,
): BattleState {
  const state = copyState(originalState);

  if (
    state.status !== "playing" ||
    !state.currentActorId
  ) {
    return state;
  }

  const actor = getUnit(state, state.currentActorId);

  if (
    !actor ||
    !actor.alive ||
    actor.side !== "enemy" ||
    actor.apLeft <= 0
  ) {
    return state;
  }

  const player = getUnit(state, "player");
  if (!player?.alive) {
    return state;
  }

  // 教程演出仍属于教程流程，不进入普通行动定义。
  if (
    state.battleKind === "tutorial" &&
    actor.id === "enemy-mage" &&
    state.teleporting
  ) {
    addLog(
      state,
      "魔将完成传送，在两名士兵的掩护下带着部件离开。",
    );

    state.status = "won";
    state.currentActorId = null;
    state.actionSerial += 1;
    return state;
  }

  const action = chooseEnemyAction(state, actor);

  if (!action) {
    addLog(
      state,
      `${actor.name}当前没有可用行动，本次行动跳过。`,
    );

    actor.actionsTaken += 1;
    return finishOneAction(state);
  }

  return performUnitAction(
    state,
    actor,
    action.id,
    {
      enemyId: player.id,
      allyId: actor.id,
    },
  );
}

export function getCurrentActor(
  state: BattleState,
) {
  if (!state.currentActorId) {
    return undefined;
  }

  return getUnit(state, state.currentActorId);
}

/** 预留给其他单位施加的蓄能减少；武器自带扣费不会经过这里。 */
export function reduceChargeByExternalEffect(
  state: BattleState,
  target: BattleUnit,
  amount: number,
): number {
  const reduction = Math.max(0, Math.floor(amount));

  if (
    reduction <= 0 ||
    consumeStatusLayer(
      state,
      target,
      "charge-loss-nullification",
    )
  ) {
    return 0;
  }

  const previous = target.charge;
  target.charge = Math.max(
    0,
    target.charge - reduction,
  );
  return previous - target.charge;
}