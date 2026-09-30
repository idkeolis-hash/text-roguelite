import type {
  BattleState,
  BattleUnit,
} from "./game";

export type StatusTag =
  | "特殊"
  | "正面"
  | "强化"
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
  tags: StatusTag[];
  tag?: StatusTag;

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

export interface RebirthStatusPolicy {
  preserveDefinitionIds?: string[];
}

export interface AddStatusInput {
  definitionId: string;
  name: string;
  icon: string;
  description: string;
  tags?: StatusTag[];
  tag?: StatusTag;

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

export type BuiltInStatusId =
  | "burning"
  | "poison"
  | "bleeding"
  | "confusion"
  | "regeneration"
  | "healing-blocked"
  | "frozen"
  | "paralysis"
  | "invincible"
  | "rebirth"
  | "stealth"
  | "fear"
  | "steadfast"
  | "marked"
  | "guided-pin"
  | "charge-loss-nullification"
  | "reprise"
  | "sleep"
  | "etched"
  | "taunt"
  | "protector"
  | "counter"
  | "damage-nullification"
  | "ailment-nullification"
  | "weaken-nullification"
  | "negative-nullification"
  | "purge-nullification"
  | "pursuit-damage"
  | "disarmed"
  | "silenced"
  | "charge-locked"
  | "sealed";

export interface AddBuiltInStatusOptions {
  /**
   * -1表示永久。
   */
  duration?: number;

  /**
   * 燃烧、中毒、流血、再生、反击和追伤使用。
   *
   * 百分比直接填写百分数：
   * 5表示5%。
   */
  value?: number;

  percent?: boolean;

  /**
   * 层数型状态使用。
   */
  stacks?: number;

  /**
   * 嘲讽、DoT等需要记录来源的状态使用。
   */
  sourceId?: string;
}

export function isNegativeStatusTag(
  tag: StatusTag,
): boolean {
  return (
    tag === "弱化" ||
    tag === "异常" ||
    tag === "DoT"
  );
}

export function getStatusTags(
  status: Pick<BattleStatusEffect, "tags" | "tag">,
): StatusTag[] {
  return status.tags?.length
    ? status.tags
    : status.tag
      ? [status.tag]
      : [];
}

function isNegativeStatus(
  status: Pick<BattleStatusEffect, "tags" | "tag">,
): boolean {
  return getStatusTags(status).some(
    isNegativeStatusTag,
  );
}

function isPurgeableNegativeStatus(
  status: Pick<BattleStatusEffect, "tags" | "tag">,
): boolean {
  return (
    !getStatusTags(status).includes("特殊") &&
    isNegativeStatus(status)
  );
}

export function hasStatus(
  unit: BattleUnit,
  definitionId: string,
): boolean {
  return unit.statuses.some(
    (status) =>
      status.definitionId ===
      definitionId,
  );
}

export function getStatusNumber(
  status: BattleStatusEffect,
  key: string,
  fallback = 0,
): number {
  const value = status.data[key];

  return typeof value === "number"
    ? value
    : fallback;
}

export function removeStatusInstance(
  unit: BattleUnit,
  statusId: string,
): void {
  unit.statuses = unit.statuses.filter(
    (status) => status.id !== statusId,
  );
}

/**
 * 消耗一个层数型状态。
 *
 * 返回true表示成功消耗。
 */
export function consumeStatusLayer(
  state: BattleState,
  unit: BattleUnit,
  definitionId: string,
): boolean {
  const status = getStatusByDefinition(
    unit,
    definitionId,
  );

  if (!status) {
    return false;
  }

  status.stacks -= 1;

  if (status.stacks <= 0) {
    removeStatusInstance(
      unit,
      status.id,
    );

    state.logs.push(
      `${unit.name}的${status.name}已经耗尽。`,
    );
  }

  return true;
}

function createBuiltInStatusInput(
  definitionId: BuiltInStatusId,
  options: AddBuiltInStatusOptions,
): AddStatusInput {
  const duration = options.duration ?? -1;
  const value = Math.max(
    0,
    options.value ?? 0,
  );
  const stacks = Math.max(
    1,
    Math.floor(options.stacks ?? 1),
  );

  switch (definitionId) {
    case "burning":
      return {
        definitionId,
        name: "燃烧",
        icon: "燃",
        tag: "DoT",
        stacking: "independent",
        duration,
        description:
          `回合结束时受到${value}点能量伤害。`,
        data: {
          value,
          sourceId:
            options.sourceId ?? "",
        },
      };

    case "poison":
      return {
        definitionId,
        name: "中毒",
        icon: "毒",
        tag: "DoT",
        stacking: "independent",
        duration,
        description:
          `回合结束时受到最大生命值${value}%的能量伤害。`,
        data: {
          value,
          sourceId:
            options.sourceId ?? "",
        },
      };

    case "bleeding":
      return {
        definitionId,
        name: "流血",
        icon: "血",
        tag: "DoT",
        stacking: "independent",
        duration,
        description:
          `行动开始时受到当前生命值${value}%的物理伤害。`,
        data: {
          value,
          sourceId:
            options.sourceId ?? "",
        },
      };

    case "confusion":
      return {
        definitionId,
        name: "困惑",
        icon: "惑",
        tag: "异常",
        stacking: "replace",
        duration,
        description:
          "行动开始时有50%概率取消行动，并受到等同于自身攻击力的伤害。",
      };

    case "regeneration":
      return {
        definitionId,
        name: "再生",
        icon: "生",
        tag: "正面",
        stacking: "independent",
        duration,
        description:
          `回合开始时恢复最大生命值${value}%的生命。`,
        data: {
          value,
          sourceId:
            options.sourceId ?? "",
        },
      };

    case "healing-blocked":
      return {
        definitionId,
        name: "禁疗",
        icon: "禁",
        tag: "异常",
        stacking: "replace",
        duration,
        description:
          "受到的所有生命回复效果变为0。",
      };

    case "frozen":
      return {
        definitionId,
        name: "冻结",
        icon: "冻",
        tag: "异常",
        stacking: "replace",
        duration,
        description:
          "无法行动。",
      };

    case "paralysis":
      return {
        definitionId,
        name: "麻痹",
        icon: "麻",
        tag: "异常",
        stacking: "layers",
        duration,
        stacks,
        description:
          "行动时取消本次行动并失去1层。",
      };

    case "invincible":
      return {
        definitionId,
        name: "无敌",
        icon: "无",
        tag: "正面",
        stacking: "replace",
        duration,
        description:
          "不受到伤害和负面状态。附加时解除所有负面状态。",
      };

    case "rebirth":
      return {
        definitionId,
        name: "重生",
        icon: "生",
        tags: ["特殊", "强化"],
        stacking: "layers",
        duration,
        stacks,
        description:
          `死亡时，以最大生命值${value}%复活；复活后失去所有状态。`,
        data: {
          value,
          percent: options.percent ?? false,
        },
      };

    case "stealth":
      return {
        definitionId,
        name: "隐身",
        icon: "隐",
        tags: ["强化"],
        stacking: "replace",
        duration,
        description:
          "存在其他盟友时，无法成为单体攻击目标。",
      };

    case "fear":
      return {
        definitionId,
        name: "恐惧",
        icon: "惧",
        tags: ["异常"],
        stacking: "layers",
        duration,
        stacks,
        description:
          "行动时有50%概率取消行动，然后解除1层。",
      };

    case "steadfast":
      return {
        definitionId,
        name: "坚持",
        icon: "坚",
        tags: ["强化"],
        stacking: "layers",
        duration,
        stacks,
        description:
          `受到致死伤害时保留${value}点生命，然后解除1层。`,
        data: { value },
      };

    case "marked":
      return {
        definitionId,
        name: "标记",
        icon: "标",
        tags: ["异常"],
        stacking: "replace",
        duration,
        description:
          "守护对被标记目标失效，且无法应用伤害无效。",
      };

    case "guided-pin":
      return {
        definitionId,
        name: "引路针",
        icon: "针",
        tags: ["特殊"],
        stacking: "layers",
        duration: -1,
        stacks,
        description:
          "其他盟友蓄能爆发时，层数+1。层数首次到达3后，每回合行动次数+1、蓄能槽减少2（至少为2）。层数为4时，重置为1，自身附加重生50。",
      };

    case "charge-loss-nullification":
      return {
        definitionId,
        name: "蓄能减少无效",
        icon: "蓄",
        tags: ["强化"],
        stacking: "layers",
        duration,
        stacks,
        description: "下一次蓄能减少效果无效，然后解除1层。",
      };

    case "reprise":
      return {
        definitionId,
        name: "复起",
        icon: "复",
        tag: "正面",
        stacking: "layers",
        duration,
        stacks,
        description:
          "下一次由武器提供的行动，其效果执行2次。触发后失去1层。",
      };

    case "sleep":
      return {
        definitionId,
        name: "睡眠",
        icon: "眠",
        tag: "异常",
        stacking: "replace",
        duration,
        description:
          "无法行动。每次受到伤害时，持续时间额外减少1。",
      };

    case "etched":
      return {
        definitionId,
        name: "蚀刻",
        icon: "蚀",
        tag: "异常",
        stacking: "replace",
        duration,
        description:
          "无法受到蚀刻以外的状态。",
      };

    case "taunt":
      return {
        definitionId,
        name: "嘲讽",
        icon: "嘲",
        tag: "异常",
        stacking: "replace",
        duration,
        description:
          "进行单体攻击时，必须以嘲讽来源为目标。",
        data: {
          sourceId:
            options.sourceId ?? "",
        },
      };

    case "protector":
      return {
        definitionId,
        name: "守护",
        icon: "护",
        tag: "正面",
        stacking: "replace",
        duration,
        description:
          "敌人进行单体攻击时，优先选择自身作为目标。",
      };

    case "counter":
      return {
        definitionId,
        name: "反击",
        icon: "反",
        tag: "正面",
        stacking: "independent",
        duration,
        description:
          `受到攻击时，对攻击来源发动${value}倍率的攻击。`,
        data: {
          value,
        },
      };

    case "damage-nullification":
      return {
        definitionId,
        name: "伤害无效",
        icon: "伤",
        tag: "正面",
        stacking: "layers",
        duration,
        stacks,
        description:
          "将要受到伤害时，取消该次伤害并失去1层。",
      };

    case "ailment-nullification":
      return {
        definitionId,
        name: "异常无效",
        icon: "异",
        tag: "正面",
        stacking: "layers",
        duration,
        stacks,
        description:
          "将要受到异常状态时，取消该状态并失去1层。",
      };

    case "weaken-nullification":
      return {
        definitionId,
        name: "弱化无效",
        icon: "弱",
        tag: "正面",
        stacking: "layers",
        duration,
        stacks,
        description:
          "将要受到弱化状态时，取消该状态并失去1层。",
      };

    case "negative-nullification":
      return {
        definitionId,
        name: "负面无效",
        icon: "负",
        tag: "正面",
        stacking: "layers",
        duration,
        stacks,
        description:
          "将要受到任意负面状态时，取消该状态并失去1层。",
      };

    case "purge-nullification":
      return {
        definitionId,
        name: "净化无效",
        icon: "净",
        tag: "正面",
        stacking: "layers",
        duration,
        stacks,
        description:
          "敌人将要解除自身正面状态时，取消该效果并失去1层。",
      };

    case "pursuit-damage":
      return {
        definitionId,
        name: "追伤",
        icon: "追",
        tag: "正面",
        stacking: "independent",
        duration,
        description:
          `攻击命中时，额外造成${value}点固定伤害。`,
        data: {
          value,
        },
      };

    case "disarmed":
      return {
        definitionId,
        name: "缴械",
        icon: "缴",
        tag: "异常",
        stacking: "replace",
        duration,
        description:
          "无法使用普攻和蓄能爆发。",
      };

    case "silenced":
      return {
        definitionId,
        name: "沉默",
        icon: "默",
        tag: "异常",
        stacking: "replace",
        duration,
        description:
          "无法使用技能和蓄能技能。",
      };

    case "charge-locked":
      return {
        definitionId,
        name: "锁定",
        icon: "锁",
        tag: "异常",
        stacking: "replace",
        duration,
        description:
          "无法使用蓄能，也无法通过普攻获得蓄能。",
      };

    case "sealed":
      return {
        definitionId,
        name: "封印",
        icon: "封",
        tag: "异常",
        stacking: "replace",
        duration,
        description:
          "无法使用蓄能技能和蓄能爆发。",
      };
  }
}

export function addBuiltInStatus(
  state: BattleState,
  targetId: string,
  definitionId: BuiltInStatusId,
  options: AddBuiltInStatusOptions = {},
): BattleStatusEffect | undefined {
  if (definitionId === "burning") {
    return addBurningStatus(
      state,
      targetId,
      options,
    );
  }

  return addStatus(
    state,
    targetId,
    createBuiltInStatusInput(
      definitionId,
      options,
    ),
  );
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

  if (
    input.definitionId === "damage-nullification" &&
    hasStatus(target, "marked")
  ) {
    state.logs.push(
      `${target.name}受到标记影响，无法获得伤害无效。`,
    );
    return undefined;
  }

  if (
    input.definitionId === "burning" &&
    hasStatus(target, "attached-wind")
  ) {
    target.statuses = target.statuses.filter(
      (status) => status.definitionId !== "attached-wind",
    );
    state.logs.push(`${target.name}的附风转化为燃烧。`);
  }

  if (
    input.definitionId === "burning" &&
    hasStatus(target, "erosion-fire")
  ) {
    const erosion = getStatusByDefinition(target, "erosion-fire");
    if (erosion) {
      erosion.stacks += 1;
      erosion.percentModifiers.attack =
        -Math.min(0.5, erosion.stacks * 0.05);
      erosion.description =
        `攻击力降低${Math.min(50, erosion.stacks * 5)}%，回合开始时有${Math.min(100, erosion.stacks * 20)}%概率附加禁疗1回合。`;
    }
  }

  /*
   * 蚀刻阻止除蚀刻本身以外的所有状态。
   */
  if (
    input.definitionId !== "etched" &&
    hasStatus(target, "etched")
  ) {
    state.logs.push(
      `${target.name}受到蚀刻影响，无法获得${input.name}。`,
    );

    return undefined;
  }

  const tags = input.tags?.length
    ? input.tags
    : input.tag
      ? [input.tag]
      : [];
  const isNegative = tags.some(
    isNegativeStatusTag,
  );

  /*
   * 无敌不消耗层数，直接拒绝所有负面状态。
   */
  if (
    isNegative &&
    hasStatus(target, "invincible")
  ) {
    state.logs.push(
      `${target.name}处于无敌状态，免疫了${input.name}。`,
    );

    return undefined;
  }

  /*
   * 异常无效也会阻止DoT。
   */
  if (
    (
      tags.includes("异常") ||
      tags.includes("DoT")
    ) &&
    consumeStatusLayer(
      state,
      target,
      "ailment-nullification",
    )
  ) {
    state.logs.push(
      `${target.name}的异常无效阻止了${input.name}。`,
    );

    return undefined;
  }

  if (
    tags.includes("弱化") &&
    consumeStatusLayer(
      state,
      target,
      "weaken-nullification",
    )
  ) {
    state.logs.push(
      `${target.name}的弱化无效阻止了${input.name}。`,
    );

    return undefined;
  }

  /*
   * 优先消耗更具体的异常无效或弱化无效；
   * 没有对应状态时才消耗负面无效。
   */
  if (
    isNegative &&
    consumeStatusLayer(
      state,
      target,
      "negative-nullification",
    )
  ) {
    state.logs.push(
      `${target.name}的负面无效阻止了${input.name}。`,
    );

    return undefined;
  }

  /*
   * 无敌附加成功前，解除已有负面状态。
   */
  if (input.definitionId === "invincible") {
    const removedNames =
      target.statuses
        .filter((status) =>
          isNegativeStatus(status),
        )
        .map((status) => status.name);

    target.statuses =
      target.statuses.filter(
        (status) =>
          !isNegativeStatus(status),
      );

    if (removedNames.length > 0) {
      state.logs.push(
        `${target.name}获得无敌，并解除了：${removedNames.join("、")}。`,
      );
    }
  }

  const status: BattleStatusEffect = {
    id:
      `status-${state.nextStatusId}`,

    definitionId:
      input.definitionId,

    name: input.name,
    icon: input.icon,
    description: input.description,
    tags: [...tags],
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
 * 返回true表示伤害被状态完全阻止。
 */
export function preventDamageByStatus(
  state: BattleState,
  target: BattleUnit,
): boolean {
  if (hasStatus(target, "invincible")) {
    state.logs.push(
      `${target.name}处于无敌状态，本次伤害为0。`,
    );

    return true;
  }

  if (
    !hasStatus(target, "marked") &&
    consumeStatusLayer(
      state,
      target,
      "damage-nullification",
    )
  ) {
    state.logs.push(
      `${target.name}的伤害无效取消了本次伤害。`,
    );

    return true;
  }

  return false;
}

export function addPersistentLayer(
  unit: BattleUnit,
  definitionId: string,
  stacks = 1,
): void {
  unit.persistentLayers ??= {};
  unit.persistentLayers[definitionId] =
    (unit.persistentLayers[definitionId] ?? 0) +
    Math.max(0, Math.floor(stacks));
}

function consumePersistentLayer(
  unit: BattleUnit,
  definitionId: string,
): boolean {
  const layers = unit.persistentLayers?.[definitionId] ?? 0;

  if (layers <= 0) {
    return false;
  }

  unit.persistentLayers![definitionId] = layers - 1;
  return true;
}

export function preventDefeatByStatus(
  state: BattleState,
  target: BattleUnit,
  policy: RebirthStatusPolicy = {},
): boolean {
  const steadfast = getStatusByDefinition(target, "steadfast");
  const persistentSteadfast = consumePersistentLayer(target, "steadfast");

  if (steadfast || persistentSteadfast) {
    const value = steadfast
      ? getStatusNumber(steadfast, "value")
      : 1;
    const percent = steadfast?.data.percent === true;
    const hp = percent
      ? Math.round(target.maxHp * value / 100)
      : value;

    if (steadfast) {
      consumeStatusLayer(state, target, "steadfast");
    }

    target.hp = Math.max(1, Math.min(target.maxHp, hp));
    state.logs.push(`${target.name}发动坚持，保留${target.hp}点生命。`);
    return true;
  }

  const rebirth = getStatusByDefinition(target, "rebirth");

  if (!rebirth) {
    return false;
  }

  const value = getStatusNumber(rebirth, "value");
  consumeStatusLayer(state, target, "rebirth");
  const preserveIds = new Set(
    policy.preserveDefinitionIds ?? [],
  );
  target.statuses = target.statuses.filter(
    (status) => preserveIds.has(status.definitionId),
  );
  target.hp = Math.max(1, Math.round(target.maxHp * value / 100));
  target.alive = true;
  state.logs.push(`${target.name}发动重生，以${target.hp}点生命复活。`);
  return true;
}

/**
 * 在单位真正受到大于0的伤害后调用。
 */
export function notifyStatusDamageTaken(
  state: BattleState,
  target: BattleUnit,
): void {
  const sleep =
    getStatusByDefinition(
      target,
      "sleep",
    );

  if (
    !sleep ||
    sleep.duration < 0
  ) {
    return;
  }

  sleep.duration -= 1;

  if (sleep.duration > 0) {
    state.logs.push(
      `${target.name}的睡眠持续时间因受到伤害而减少1。`,
    );

    return;
  }

  removeStatusInstance(
    target,
    sleep.id,
  );

  state.logs.push(
    `${target.name}因受到伤害而从睡眠中醒来。`,
  );
}

export interface ActionRestrictionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * 检查缴械、沉默、锁定和封印。
 *
 * item、special不受这些状态影响。
 */
export function checkActionRestriction(
  unit: BattleUnit,
  actionId: string,
): ActionRestrictionResult {
  if (
    hasStatus(unit, "disarmed") &&
    (
      actionId === "basic" ||
      actionId === "burst"
    )
  ) {
    return {
      allowed: false,
      reason:
        `${unit.name}受到缴械影响，无法使用这个行动。`,
    };
  }

  if (
    hasStatus(unit, "silenced") &&
    (
      actionId === "skill" ||
      actionId === "charged-skill"
    )
  ) {
    return {
      allowed: false,
      reason:
        `${unit.name}受到沉默影响，无法使用这个行动。`,
    };
  }

  if (
    hasStatus(unit, "charge-locked") &&
    actionId === "charge"
  ) {
    return {
      allowed: false,
      reason:
        `${unit.name}受到锁定影响，无法蓄能。`,
    };
  }

  if (
    hasStatus(unit, "sealed") &&
    (
      actionId === "charged-skill" ||
      actionId === "burst"
    )
  ) {
    return {
      allowed: false,
      reason:
        `${unit.name}受到封印影响，无法使用这个行动。`,
    };
  }

  return {
    allowed: true,
  };
}

/**
 * 返回true表示普攻蓄能被锁定阻止。
 */
export function basicChargeIsLocked(
  unit: BattleUnit,
): boolean {
  return hasStatus(
    unit,
    "charge-locked",
  );
}

/**
 * 触发复起并消耗1层。
 */
export function consumeReprise(
  state: BattleState,
  unit: BattleUnit,
  actionId: string,
): boolean {
  const isWeaponAction =
    actionId === "basic" ||
    actionId === "skill" ||
    actionId === "charge" ||
    actionId === "charged-skill" ||
    actionId === "burst";

  if (!isWeaponAction) {
    return false;
  }

  if (
    !consumeStatusLayer(
      state,
      unit,
      "reprise",
    )
  ) {
    return false;
  }

  state.logs.push(
    `${unit.name}发动复起，${actionId}的效果将执行2次。`,
  );

  return true;
}

/**
 * 嘲讽优先于守护。
 *
 * 只应该对单体攻击调用，不要对全体攻击调用。
 */
export function resolveForcedAttackTarget(
  state: BattleState,
  attacker: BattleUnit,
  intendedTarget: BattleUnit,
): BattleUnit {
  const taunt =
    getStatusByDefinition(
      attacker,
      "taunt",
    );

  const tauntSourceId =
    typeof taunt?.data.sourceId ===
    "string"
      ? taunt.data.sourceId
      : "";

  if (tauntSourceId) {
    const tauntSource =
      state.units.find(
        (unit) =>
          unit.id === tauntSourceId &&
          unit.alive &&
          unit.side !== attacker.side,
      );

    if (tauntSource) {
      return tauntSource;
    }
  }

  const protector =
    state.units
      .filter(
        (unit) =>
          unit.alive &&
          unit.side !== attacker.side &&
          !hasStatus(intendedTarget, "marked") &&
          hasStatus(
            unit,
            "protector",
          ),
      )
      .sort(
        (left, right) =>
          left.tieOrder -
          right.tieOrder,
      )[0];

  if (protector) {
    return protector;
  }

  if (
    hasStatus(intendedTarget, "stealth") &&
    state.units.some(
      (unit) =>
        unit.alive &&
        unit.side === intendedTarget.side &&
        unit.id !== intendedTarget.id,
    )
  ) {
    return state.units.find(
      (unit) =>
        unit.alive &&
        unit.side === intendedTarget.side &&
        unit.id !== intendedTarget.id &&
        !hasStatus(unit, "stealth"),
    ) ?? intendedTarget;
  }

  return intendedTarget;
}

/**
 * 对目标进行净化。
 *
 * negative：解除负面状态。
 * positive：解除正面状态。
 *
 * 敌对来源尝试解除目标正面状态时，
 * 净化无效才会触发。
 */
export function purgeStatuses(
  state: BattleState,
  sourceId: string | null,
  targetId: string,
  kind: "negative" | "positive",
): string[] {
  const target =
    state.units.find(
      (unit) => unit.id === targetId,
    );

  if (!target) {
    return [];
  }

  const source = sourceId
    ? state.units.find(
        (unit) =>
          unit.id === sourceId,
      )
    : undefined;

  const isHostilePositivePurge =
    kind === "positive" &&
    source &&
    source.side !== target.side;

  if (
    isHostilePositivePurge &&
    consumeStatusLayer(
      state,
      target,
      "purge-nullification",
    )
  ) {
    state.logs.push(
      `${target.name}的净化无效阻止了正面状态被解除。`,
    );

    return [];
  }

  const shouldRemove =
    kind === "negative"
      ? (status: BattleStatusEffect) =>
          isPurgeableNegativeStatus(status)
      : (status: BattleStatusEffect) =>
          isPurgeablePositiveStatus(status);

  const removed =
    target.statuses.filter(
      shouldRemove,
    );

  target.statuses =
    target.statuses.filter(
      (status) =>
        !shouldRemove(status),
    );

  return removed.map(
    (status) => status.name,
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

export function isPurgeablePositiveStatus(
  status: Pick<BattleStatusEffect, "tags" | "tag">,
): boolean {
  const tags = getStatusTags(status);

  return (
    !tags.includes("特殊") &&
    (tags.includes("正面") || tags.includes("强化"))
  );
}

function addBurningStatus(
  state: BattleState,
  firstTargetId: string,
  options: AddBuiltInStatusOptions,
): BattleStatusEffect | undefined {
  return addBurningStatuses(
    state,
    [firstTargetId],
    options,
  );
}

export function addBurningStatuses(
  state: BattleState,
  initialTargetIds: string[],
  options: AddBuiltInStatusOptions,
): BattleStatusEffect | undefined {
  const firstTarget = state.units.find(
    (unit) => initialTargetIds.includes(unit.id),
  );
  const initialTargets = state.units.filter(
    (unit) =>
      unit.alive &&
      initialTargetIds.includes(unit.id),
  );
  const windSeeds = initialTargets.filter(
    (unit) => hasStatus(unit, "attached-wind"),
  );
  const windParticipants = windSeeds.length > 0
    ? state.units.filter(
        (unit) =>
          unit.alive &&
          unit.side === firstTarget?.side &&
          hasStatus(unit, "attached-wind"),
      )
    : [];
  const participants = [
    ...new Map(
      [...initialTargets, ...windParticipants].map((unit) => [unit.id, unit]),
    ).values(),
  ];

  for (const unit of windParticipants) {
    const wind = getStatusByDefinition(unit, "attached-wind");
    if (wind) {
      removeStatusInstance(unit, wind.id);
    }
  }

  let firstStatus: BattleStatusEffect | undefined;
  for (const unit of participants) {
    const status = addStatus(
      state,
      unit.id,
      createBuiltInStatusInput("burning", options),
    );
    firstStatus ??= status;
  }

  for (const source of windParticipants) {
    for (const target of windParticipants) {
      if (source.id === target.id) {
        continue;
      }

      addStatus(
        state,
        target.id,
        createBuiltInStatusInput("burning", options),
      );
    }
  }

  return firstStatus;
}