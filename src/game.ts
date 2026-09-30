import type {
  ProtagonistDefinition,
} from "./content";

import {
  getCombatantAction,
  getCombatantDefinition,
  type CombatActionDefinition,
  type CombatTargetSelector,
  type CombatDamageType,
} from "./combatants";

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
  addImbalance,
  addStatus,
  basicChargeIsLocked,
  checkActionRestriction,
  consumeImbalanceForCharge,
  consumeReprise,
  consumeStatusLayer,
  getEffectiveBattleStat,
  getStatusByDefinition,
  getStatusTags,
  getStatusNumber,
  getStatusesByDefinition,
  hasStatus,
  notifyStatusDamageTaken,
  preventDefeatByStatus,
  preventDamageByStatus,
  purgeStatuses,
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

export interface EnemyActionInfo {
  id: string;
  name: string;
  description: string;
  targetRequired?: boolean;
  requiresFullCharge?: boolean;
}

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

/**
 * 取得任意数据驱动单位的行动资料。
 *
 * 敌人资料面板和同伴行动按钮都使用这个函数。
 */
export function getUnitActionInfo(
  unit: BattleUnit,
): EnemyActionInfo[] {
  if (unit.role === "player") {
    return [];
  }

  const definition =
    getCombatantDefinition(
      unit.role,
    );

  if (!definition) {
    return [];
  }

  return definition.actions.map(
    (action) => ({
      id: action.id,
      name: action.name,
      description:
        action.description,
      targetRequired:
        action.targetRequired,
      requiresFullCharge:
        action.requiresFullCharge,
    }),
  );
}

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

  const actor = getUnit(
    state,
    state.currentActorId,
  );

  if (!actor || !actor.alive) {
    state.currentActorId = null;
    state.actionSerial += 1;

    return beginNextAction(state);
  }

  emitBattleEvent(state, {
    type: "action-end",
    actorId: actor.id,
  });

  actor.apLeft = Math.max(
    0,
    actor.apLeft - 1,
  );

  /*
   * 每执行一次行动，就扣除一整条行动条。
   *
   * 在nextActionAt模型中，这等价于：
   * 下一次行动时间增加一次积满行动条所需的时间。
   */
  actor.nextActionAt +=
    getActionInterval(actor);

  state.currentActorId = null;
  state.actionSerial += 1;

  /*
   * 无论当前单位是否还有行动力，
   * 都重新比较所有单位的行动时间。
   */
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
    defender.role ===
      "mage-general" &&
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
    target.role ===
      "mage-general" &&
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

function targetIsRequired(action: PlayerActionId) {
  return (
    action === "basic" ||
    action === "skill" ||
    action === "charged-skill"
  );
}

function executePlayerBurst(
  state: BattleState,
  player: BattleUnit,
  repeated: boolean,
) {
  const enemies = state.units.filter(
    (unit) =>
      unit.side === "enemy" &&
      unit.alive,
  );

  if (repeated) {
    addLog(
      state,
      `${player.name}的蓄能爆发在余响中复起。`,
    );
  } else {
    addLog(
      state,
      `${player.name}释放蓄能爆发。`,
    );
  }

  for (const enemy of enemies) {
    const result = dealDamage(
      state,
      player.id,
      enemy.id,
      1.35,
      "energy",
    );

    addLog(
      state,
      `${
        repeated ? "复起的蓄能爆发" : "蓄能爆发"
      }对${enemy.name}造成${result.damage}点能量伤害。`,
    );

    if (result.guardConsumed) {
      addLog(
        state,
        `${enemy.name}的防御状态降低了本次伤害。`,
      );
    }

    if (result.defeated) {
      addLog(
        state,
        `${enemy.name}失去战斗能力。`,
      );
    }
  }
}

/**
 * 根据选择器寻找一个效果的目标。
 */
function resolveCombatTargets(
  state: BattleState,
  actor: BattleUnit,
  selectedTargetId: string | null,
  selector: CombatTargetSelector,
): BattleUnit[] {
  if (selector.type === "self") {
    return actor.alive
      ? [actor]
      : [];
  }

  if (
    selector.type ===
    "chosen-enemy"
  ) {
    const target = selectedTargetId
      ? getUnit(
          state,
          selectedTargetId,
        )
      : undefined;

    if (
      !target ||
      !target.alive ||
      target.side === actor.side
    ) {
      return [];
    }

    return [target];
  }

  if (
    selector.type ===
    "main-player"
  ) {
    const player =
      getUnit(state, "player");

    if (!player || !player.alive) {
      return [];
    }

    return [player];
  }

  if (
    selector.type ===
    "all-enemies"
  ) {
    return state.units.filter(
      (unit) =>
        unit.alive &&
        unit.side !== actor.side,
    );
  }

  if (
    selector.type ===
    "all-allies"
  ) {
    return state.units.filter(
      (unit) =>
        unit.alive &&
        unit.side === actor.side,
    );
  }

  if (
    selector.type ===
    "ally-role-or-self"
  ) {
    const ally = state.units.find(
      (unit) =>
        unit.alive &&
        unit.side === actor.side &&
        unit.role === selector.roleId,
    );

    return [ally ?? actor];
  }

  return [];
}

function canUseDefinedAction(
  actor: BattleUnit,
  action: CombatActionDefinition,
): boolean {
  const restriction =
    checkActionRestriction(
      actor,
      action.id,
    );

  if (!restriction.allowed) {
    return false;
  }

  if (
    action.requiresFullCharge &&
    actor.charge < actor.maxCharge
  ) {
    return false;
  }

  return true;
}

/**
 * 执行一个由combatants.ts定义的通用行动。
 *
 * 敌人和同伴都使用这个函数。
 */
function executeDefinedAction(
  state: BattleState,
  actor: BattleUnit,
  action: CombatActionDefinition,
  selectedTargetId: string | null,
) {
  if (
    !canUseDefinedAction(
      actor,
      action,
    )
  ) {
    addLog(
      state,
      `${actor.name}的蓄能槽尚未充满，无法使用${action.name}。`,
    );

    return false;
  }

  if (action.targetRequired) {
    const selectedTarget =
      selectedTargetId
        ? getUnit(
            state,
            selectedTargetId,
          )
        : undefined;

    if (
      !selectedTarget ||
      !selectedTarget.alive ||
      selectedTarget.side ===
        actor.side
    ) {
      addLog(
        state,
        "请先选择一名仍然存活的敌人。",
      );

      return false;
    }
  }

  addLog(
    state,
    `${actor.name}使用${action.name}。`,
  );

  for (const effect of action.effects) {
    const targets =
      resolveCombatTargets(
        state,
        actor,
        selectedTargetId,
        effect.target,
      );

    if (effect.type === "damage") {
      const totalHits =
        Math.max(
          1,
          Math.floor(
            effect.hits ?? 1,
          ),
        );

      for (const target of targets) {
        for (
          let hitIndex = 0;
          hitIndex < totalHits;
          hitIndex += 1
        ) {
          if (!target.alive) {
            break;
          }

          const result = dealDamage(
            state,
            actor.id,
            target.id,
            effect.multiplier,
            effect.damageType,
          );

          const hitText =
            totalHits > 1
              ? `第${hitIndex + 1}击`
              : "";

          const damageTypeName =
            effect.damageType ===
            "physical"
              ? "物理"
              : "能量";

          addLog(
            state,
            `${action.name}${hitText}对${target.name}造成${result.damage}点${damageTypeName}伤害。`,
          );

          if (
            result.guardConsumed
          ) {
            addLog(
              state,
              `${target.name}的防御状态降低了本次伤害。`,
            );
          }

          if (result.defeated) {
            addLog(
              state,
              `${target.name}失去战斗能力。`,
            );
          }
        }
      }
    }

    if (
      effect.type ===
      "gain-charge"
    ) {
      for (const target of targets) {
        const result = gainCharge(
          state,
          target,
          effect.amount,
        );

        addLog(
          state,
          `${target.name}的蓄能从${result.previous}变为${result.current}。`,
        );
      }
    }

    if (effect.type === "guard") {
      for (const target of targets) {
        target.guarded = true;

        addLog(
          state,
          `${target.name}获得防御状态。`,
        );
      }
    }
  }

  if (
    action.chargeCost === "all"
  ) {
    actor.charge = 0;

    addLog(
      state,
      `${actor.name}的蓄能归零。`,
    );
  } else if (
    typeof action.chargeCost ===
    "number"
  ) {
    actor.charge = Math.max(
      0,
      actor.charge -
        action.chargeCost,
    );

    addLog(
      state,
      `${actor.name}消耗${action.chargeCost}点蓄能。`,
    );
  }

  if (
    action.requiresFullCharge
  ) {
    actor.fullChargeActionsUsed += 1;
  }

  return true;
}

/**
 * 玩家手动控制一个数据驱动同伴。
 */
function performControlledCombatantAction(
  state: BattleState,
  actor: BattleUnit,
  actionId: PlayerActionId,
  targetId: string | null,
): BattleState {
  const action =
    getCombatantAction(
      actor.role,
      actionId,
    );

  if (!action) {
    addLog(
      state,
      `行动错误：${actor.name}没有ID为“${actionId}”的行动。`,
    );

    return state;
  }

  const actionSucceeded =
    executeDefinedAction(
      state,
      actor,
      action,
      targetId,
    );

  if (!actionSucceeded) {
    return state;
  }

  emitBattleEvent(state, {
    type: "action-used",
    actorId: actor.id,
    actionId: action.id,
    repeatCount: 0,
  });

  actor.actionsTaken += 1;

  if (checkStandardVictory(state)) {
    return state;
  }

  checkTeleportCondition(state);

  return finishOneAction(state);
}

function getBurningCount(unit: BattleUnit): number {
  return getStatusesByDefinition(
    unit,
    "burning",
  ).length;
}

function addBlueStatus(
  state: BattleState,
  targetId: string,
  definitionId: string,
  name: string,
  icon: string,
  description: string,
  options: {
    duration?: number;
    stacks?: number;
    tags?: ("特殊" | "正面" | "强化" | "弱化" | "异常" | "DoT")[];
    stacking?: "replace" | "independent" | "layers";
    percentModifiers?: Partial<Record<"attack" | "defense" | "speed", number>>;
  } = {},
) {
  return addStatus(state, targetId, {
    definitionId,
    name,
    icon,
    description,
    tags: options.tags ?? ["特殊"],
    duration: options.duration ?? -1,
    stacks: options.stacks,
    stacking: options.stacking ?? "replace",
    percentModifiers: options.percentModifiers,
  });
}

function executeBlueBurst(
  state: BattleState,
  player: BattleUnit,
): void {
  let chargeGained = 0;

  for (const enemy of state.units.filter(
    (unit) => unit.side === "enemy" && unit.alive,
  )) {
    const burningStatuses = [
      ...getStatusesByDefinition(enemy, "burning"),
    ];
    const burningCount = burningStatuses.length;

    dealDamage(
      state,
      player.id,
      enemy.id,
      2,
      "energy",
    );

    for (const burning of burningStatuses) {
      if (enemy.alive) {
        dealFixedDamage(
          state,
          getStatusSourceId(burning),
          enemy.id,
          getStatusNumber(burning, "value"),
          "燃烧",
        );
      }
      burning.duration += 1;
    }

    chargeGained += Math.min(4, burningCount);
  }

  const previousCharge = player.charge;
  player.charge = Math.min(
    player.maxCharge,
    player.charge + chargeGained,
  );
  addLog(
    state,
    `${player.name}根据燃烧数量获得${player.charge - previousCharge}点蓄能。`,
  );
}

function performBlueWeaponAction(
  state: BattleState,
  player: BattleUnit,
  action: PlayerActionId,
  targetId: string | null,
): BattleState {
  const form = player.weaponState?.blueForm ?? "origin";
  const level = Number(player.weaponState?.blueLevel ?? 1);
  const target = targetId ? getUnit(state, targetId) : undefined;
  const repriseCount = action === "burst" && consumeReprise(
    state,
    player,
    action,
  ) ? 1 : 0;

  if ((action === "basic" || action === "skill" ||
      (action === "charged-skill" && form === "residual")) &&
      (!target || !target.alive)) {
    return state;
  }

  if (action === "basic" && target) {
    const residual = hasStatus(player, "residual-fire");
    const burningBonus = Math.min(4, getBurningCount(target)) * 0.25;
    const result = dealDamage(
      state,
      player.id,
      target.id,
      residual ? 1.25 + burningBonus : 1.25,
      residual ? "energy" : "physical",
    );

    if (!residual) {
      purgeStatuses(state, player.id, player.id, "negative");
      purgeStatuses(state, player.id, player.id, "negative");
    }

    addBurningStatuses(state, [target.id], {
      value: residual
        ? getEffectiveBattleStat(player, "attack") * 1.25
        : getEffectiveBattleStat(player, "attack"),
      duration: 2,
      sourceId: player.id,
    });
    addLog(state, `${player.name}使用青羽攻击${target.name}，造成${result.damage}点伤害。`);
  }

  if (action === "skill") {
    const successChance = Math.min(
      1,
      0.4 + getBurningCount(target!) * 0.1,
    );

    if (form === "origin") {
      addBlueStatus(state, target!.id, "attached-wind", "附风", "风", "被附加燃烧时，其他拥有附风的单位被附加相同的燃烧，然后解除自身的附风。", {
        duration: 2,
        tags: ["特殊"],
      });
      for (const enemy of state.units.filter((unit) => unit.side === "enemy" && unit.alive && unit.id !== target!.id)) {
        if (Math.random() < successChance) {
          addBlueStatus(state, enemy.id, "attached-wind", "附风", "风", "被附加燃烧时，其他拥有附风的单位被附加相同的燃烧，然后解除自身的附风。", { duration: 2, tags: ["特殊"] });
        }
      }
    } else {
      for (const enemy of state.units.filter((unit) => unit.side === "enemy" && unit.alive)) {
        if (Math.random() < successChance) {
          addBuiltInStatus(state, enemy.id, "fear", { duration: 2, stacks: 1 });
        }
      }
    }
  }

  if (action === "charged-skill") {
    if (form === "origin") {
      for (const enemy of state.units.filter((unit) => unit.side === "enemy" && unit.alive)) {
        addBlueStatus(state, enemy.id, "erosion-fire", "蚀火", "蚀", "被附加燃烧时，层数+1。根据层数，攻击力减少5%（最大50%）。根据层数，回合开始时20%概率%）。", {
          stacks: 1,
          stacking: "layers",
          tags: ["特殊"],
        });
      }
      addBlueStatus(state, player.id, "blue-reversal-defense", "青之逆转·减伤", "减", "受到的伤害降低33%。", {
        duration: 3,
        tags: ["强化"],
      });
      addBlueStatus(state, player.id, "blue-reversal-attack", "青之逆转·攻击", "攻", "攻击力降低33%。", {
        duration: 3,
        tags: ["弱化"],
        percentModifiers: { attack: -0.33 },
      });
    } else {
      const burningCount = getBurningCount(target!);
      if (burningCount === 1) {
        for (const burning of getStatusesByDefinition(target!, "burning")) {
          burning.duration += 1;
        }
      } else if (burningCount === 2) {
        addBuiltInStatus(state, target!.id, "marked", { stacks: 2, duration: -1 });
      } else if (burningCount >= 3) {
        purgeStatuses(state, player.id, target!.id, "negative");
      }
      addBlueStatus(state, player.id, "residual-fire", "残火", "残", "受到燃烧敌人的攻击时，根据来源的燃烧数量减少5%伤害（最大50%）。回合结束时，全体敌人附加燃烧（攻击力0.75倍）2回合。", {
        duration: 3,
        tags: ["特殊"],
      });
      addBuiltInStatus(state, player.id, "charge-loss-nullification", { stacks: 1 });
    }
  }

  if (action === "burst") {
    player.charge = 0;

    if (form === "origin") {
      const removed = purgeStatuses(state, player.id, player.id, "negative");
      player.charge = Math.min(player.maxCharge, player.charge + removed.length * (level >= 2 ? 2 : 1));
      player.hp = Math.min(player.maxHp, player.hp + 30);
      addBlueStatus(state, player.id, "blue-elevation-attack", "青之升华·攻击", "攻", "攻击力提高30%。", {
        duration: 3,
        tags: ["强化"],
        percentModifiers: { attack: 0.3 },
      });
      player.weaponState = { ...player.weaponState, blueForm: "residual", blueLevel: level + 1 };
    } else {
      executeBlueBurst(state, player);
      player.weaponState = { ...player.weaponState, blueForm: "origin", blueLevel: level };
    }
  }

  if (action === "charged-skill" && form === "residual") {
    for (const enemy of state.units.filter((unit) => unit.side === "enemy" && unit.alive)) {
      for (const burning of getStatusesByDefinition(enemy, "burning")) {
        burning.duration += 1;
      }
    }
  }

  const actionEvent = emitBattleEvent(state, {
    type: "action-used",
    actorId: player.id,
    actionId: action,
    repeatCount: 0,
  });

  if (action === "burst") {
    const repeatCount = actionEvent.repeatCount + repriseCount;
    for (let index = 0; index < repeatCount; index += 1) {
      if (form === "residual") {
        executeBlueBurst(state, player);
      }
    }
  } else {
    applyWeaponChargeRule(state, player, action);
  }
  player.actionsTaken += 1;
  return finishOneAction(state);
}

function performRainbowWeaponAction(
  state: BattleState,
  player: BattleUnit,
  action: PlayerActionId,
  targetId: string | null,
  repriseCount = 0,
): BattleState {
  if (
    action === "basic" &&
    targetId
  ) {
    const target =
      getUnit(state, targetId);

    if (!target || !target.alive) {
      return state;
    }

    /*
     * 在第一次攻击发生前判断生命值。
     */
    const repeatWholeAction =
      target.hp <
      target.maxHp * 0.5;

    const executionCount =
      (repeatWholeAction ? 2 : 1) + repriseCount;

    addLog(
      state,
      `${player.name}使用双重彩虹。`,
    );

    for (
      let executionIndex = 0;
      executionIndex <
      executionCount;
      executionIndex += 1
    ) {
      for (
        let hitIndex = 0;
        hitIndex < 2;
        hitIndex += 1
      ) {
        if (!target.alive) {
          break;
        }

        const result = dealDamage(
          state,
          player.id,
          target.id,
          1,
          "physical",
        );

        addLog(
          state,
          `双重彩虹第${executionIndex + 1}次执行的第${hitIndex + 1}击，对${target.name}造成${result.damage}点物理伤害。`,
        );

        if (result.guardConsumed) {
          addLog(
            state,
            `${target.name}的防御状态降低了本次伤害。`,
          );
        }

        if (result.defeated) {
          addLog(
            state,
            `${target.name}失去战斗能力。`,
          );
        }
      }

      addStatus(
        state,
        player.id,
        {
          definitionId:
            "double-rainbow-speed",

          name: "双重彩虹·加速",
          icon: "速",
          tag: "正面",
          stacking: "independent",
          duration: 3,

          description:
            "速度增加20%。",

          percentModifiers: {
            speed: 0.2,
          },
        },
      );

      addLog(
        state,
        `${player.name}的速度增加20%，持续3回合。`,
      );

      gainCharge(state, player, 1);
    }
  }

  if (
    action === "skill" &&
    targetId
  ) {
    const target =
      getUnit(state, targetId);

    if (!target || !target.alive) {
      return state;
    }

    const result = dealDamage(
      state,
      player.id,
      target.id,
      1.6,
      "physical",
    );

    addLog(
      state,
      `${player.name}使用雨过天晴，对${target.name}造成${result.damage}点物理伤害。`,
    );

    if (target.alive) {
      addImbalance(
        state,
        target.id,
        1,
      );

      addLog(
        state,
        `${target.name}附加1层失衡。`,
      );
    }

    if (result.defeated) {
      addLog(
        state,
        `${target.name}失去战斗能力。`,
      );
    }
  }

  if (
    action === "charged-skill"
  ) {
    if (
      player.charge <
      player.maxCharge
    ) {
      addLog(
        state,
        "蓄能槽尚未充满，无法使用随风而动。",
      );

      return state;
    }

    const healAmount =
      Math.round(
        player.maxHp * 0.2,
      );

    const actualHeal = restoreHp(
      state,
      player.id,
      player.id,
      healAmount,
    );

    addStatus(
      state,
      player.id,
      {
        definitionId:
          "riding-the-wind",

        name: "乘风",
        icon: "乘",
        tag: "特殊",
        stacking: "replace",
        duration: 3,

        description:
          "自身行动结束时，根据当前速度与基础速度的比值，附加持续3回合的速度增加、攻击力增加。",

        hookIds: [
          "riding-the-wind-action-end",
        ],
      },
    );

    addLog(
      state,
      `${player.name}使用随风而动，恢复${actualHeal}点生命并获得乘风3回合，蓄能-1。`,
    );
  }

  if (action === "burst") {
    if (
      player.charge <
      player.maxCharge
    ) {
      addLog(
        state,
        "蓄能槽尚未充满，无法使用雨天是勇者的诞生！",
      );

      return state;
    }

    const burstBuffs = [
      {
        stat: "attack" as const,
        name: "勇者诞生·攻击",
        icon: "攻",
      },
      {
        stat: "defense" as const,
        name: "勇者诞生·防御",
        icon: "防",
      },
      {
        stat: "speed" as const,
        name: "勇者诞生·速度",
        icon: "速",
      },
    ];

    for (const buff of burstBuffs) {
      addStatus(
        state,
        player.id,
        {
          definitionId:
            `hero-born-${buff.stat}`,

          name: buff.name,
          icon: buff.icon,
          tag: "正面",
          stacking: "replace",
          duration: 3,

          description:
            `${buff.name}增加30%，持续3回合。`,

          percentModifiers: {
            [buff.stat]: 0.3,
          },
        },
      );
    }

    const drawSword =
      getStatusByDefinition(
        player,
        "draw-sword",
      );

    if (drawSword) {
      drawSword.data.cooldownActions =
        0;

      addLog(
        state,
        `${player.name}的拔剑立即完成冷却。`,
      );
    } else {
      addStatus(
        state,
        player.id,
        {
          definitionId:
            "draw-sword",

          name: "拔剑",
          icon: "拔",
          tag: "特殊",
          duration: -1,

          description:
            "敌人将要使用蓄能技能或蓄能爆发时，取消该行动并使自身获得1次额外行动。触发后需要经过自身7次行动才能再次触发。",

          hookIds: [
            "draw-sword-intercept",
            "draw-sword-cooldown",
          ],

          data: {
            cooldownActions: 0,
          },
        },
      );

      addLog(
        state,
        `${player.name}获得永久状态拔剑。`,
      );
    }

    addLog(
      state,
      `${player.name}使用雨天是勇者的诞生！攻击、防御和速度增加30%，持续3回合。`,
    );
  }

  const actionEvent =
    emitBattleEvent(state, {
      type: "action-used",
      actorId: player.id,
      actionId: action,
      repeatCount: 0,
    });

  if (action === "burst") {
    const repeatCount =
      actionEvent.repeatCount + repriseCount;

    for (
      let repeatIndex = 0;
      repeatIndex < repeatCount;
      repeatIndex += 1
    ) {
      for (const buff of [
        ["attack", "勇者诞生·攻击", "攻"],
        ["defense", "勇者诞生·防御", "防"],
        ["speed", "勇者诞生·速度", "速"],
      ] as const) {
        addStatus(
          state,
          player.id,
          {
            definitionId: `hero-born-${buff[0]}`,
            name: buff[1],
            icon: buff[2],
            tag: "正面",
            stacking: "replace",
            duration: 3,
            description:
              `${buff[1]}增加30%，持续3回合。`,
            percentModifiers: {
              [buff[0]]: 0.3,
            },
          },
        );
      }
    }
  }

  applyWeaponChargeRule(state, player, action);
  player.actionsTaken += 1;

  if (checkStandardVictory(state)) {
    return state;
  }

  checkTeleportCondition(state);

  return finishOneAction(state);
}

export function performPlayerAction(
  originalState: BattleState,
  actorId: string,
  action: PlayerActionId,
  targetId: string | null,
): BattleState {
  const state = copyState(originalState);

  if (
  state.status !== "playing" ||
  state.currentActorId !== actorId
) {
  return state;
}

const player = getUnit(
    state,
    actorId,
  );

  if (
    !player ||
    player.side !== "player" ||
    !player.alive ||
    player.apLeft <= 0
  ) {
    return state;
  }

  /*
 * 除主控之外的我方单位，
 * 都使用数据驱动的通用行动系统。
 */
if (player.role !== "player") {
  return performControlledCombatantAction(
    state,
    player,
    action,
    targetId,
  );
}

const restriction =
    checkActionRestriction(
      player,
      action,
    );

  if (!restriction.allowed) {
    addLog(
      state,
      restriction.reason ??
        `${player.name}无法使用这个行动。`,
    );

    return state;
  }
  const blueOriginWideCharge =
    state.equippedWeaponId === "weapon-blue-slayer" &&
    action === "charged-skill" &&
    player.weaponState?.blueForm !== "residual";

  if (targetIsRequired(action) && !blueOriginWideCharge) {
    const target = targetId
      ? getUnit(state, targetId)
      : undefined;

    if (
      !target ||
      !target.alive ||
      target.side !== "enemy"
    ) {
      addLog(
        state,
        "请先选择一个仍然存活的敌人。",
      );

      return state;
    }
  }

  const beforeActionEvent =
    emitBattleEvent(state, {
      type: "before-action-used",
      actorId: player.id,
      actionId: action,

      isChargedAction:
        action ===
          "charged-skill" ||
        action === "burst",

      canceled: false,
    });

  if (beforeActionEvent.canceled) {
    addLog(
      state,
      `${player.name}的行动被取消。`,
    );

    player.actionsTaken += 1;

    return finishOneAction(state);
  }

  if (
    state.equippedWeaponId === "weapon-endless-pale-sword" &&
    (action === "basic" ||
      action === "skill" ||
      action === "charged-skill" ||
      action === "burst")
  ) {
    return performPureWhiteWeaponAction(state, player, action, targetId);
  }

  if (
    state.equippedWeaponId ===
      "weapon-blue-slayer" &&
    (
      action === "basic" ||
      action === "skill" ||
      action === "charged-skill" ||
      action === "burst"
    )
  ) {
    return performBlueWeaponAction(
      state,
      player,
      action,
      targetId,
    );
  }

  if (
    state.equippedWeaponId ===
      "weapon-rainbow" &&
    (
      action === "basic" ||
      action === "skill" ||
      action ===
        "charged-skill" ||
      action === "burst"
    )
  ) {
    const repriseCount = consumeReprise(
      state,
      player,
      action,
    ) ? 1 : 0;

    return performRainbowWeaponAction(
      state,
      player,
      action,
      targetId,
      repriseCount,
    );
  }

  const repriseCount = consumeReprise(
    state,
    player,
    action,
  ) ? 1 : 0;

  if (action === "basic" && targetId) {
    const target = getUnit(state, targetId)!;

    const result = dealDamage(
      state,
      player.id,
      target.id,
      1,
      "physical",
    );

    addLog(
      state,
      `${player.name}对${target.name}发动普攻，造成${result.damage}点物理伤害。`,
    );

    if (result.guardConsumed) {
      addLog(
        state,
        `${target.name}的防御状态降低了本次伤害。`,
      );
    }

    if (result.defeated) {
      addLog(
        state,
        `${target.name}失去战斗能力。`,
      );
    }
  }

  if (action === "skill" && targetId) {
    const target = getUnit(state, targetId)!;

    const result = dealDamage(
      state,
      player.id,
      target.id,
      1.55,
      "physical",
    );

    addLog(
      state,
      `${player.name}使用技能，对${target.name}造成${result.damage}点物理伤害。`,
    );

    if (result.guardConsumed) {
      addLog(
        state,
        `${target.name}的防御状态降低了本次伤害。`,
      );
    }

    if (result.defeated) {
      addLog(
        state,
        `${target.name}失去战斗能力。`,
      );
    }
  }

  if (action === "charge") {
    const chargeResult = gainCharge(state, player, 2);

    addLog(
      state,
      `${player.name}进行蓄能，蓄能从${chargeResult.previous}变为${chargeResult.current}。`,
    );
  }

  if (
    action === "charged-skill" &&
    targetId
  ) {
    if (player.charge < player.maxCharge) {
      addLog(
        state,
        "蓄能槽尚未充满，无法使用蓄能技能。",
      );

      return state;
    }

    const target = getUnit(state, targetId)!;

    const result = dealDamage(
      state,
      player.id,
      target.id,
      2.1,
      "physical",
    );

    addLog(
      state,
      `${player.name}使用蓄能技能，对${target.name}造成${result.damage}点物理伤害，蓄能-1。`,
    );

    if (result.guardConsumed) {
      addLog(
        state,
        `${target.name}的防御状态降低了本次伤害。`,
      );
    }

    if (result.defeated) {
      addLog(
        state,
        `${target.name}失去战斗能力。`,
      );
    }
  }

 if (action === "burst") {
    if (
      player.charge <
      player.maxCharge
    ) {
      addLog(
        state,
        "蓄能槽尚未充满，无法使用蓄能爆发。",
      );

      return state;
    }

    executePlayerBurst(
      state,
      player,
      false,
    );

    for (
      let repeatIndex = 0;
      repeatIndex < repriseCount;
      repeatIndex += 1
    ) {
      executePlayerBurst(
        state,
        player,
        true,
      );
    }

  }

  if (action === "item") {
    if (state.itemUsesLeft <= 0) {
      addLog(
        state,
        "本场战斗的道具使用次数已经耗尽。",
      );

      return state;
    }

    const item = getItemById(
      state.equippedItemId,
    );

    if (!item) {
      addLog(
        state,
        `道具错误：没有找到ID为“${state.equippedItemId}”的道具。`,
      );

      return state;
    }

    if (
      item.battleEffect.type ===
      "heal-self"
    ) {
      const actualHeal = restoreHp(
        state,
        player.id,
        player.id,
        item.battleEffect.amount,
      );

      state.itemUsesLeft -= 1;

      addLog(
        state,
        `${player.name}使用${item.name}，恢复${actualHeal}点生命。本场剩余使用次数：${state.itemUsesLeft}。`,
      );
    }

    emitBattleEvent(state, {
      type: "item-used",
      actorId: player.id,
      itemId: item.id,
    });
  }

  if (action === "special") {
    player.guarded = true;

    addLog(
      state,
      `${player.name}进入防御状态，下一次受到的伤害降低。`,
    );
  }

 const actionEvent =
    emitBattleEvent(state, {
      type: "action-used",
      actorId: player.id,
      actionId: action,
      repeatCount: 0,
    });

  /*
   * 钩子要求重复蓄能爆发时，
   * 重复的爆发不再消耗蓄能，也不再次派发
   * action-used事件，避免无限触发。
   */
  if (
    action === "burst" &&
    actionEvent.repeatCount > 0
  ) {
    for (
      let repeatIndex = 0;
      repeatIndex <
      actionEvent.repeatCount;
      repeatIndex += 1
    ) {
      executePlayerBurst(
        state,
        player,
        true,
      );
    }
  }

  applyWeaponChargeRule(state, player, action);

  player.actionsTaken += 1;

  if (checkStandardVictory(state)) {
    return state;
  }

  checkTeleportCondition(state);

  return finishOneAction(state);
}


/**
 * 按照单位数据中的AI行动序列选择行动。
 */
function chooseEnemyAction(
  enemy: BattleUnit,
): CombatActionDefinition | undefined {
  const definition =
    getCombatantDefinition(
      enemy.role,
    );

  if (!definition) {
    return undefined;
  }

  const ai = definition.ai;

  if (!ai) {
    return definition.actions.find(
      (action) =>
        canUseDefinedAction(
          enemy,
          action,
        ),
    );
  }

  const isFullCharge =
    enemy.charge >= enemy.maxCharge;

  const pattern =
    isFullCharge &&
    ai.fullChargePattern.length > 0
      ? ai.fullChargePattern
      : ai.normalPattern;

  if (pattern.length === 0) {
    return definition.actions.find(
      (action) =>
        canUseDefinedAction(
          enemy,
          action,
        ),
    );
  }

  const startingIndex =
    isFullCharge
      ? enemy.fullChargeActionsUsed
      : enemy.actionsTaken;

  /*
   * 如果预定行动当前不可用，
   * 就继续检查序列中的下一个行动。
   */
  for (
    let offset = 0;
    offset < pattern.length;
    offset += 1
  ) {
    const patternIndex =
      (
        startingIndex +
        offset
      ) % pattern.length;

    const actionId =
      pattern[patternIndex];

    const action =
      getCombatantAction(
        enemy.role,
        actionId,
      );

    if (
      action &&
      canUseDefinedAction(
        enemy,
        action,
      )
    ) {
      return action;
    }
  }

  return definition.actions.find(
    (action) =>
      canUseDefinedAction(
        enemy,
        action,
      ),
  );
}

export function performEnemyAction(
  originalState: BattleState,
): BattleState {
  const state =
    copyState(originalState);

  if (
    state.status !== "playing" ||
    !state.currentActorId
  ) {
    return state;
  }

  const actor = getUnit(
    state,
    state.currentActorId,
  );

  if (
    !actor ||
    !actor.alive ||
    actor.side !== "enemy"
  ) {
    return state;
  }

  const player =
    getUnit(state, "player");

  if (!player || !player.alive) {
    return state;
  }

  /*
   * 这是教程场景本身的特殊胜利条件，
   * 不属于魔将的普通战斗技能。
   */
  if (
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

  const selectedAction =
    chooseEnemyAction(actor);

  if (!selectedAction) {
    addLog(
      state,
      `行动错误：没有找到${actor.name}可以使用的行动。`,
    );

    actor.actionsTaken += 1;

    return finishOneAction(state);
  }

  console.log("[自动行动]", {
    name: actor.name,
    action: selectedAction.id,
    apLeft: actor.apLeft,
    nextActionAt:
      actor.nextActionAt,
    actionSerial:
      state.actionSerial,
  });

  const beforeActionEvent =
    emitBattleEvent(state, {
      type: "before-action-used",
      actorId: actor.id,

      actionId:
        selectedAction.id,

      isChargedAction:
        selectedAction.id ===
          "charged-skill" ||
        selectedAction.id ===
          "burst",

      canceled: false,
    });

  if (beforeActionEvent.canceled) {
    addLog(
      state,
      `${actor.name}的${selectedAction.name}被取消。`,
    );

    actor.actionsTaken += 1;

    return finishOneAction(state);
  }

  const actionSucceeded =
    executeDefinedAction(
      state,
      actor,
      selectedAction,
      null,
    );

  if (!actionSucceeded) {
    actor.actionsTaken += 1;

    return finishOneAction(state);
  }

  emitBattleEvent(state, {
    type: "action-used",
    actorId: actor.id,
    actionId:
      selectedAction.id,
    repeatCount: 0,
  });

  actor.actionsTaken += 1;

  if (
    player.hp <= 0 ||
    !player.alive
  ) {
    player.hp = 0;
    player.alive = false;

    state.status = "lost";
    state.currentActorId = null;
    state.actionSerial += 1;

    addLog(
      state,
      `${player.name}失去战斗能力。`,
    );

    return state;
  }

  return finishOneAction(state);
}

export function getCurrentActor(
  state: BattleState,
) {
  if (!state.currentActorId) {
    return undefined;
  }

  return getUnit(state, state.currentActorId);
}

function getPureWhiteRandomAilment(
  state: BattleState,
  target: BattleUnit,
  source: BattleUnit,
): void {
  const candidates = [
    ["burning", 0.5],
    ["poison", 5],
    ["bleeding", 2],
    ["frozen", 0],
    ["paralysis", 1],
  ] as const;
  const missing = candidates.filter(
    ([definitionId]) => !hasStatus(target, definitionId),
  );
  const pool = missing.length > 0 ? missing : candidates;
  const [definitionId, value] = pool[
    Math.floor(Math.random() * pool.length)
  ];

  if (definitionId === "burning") {
    addBuiltInStatus(state, target.id, "burning", {
      value: getEffectiveBattleStat(source, "attack") * value,
      duration: 1,
    });
  } else if (definitionId === "poison") {
    addBuiltInStatus(state, target.id, "poison", { value, duration: 1 });
  } else if (definitionId === "bleeding") {
    addBuiltInStatus(state, target.id, "bleeding", { value, duration: 1 });
  } else {
    addBuiltInStatus(state, target.id, definitionId, { duration: 1 });
  }
}

function performPureWhiteWeaponAction(
  state: BattleState,
  player: BattleUnit,
  action: PlayerActionId,
  targetId: string | null,
): BattleState {
  const target = targetId ? getUnit(state, targetId) : undefined;

  if (action === "basic" && target?.alive) {
    addBlueStatus(state, player.id, "star-enchantment", "星附魔", "星", "每次攻击随机附加一种以下异常1回合：燃烧（攻击力0.5倍），中毒5，流血2，麻痹，冻结。", { duration: 2, tags: ["特殊"] });
    for (let hit = 0; hit < 2; hit += 1) {
      const result = dealDamage(state, player.id, target.id, 0.5, "physical");
      if (target.alive) {
        getPureWhiteRandomAilment(state, target, player);
      }
      addLog(state, `${player.name}使用风暴之星造成${result.damage}点物理伤害。`);
    }
  }

  if (action === "skill" && target?.alive) {
    addBlueStatus(state, target.id, "damage-taken-increase", "受伤增加", "伤", "受到的伤害增加35%。", { duration: 2, tags: ["弱化"], stacking: "independent" });
    getPureWhiteRandomAilment(state, target, player);
  }

  if (action === "charged-skill") {
    for (const enemy of state.units.filter((unit) => unit.side === "enemy" && unit.alive)) {
      addBuiltInStatus(state, enemy.id, "taunt", { duration: 2 });
    }
    addBuiltInStatus(state, player.id, "protector", { duration: 2 });
    const ally = state.units.find((unit) => unit.side === "player" && unit.id !== player.id && unit.alive);
    if (ally) {
      addBuiltInStatus(state, ally.id, "damage-nullification", { duration: 2, stacks: 4 });
    }
  }

  if (action === "burst" && target?.alive) {
    for (const enemy of state.units.filter((unit) => unit.side === "enemy" && unit.alive)) {
      const multiplier = enemy.id === target.id ? 3 : 1;
      dealDamage(state, player.id, enemy.id, multiplier, "physical");
      const types = new Set(
        enemy.statuses
          .filter((status) => getStatusTags(status).some((tag) => tag === "异常" || tag === "DoT"))
          .map((status) => status.definitionId),
      );
      for (const _type of types) {
        dealFixedDamage(state, player.id, enemy.id, getEffectiveBattleStat(player, "attack") * 0.5, "异常追加伤害");
      }
    }
  }

  emitBattleEvent(state, { type: "action-used", actorId: player.id, actionId: action, repeatCount: 0 });
  applyWeaponChargeRule(state, player, action);
  player.actionsTaken += 1;
  return finishOneAction(state);
}

/** 武器行动的基础蓄能规则。武器效果不应各自重复实现这部分规则。 */
function applyWeaponChargeRule(
  state: BattleState,
  unit: BattleUnit,
  action: PlayerActionId,
): void {
  if (action === "basic") {
    if (!basicChargeIsLocked(unit)) {
      gainCharge(state, unit, 1);
    }
    return;
  }

  if (action === "charged-skill") {
    unit.charge = Math.max(0, unit.charge - 1);
    return;
  }

  if (action === "burst") {
    unit.charge = 0;
  }
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