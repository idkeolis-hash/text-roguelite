import { getWeaponById } from "./compendium";
import {
  defineAction,
  type ActionCategory,
  type CombatActionDefinition,
  type CombatActionSource,
  type CombatTargetSelector,
  type SpecialActionId,
} from "./actionTypes";

const SELF: CombatTargetSelector = { type: "self" };
const ENEMY: CombatTargetSelector = { type: "chosen-enemy" };
const ENEMIES: CombatTargetSelector = { type: "all-enemies" };
const OTHER_ALLY: CombatTargetSelector = {
  type: "chosen-other-ally",
};

export const REGISTERED_WEAPON_IDS = [
  "weapon-placeholder",
  "weapon-training-sword",
  "weapon-rainbow",
  "weapon-blue-slayer",
  "weapon-endless-pale-sword",
] as const;

function baseSources(): CombatActionSource[] {
  return [
    {
      category: "basic",
      name: "普攻",
      description: "对选中敌人造成1倍物理伤害，基础蓄能+1。",
      weaponAction: true,
      basicCharge: true,
      effects: [
        {
          type: "damage",
          target: ENEMY,
          multiplier: 1,
          damageType: "physical",
        },
      ],
    },
    {
      category: "skill",
      name: "技能",
      description: "对选中敌人造成1.55倍物理伤害。",
      weaponAction: true,
      effects: [
        {
          type: "damage",
          target: ENEMY,
          multiplier: 1.55,
          damageType: "physical",
        },
      ],
    },
    {
      category: "charge",
      name: "蓄能",
      description: "自身蓄能+2，不需要选择目标。",
      weaponAction: true,
      effects: [
        {
          type: "gain-charge",
          target: SELF,
          amount: 2,
        },
      ],
    },
    {
      category: "charged-skill",
      name: "蓄能技能",
      description: "对选中敌人造成2.1倍物理伤害。",
      weaponAction: true,
      requiresFullCharge: true,
      chargeCost: 1,
      chargeCostTiming: "after-effects",
      effects: [
        {
          type: "damage",
          target: ENEMY,
          multiplier: 2.1,
          damageType: "physical",
        },
      ],
    },
    {
      category: "burst",
      name: "蓄能爆发",
      description: "对敌全体造成1.35倍能量伤害。",
      weaponAction: true,
      requiresFullCharge: true,
      chargeCost: "all",
      chargeCostTiming: "before-effects",
      effects: [
        {
          type: "damage",
          target: ENEMIES,
          multiplier: 1.35,
          damageType: "energy",
        },
      ],
    },
  ];
}

interface SpecialOverride {
  special: SpecialActionId;
  targets: CombatTargetSelector[];
  name?: string;
  description?: string;
}

type SpecialOverrides =
  Partial<Record<ActionCategory, SpecialOverride>>;

function getOverrides(
  weaponId: string,
  form: string,
  level: number,
): SpecialOverrides {
  if (weaponId === "weapon-rainbow") {
    return {
      basic: {
        special: "rainbow-basic",
        targets: [ENEMY, SELF],
        description:
          "单体2次1倍物理，自身速度+20%(可叠加) 3回合。" +
          "目标攻击前低于50%生命时，执行2次。",
      },
      skill: {
        special: "rainbow-skill",
        targets: [ENEMY],
      },
      "charged-skill": {
        special: "rainbow-charged-skill",
        targets: [SELF],
      },
      burst: {
        special: "rainbow-burst",
        targets: [SELF],
      },
    };
  }

  if (weaponId === "weapon-endless-pale-sword") {
    return {
      basic: {
        special: "pale-basic",
        targets: [ENEMY, SELF],
      },
      skill: {
        special: "pale-skill",
        targets: [ENEMY],
      },
      "charged-skill": {
        special: "pale-charged-skill",
        targets: [ENEMIES, SELF, OTHER_ALLY],
      },
      burst: {
        special: "pale-burst",
        targets: [ENEMY, ENEMIES],
      },
    };
  }

  if (weaponId !== "weapon-blue-slayer") {
    return {};
  }

  if (form === "residual") {
    return {
      basic: {
        special: "blue-residual-basic",
        targets: [ENEMY],
        name: "青焰怒火",
        description:
          "单体1.25倍能量，附加燃烧（攻击1.25倍）2回合。" +
          "根据目标燃烧数量伤害增加25%(最大100%)。",
      },
      skill: {
        special: "blue-residual-skill",
        targets: [ENEMIES, SELF],
        name: "恐恶凶瞳",
        description:
          "敌全体40%附加1层恐惧2回合。" +
          "每个目标的每个燃烧增加10%概率（最大150%）。" +
          "每成功附加1个恐惧，自身恢复6%。",
      },
      "charged-skill": {
        special: "blue-residual-charged-skill",
        targets: [ENEMY, ENEMIES, SELF],
        name: "弑王者之焰",
        description:
          "自身附加残火3回合、1层蓄能减少无效。" +
          "选中敌人根据燃烧数量：1个延长其燃烧1回合；" +
          "2个附加2层标记；3个及以上净化。" +
          "保留现有实现：随后场上敌人的燃烧持续时间再增加1。",
      },
      burst: {
        special: "blue-residual-burst",
        targets: [ENEMIES, SELF],
        name: "无尽的青焰之兽",
        description:
          "敌全体2倍能量，立刻触发各目标的燃烧伤害并延长1回合。" +
          "根据目标燃烧数量蓄能+1(最大+4)。" +
          "复起。变为原形态，等级不变。",
      },
    };
  }

  return {
    basic: {
      special: "blue-origin-basic",
      targets: [ENEMY, SELF],
      name: "青之涡流",
      description:
        "单体1.25倍物理，净化自身最多2个异常状态。" +
        "拥有残火时，实际受击者附加燃烧（攻击1.25倍）2回合。",
    },
    skill: {
      special: "blue-origin-skill",
      targets: [ENEMY, ENEMIES],
      name: "青之微风",
      description:
        "敌单体附加附风2回合，其他敌人50%附加附风 2回合。",
    },
    "charged-skill": {
      special: "blue-origin-charged-skill",
      targets: [ENEMIES, SELF],
      name: "青之逆转",
      description:
        "敌全体附加1层蚀火；自身附加减伤33%、攻击力减少33% 3回合。",
    },
    burst: {
      special: "blue-origin-burst",
      targets: [SELF],
      name: "青之升华",
      description:
        `净化自身负面，每解除1个蓄能+${level >= 2 ? 2 : 1}。` +
        "恢复30生命，攻击力增加30% 3回合，变为残火武装。" +
        (level >= 2 ? "等级不变。" : "等级增加1。"),
    },
  };
}

export function getWeaponActionDefinitions(
  weaponId: string,
  form = "origin",
  level = 1,
): CombatActionDefinition[] {
  if (
    !REGISTERED_WEAPON_IDS.some((id) => id === weaponId)
  ) {
    return [];
  }

  const weapon = getWeaponById(weaponId);
  if (!weapon) {
    return [];
  }

  const overrides = getOverrides(weaponId, form, level);
  const ownerId =
    weaponId === "weapon-blue-slayer"
      ? `${weaponId}:${form}`
      : weaponId;

  return baseSources().map((source) => {
    const text = weapon.actionOverrides?.[source.category];
    const special = overrides[source.category];

    const merged: CombatActionSource = {
      ...source,
      ...(text ?? {}),
      ...(special ?? {}),
      effects: special ? [] : source.effects,
      data: { form, level },
    };

    if (merged.requiresFullCharge) {
      merged.description +=
        merged.chargeCost === "all"
          ? " 满蓄时可用，先消耗全部蓄能；效果获得的蓄能保留。"
          : " 满蓄时可用，行动效果完成后消耗1点蓄能。";
    }

    return defineAction(ownerId, merged);
  });
}