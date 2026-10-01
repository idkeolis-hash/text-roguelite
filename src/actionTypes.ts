import type { BattleState, BattleUnit } from "./game";

export type ActionCategory =
  | "basic"
  | "skill"
  | "charge"
  | "charged-skill"
  | "burst"
  | "item"
  | "special";

export type CombatDamageType = "physical" | "energy";

export type CombatTargetSelector =
  | { type: "self" }
  | { type: "chosen-enemy" }
  | { type: "chosen-ally" }
  | { type: "chosen-other-ally" }
  | { type: "main-player" }
  | { type: "all-enemies" }
  | { type: "all-allies" }
  | {
      type: "ally-role-or-self";
      roleId: string;
    };

export interface ActionSelection {
  enemyId: string | null;
  allyId: string | null;
}

export type SpecialActionId =
  | "rainbow-basic"
  | "rainbow-skill"
  | "rainbow-charged-skill"
  | "rainbow-burst"
  | "blue-origin-basic"
  | "blue-origin-skill"
  | "blue-origin-charged-skill"
  | "blue-origin-burst"
  | "blue-residual-basic"
  | "blue-residual-skill"
  | "blue-residual-charged-skill"
  | "blue-residual-burst"
  | "pale-basic"
  | "pale-skill"
  | "pale-charged-skill"
  | "pale-burst";

export type CombatActionEffect =
  | {
      type: "damage";
      target: CombatTargetSelector;
      multiplier: number;
      damageType: CombatDamageType;
      hits?: number;
    }
  | {
      type: "gain-charge";
      target: CombatTargetSelector;
      amount: number;
    }
  | {
      type: "guard";
      target: CombatTargetSelector;
    }
  | {
      type: "heal";
      target: CombatTargetSelector;
      amount?: number;
      maxHpRatio?: number;
    };

export interface CombatActionDefinition {
  /** 具体行动识别码，不使用显示名称进行判断。 */
  id: string;

  /** 状态限制和旧钩子使用的行动类别。 */
  category: ActionCategory;

  name: string;
  description: string;

  /** 通用效果和特殊处理器涉及的目标规则。 */
  targets: CombatTargetSelector[];

  requiresFullCharge?: boolean;

  chargeCost?: number | "all";
  chargeCostTiming?: "before-effects" | "after-effects";

  /** 是否属于主控武器行动，决定是否消费复起。 */
  weaponAction?: boolean;

  /** 武器普攻的公共蓄能奖励，只结算一次。 */
  basicCharge?: boolean;

  effects: CombatActionEffect[];
  special?: SpecialActionId;

  /** 本次取得定义时的快照，例如青羽等级。 */
  data?: Record<string, number | string | boolean>;
}

/**
 * 内容编写时可以省略可自动生成的识别码和目标列表。
 * 进入运行系统前必须转换成完整定义。
 */
export type CombatActionSource =
  Omit<CombatActionDefinition, "id" | "targets"> & {
    id?: string;
    targets?: CombatTargetSelector[];
  };

export interface ActionAvailability {
  allowed: boolean;
  reason?: string;
}

/**
 * 特殊处理器只执行效果。
 * 不允许在这里扣行动力、派发公共行动事件或推进战斗。
 */
export interface ActionEffectContext {
  state: BattleState;
  actor: BattleUnit;
  action: CombatActionDefinition;
  selection: ActionSelection;
  executionIndex: number;

  targets(selector: CombatTargetSelector): BattleUnit[];

  /** 查询单体攻击的实际目标。 */
  redirect(target: BattleUnit): BattleUnit;

  /** 返回真正的受击者；日志也使用真正的受击者。 */
  attack(
    target: BattleUnit,
    multiplier: number,
    damageType: CombatDamageType,
    area?: boolean,
    finalDamageBonus?: number,
  ): BattleUnit | undefined;

  fixedDamage(
    target: BattleUnit,
    amount: number,
    reason: string,
  ): void;

  heal(target: BattleUnit, amount: number): number;
  gainCharge(target: BattleUnit, amount: number): void;
  executionData: Record<string, number>;
  log(message: string): void;
}

export function defineAction(
  ownerId: string,
  source: CombatActionSource,
): CombatActionDefinition {
  return {
    ...source,
    id: source.id ?? `${ownerId}:${source.category}`,
    targets:
      source.targets ??
      source.effects.map((effect) => effect.target),
  };
}