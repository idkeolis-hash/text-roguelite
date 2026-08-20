import type {
  BattleState,
  BattleUnit,
} from "./game";

export type StatusTag =
  | "特殊"
  | "正面"
  | "弱化"
  | "异常"
  | "DoT";

  /**
 * 同种状态再次添加时的处理方式。
 *
 * replace：
 * 不可叠加。删除所有同definitionId的旧实例，
 * 然后创建新实例。新状态无视旧状态的强度和持续时间。
 *
 * independent：
 * 可叠加。完全忽略已有状态，直接创建新的独立实例。
 *
 * layers：
 * 层数增加。存在同definitionId状态时只增加层数，
 * 不修改原状态的持续时间、数值、说明、钩子和额外数据。
 */
export type StatusStacking =
  | "replace"
  | "independent"
  | "layers";

export type StatusModifiableStat =
  | "attack"
  | "defense"
  | "speed";

export interface BattleStatusEffect {
  /**
   * 本次状态实例的唯一ID。
   */
  id: string;

  /**
   * 状态种类ID。
   *
   * 同一种状态的多个独立实例可以拥有相同definitionId。
   */
  definitionId: string;

  name: string;

  /**
   * 界面上显示的单字。
   */
  icon: string;

  description: string;
  tag: StatusTag;

  /**
   * -1表示永久状态。
   * 大于0时，每次回合结束减少1。
   */
  duration: number;

  /**
   * 状态层数。
   */
  stacks: number;

  /**
   * 定值属性变化。
   */
  fixedModifiers: Partial<
    Record<
      StatusModifiableStat,
      number
    >
  >;

  /**
   * 百分比属性变化。
   *
   * 20%填写0.2。
   */
  percentModifiers: Partial<
    Record<
      StatusModifiableStat,
      number
    >
  >;

  /**
   * 状态提供的战斗钩子。
   */
  hookIds: string[];

  /**
   * 特殊状态保存的额外数据。
   */
  data: Record<
    string,
    number | string | boolean
  >;
}

export interface AddStatusInput {
  definitionId: string;
  name: string;
  icon: string;
  description: string;
  tag: StatusTag;

  /**
   * 状态叠加方式，默认为replace。
   *
   * replace：完全覆盖同definitionId的旧状态。
   * independent：创建新的独立状态实例。
   * layers：只增加同definitionId状态的层数。
   */
  stacking?: StatusStacking;

  duration?: number;
  stacks?: number;

  fixedModifiers?: Partial<
    Record<
      StatusModifiableStat,
      number
    >
  >;

  percentModifiers?: Partial<
    Record<
      StatusModifiableStat,
      number
    >
  >;

  hookIds?: string[];

  data?: Record<
    string,
    number | string | boolean
  >;
}

/**
 * 向指定单位添加一个新的状态实例。
 *
 * 默认永久存在。
 */
export function addStatus(
  state: BattleState,
  targetId: string,
  input: AddStatusInput,
): BattleStatusEffect | undefined {
  const target = state.units.find(
    (unit) => unit.id === targetId,
  );

  if (!target) {
    return undefined;
  }

  const status: BattleStatusEffect = {
    id:
      `status-${state.nextStatusId}`,

    definitionId:
      input.definitionId,

    name: input.name,
    icon: input.icon,
    description: input.description,
    tag: input.tag,

    duration:
      input.duration ?? -1,

    stacks:
      Math.max(
        1,
        Math.floor(
          input.stacks ?? 1,
        ),
      ),

    fixedModifiers: {
      ...(input.fixedModifiers ?? {}),
    },

    percentModifiers: {
      ...(input.percentModifiers ?? {}),
    },

    hookIds: [
      ...(input.hookIds ?? []),
    ],

    data: {
      ...(input.data ?? {}),
    },
  };

  const stacking = input.stacking ?? "replace";
  const matchingStatuses = target.statuses.filter(
    (existingStatus) =>
      existingStatus.definitionId ===
      input.definitionId,
  );

  if (stacking === "layers") {
    const existingStatus = matchingStatuses[0];

    if (existingStatus) {
      existingStatus.stacks += status.stacks;

      for (const duplicate of matchingStatuses.slice(1)) {
        existingStatus.stacks += duplicate.stacks;
      }

      target.statuses = target.statuses.filter(
        (candidate) =>
          candidate.definitionId !==
            input.definitionId ||
          candidate.id === existingStatus.id,
      );

      return existingStatus;
    }
  }

  if (stacking === "replace") {
    target.statuses = target.statuses.filter(
      (existingStatus) =>
        existingStatus.definitionId !==
        input.definitionId,
    );
  }

  state.nextStatusId += 1;

  target.statuses.push(status);

  return status;
}

export function getStatusByDefinition(
  unit: BattleUnit,
  definitionId: string,
): BattleStatusEffect | undefined {
  return unit.statuses.find(
    (status) =>
      status.definitionId ===
      definitionId,
  );
}

export function getStatusesByDefinition(
  unit: BattleUnit,
  definitionId: string,
): BattleStatusEffect[] {
  return unit.statuses.filter(
    (status) =>
      status.definitionId ===
      definitionId,
  );
}

/**
 * 计算经过状态修正后的实际属性。
 *
 * 公式：
 * （白值 + 所有定值变化之和）
 * ×（1 + 所有百分比变化之和）
 */
export function getEffectiveBattleStat(
  unit: BattleUnit,
  stat: StatusModifiableStat,
): number {
  const baseValue = unit[stat];

  const fixedChange =
    unit.statuses.reduce(
      (total, status) =>
        total +
        (
          status.fixedModifiers[
            stat
          ] ?? 0
        ),
      0,
    );

  const percentChange =
    unit.statuses.reduce(
      (total, status) =>
        total +
        (
          status.percentModifiers[
            stat
          ] ?? 0
        ),
      0,
    );

  return Math.max(
    0,
    (baseValue + fixedChange) *
      (1 + percentChange),
  );
}

/**
 * 添加失衡。
 *
 * 失衡会合并为同一个状态并增加层数。
 */
export function addImbalance(
  state: BattleState,
  targetId: string,
  layers = 1,
): void {
  if (layers <= 0) {
    return;
  }

  addStatus(
    state,
    targetId,
    {
      definitionId: "imbalance",
      name: "失衡",
      icon: "失",
      tag: "异常",
      stacking: "layers",
      duration: -1,
      stacks: layers,

      description:
        "蓄能的增加失效。每当此效果阻止一次蓄能增加时，失去1层。",
    },
  );
}

/**
 * 尝试由失衡阻止蓄能增加。
 *
 * 返回true表示本次蓄能已被阻止。
 */
export function consumeImbalanceForCharge(
  state: BattleState,
  target: BattleUnit,
): boolean {
  const imbalance =
    getStatusByDefinition(
      target,
      "imbalance",
    );

  if (!imbalance) {
    return false;
  }

  imbalance.stacks -= 1;

  state.logs.push(
    `${target.name}受到失衡影响，本次蓄能增加失效。`,
  );

  if (imbalance.stacks <= 0) {
    target.statuses =
      target.statuses.filter(
        (status) =>
          status.id !==
          imbalance.id,
      );

    state.logs.push(
      `${target.name}的失衡已经解除。`,
    );
  } else {
    state.logs.push(
      `${target.name}还剩${imbalance.stacks}层失衡。`,
    );
  }

  return true;
}

/**
 * 回合结束时减少状态持续时间。
 */
export function tickStatusDurations(
  state: BattleState,
): void {
  for (const unit of state.units) {
    const expiredNames: string[] = [];

    for (const status of unit.statuses) {
      if (status.duration <= 0) {
        continue;
      }

      status.duration -= 1;

      if (status.duration <= 0) {
        expiredNames.push(status.name);
      }
    }

    unit.statuses =
      unit.statuses.filter(
        (status) =>
          status.duration !== 0,
      );

    for (const name of expiredNames) {
      state.logs.push(
        `${unit.name}的${name}状态结束了。`,
      );
    }
  }

  if (state.logs.length > 100) {
    state.logs =
      state.logs.slice(-100);
  }
}