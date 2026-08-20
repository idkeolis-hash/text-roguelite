

export type CompendiumKind =
  | "weapon"
  | "relic"
  | "item"
  | "companion";

export interface CompendiumDetail {
  label: string;
  value: string;
}

export interface BaseCompendiumEntry {
  id: string;
  name: string;

  /**
   * 玩家是否已经在游戏中遇到过该条目。
   *
   * 未遇到时，图鉴只显示“？？？”。
   */
  encountered: boolean;

  description: string;
  fairyComment: string;
  details: CompendiumDetail[];
}

export interface WeaponActionOverride {
  name: string;
  description: string;
}

export interface WeaponCompendiumEntry
  extends BaseCompendiumEntry {
  kind: "weapon";

  /**
   * 装备该武器时，主控的蓄能上限。
   */
  maxCharge: number;

  /**
   * 覆盖主控行动按钮的名称与说明。
   */
  actionOverrides?: Record<
    string,
    WeaponActionOverride
  >;
}

export interface RelicCompendiumEntry
  extends BaseCompendiumEntry {
  kind: "relic";

  /**
   * 装备该遗物后，需要安装到角色身上的钩子。
   */
  hookIds: string[];
}

export type ItemBattleEffect =
  | {
      type: "heal-self";
      amount: number;
    };

export interface ItemCompendiumEntry
  extends BaseCompendiumEntry {
  kind: "item";

  /**
   * 战斗行动区显示的名称和说明。
   */
  actionName: string;
  actionDescription: string;

  /**
   * 每场战斗的可使用次数。
   */
  maxUsesPerBattle: number;

  /**
   * 实际战斗效果。
   */
  battleEffect: ItemBattleEffect;
}

export interface CompanionCompendiumEntry
  extends BaseCompendiumEntry {
  kind: "companion";

  /**
   * 对应combatants.ts中的战斗单位定义。
   */
  combatantRoleId: string;
}

export type CompendiumEntry =
  | WeaponCompendiumEntry
  | RelicCompendiumEntry
  | ItemCompendiumEntry
  | CompanionCompendiumEntry;

export const WEAPON_COMPENDIUM:
  WeaponCompendiumEntry[] = [
    {
      id: "weapon-rainbow",
      kind: "weapon",
      name: "彩虹",
      encountered: true,
      maxCharge: 4,

      description:
        `一柄由多层透明介质与微细衍射结构组成的复合剑。剑身能够根据入射角改变不同波长光线的传播路径，并将分离后的光谱约束在刃缘附近。

挥动时产生的彩色轨迹并非持续发光，而是空气中的水分、悬浮颗粒与剑身表面的周期结构共同形成的瞬时色散现象。高频运动会进一步改变局部折射率，使使用者的动作呈现出类似连续加速的视觉效果。`,

      fairyComment:
        `会把光拆成好多种颜色的剑！下雨以后挥起来一定特别漂亮吧？不过要是转得太快，使用者会不会也被自己晃得找不到方向呢？`,

      actionOverrides: {
        basic: {
          name: "双重彩虹",
          description:
            "单体2次1倍攻击，自身速度+20% 3回合。目标攻击前低于50%生命时，执行2次。",
        },

        skill: {
          name: "雨过天晴",
          description:
            "单体1.6倍攻击，并赋予1层失衡。",
        },

        charge: {
          name: "凝聚虹光",
          description:
            "蓄能+2，不需要选择目标。",
        },

        "charged-skill": {
          name: "随风而动",
          description:
            "满蓄时可用。恢复20%最大生命，并获得乘风3回合。",
        },

        burst: {
          name: "雨天是勇者的诞生！",
          description:
            "满蓄时可用。攻、防、速+30%持续3回合，并获得或立即冷却拔剑。",
        },
      },

      details: [
        {
          label: "蓄能上限",
          value: "4",
        },
        {
          label: "普攻",
          value:
            "双重彩虹：2次攻击并叠加速度；低生命目标会令行动执行2次",
        },
        {
          label: "技能",
          value:
            "雨过天晴：造成伤害并施加失衡",
        },
        {
          label: "蓄能技能",
          value:
            "随风而动：恢复生命并获得乘风",
        },
        {
          label: "蓄能爆发",
          value:
            "雨天是勇者的诞生！：强化攻防速并获得拔剑",
        },
      ],
    },
    {
      id: "weapon-placeholder",
      kind: "weapon",
      name: "占位符武器",
      encountered: true,
      maxCharge: 4,

      description:
        "流程系统测试期间使用的占位符武器。正式版本中将被真正的武器替换。",

      fairyComment:
        "一件还没有决定自己是什么的武器。至少挥起来不会穿模吧？",

      details: [
        {
          label: "蓄能上限",
          value: "4",
        },
        {
          label: "普攻",
          value:
            "造成物理伤害，蓄能+1",
        },
        {
          label: "技能",
          value:
            "造成较高的物理伤害",
        },
        {
          label: "蓄能技能",
          value:
            "满蓄时造成大量物理伤害，蓄能-1",
        },
        {
          label: "蓄能爆发",
          value:
            "满蓄时对所有敌人造成能量伤害",
        },
      ],
    },

    {
      id: "weapon-training-sword",
      kind: "weapon",
      name: "训练长剑",
      encountered: true,
      maxCharge: 4,

      description:
        "在这里填写训练长剑的图鉴描述。",

      fairyComment:
        "在这里填写妖精对训练长剑的评价。",

      details: [
        {
          label: "蓄能上限",
          value: "4",
        },
      ],
    },
  ];

export const RELIC_COMPENDIUM:
  RelicCompendiumEntry[] = [
    {
      id: "relic-hero-armament",
      kind: "relic",
      name: "勇者武装",
      encountered: true,

      description:
        `一组能够持续记录使用者战斗动作的自适应装备。其内部结构会根据动作开始时采集到的姿态、受力与能量分布，逐步调整输出参数。

这种调整不会直接改变装备的基础结构，而是以持续状态的形式叠加在使用者身上。攻击、防御与速度的增幅分别记录，单项最高可达到基础值的200%。`,

      fairyComment:
        `每动一下就会变强一点？那要是一直原地挥剑，会不会最后快得连自己说过什么都听不清呀？好想试试看！`,

      details: [
        {
          label: "行动开始",
          value:
            "攻击、防御、速度各+10%",
        },
        {
          label: "持续时间",
          value: "永久",
        },
        {
          label: "单项上限",
          value: "200%",
        },
      ],

      hookIds: [
        "hero-armament-battle-start",
        "hero-armament-action-start",
      ],
    },
    {
      id: "relic-placeholder",
      kind: "relic",
      name: "占位符遗物",
      encountered: true,

      description:
        "流程系统测试期间使用的占位符遗物。目前没有实际战斗效果。",

      fairyComment:
        "不知道有什么用，但既然放在基座上，就先假装它很珍贵吧。",

      details: [
        {
          label: "当前效果",
          value: "暂无效果",
        },
        {
          label: "用途",
          value:
            "测试奖励、商店和抽奖流程",
        },
      ],

      hookIds: [],
    },
    {
      id: "relic-resonant-prism",
      kind: "relic",
      name: "余响棱镜",
      encountered: true,

      description:
        "在这里填写余响棱镜的图鉴描述。",

      fairyComment:
        "在这里填写妖精对余响棱镜的评价。",

      details: [
        {
          label: "战斗开始",
          value: "自身蓄能+1",
        },
        {
          label: "首次蓄能爆发",
          value:
            "每场战斗中，自身第一次释放蓄能爆发后，再释放一次",
        },
      ],

      hookIds: [
        "resonant-prism-battle-start",
        "resonant-prism-repeat-burst",
      ],
    },
  ];

export const ITEM_COMPENDIUM:
  ItemCompendiumEntry[] = [
    {
      id: "item-test-medicine",
      kind: "item",
      name: "测试回复药",
      encountered: true,

      description:
        "在这里填写测试回复药的图鉴描述。",

      fairyComment:
        "在这里填写妖精对测试回复药的评价。",

         actionName: "测试回复药",
      actionDescription:
        "恢复自身28点生命。每场战斗可使用1次。",
      maxUsesPerBattle: 1,

      battleEffect: {
        type: "heal-self",
        amount: 28,
      },

      details: [
        {
          label: "效果",
          value: "恢复28点生命",
        },
        {
          label: "使用限制",
          value: "每场战斗1次",
        },
        {
          label: "是否消耗",
          value: "战斗结束后恢复使用次数",
        },
      ],
    },
  ];

export const COMPANION_COMPENDIUM:
  CompanionCompendiumEntry[] = [
    {
      id: "companion-cat",
      kind: "companion",
      name: "猫",
      encountered: true,
      combatantRoleId: "cat-companion",

      description:
        "一只不知道为什么加入了队伍的猫。它拒绝服从复杂的战术安排。",

      fairyComment:
        "是猫哦！虽然好像什么都不会，但至少很可爱。大概吧。",

      details: [
        {
          label: "普攻：喵",
          value: "无效果，蓄能+1",
        },
        {
          label: "技能：喵喵",
          value: "无效果",
        },
        {
          label: "蓄能技能：喵喵喵",
          value:
            "满蓄时可用。无效果，使用后蓄能-1",
        },
        {
          label: "蓄能爆发：喵喵喵喵",
          value:
            "满蓄时可用。无效果，使用后蓄能归零",
        },
      ],
    },
  ];

export function getCompendiumEntries(
  kind: CompendiumKind,
): CompendiumEntry[] {
  if (kind === "weapon") {
    return WEAPON_COMPENDIUM;
  }

  if (kind === "relic") {
    return RELIC_COMPENDIUM;
  }

  if (kind === "item") {
    return ITEM_COMPENDIUM;
  }

  return COMPANION_COMPENDIUM;
}

export function getRelicHookIds(
  relicIds: string[],
): string[] {
  const result: string[] = [];

  for (const relicId of relicIds) {
    const relic = RELIC_COMPENDIUM.find(
      (entry) => entry.id === relicId,
    );

    if (!relic) {
      continue;
    }

    for (const hookId of relic.hookIds) {
      if (!result.includes(hookId)) {
        result.push(hookId);
      }
    }
  }

  return result;
}

export function getCompendiumEntryById(
  entryId: string,
): CompendiumEntry | undefined {
  return [
    ...WEAPON_COMPENDIUM,
    ...RELIC_COMPENDIUM,
    ...ITEM_COMPENDIUM,
    ...COMPANION_COMPENDIUM,
  ].find(
    (entry) => entry.id === entryId,
  );
}

export function getWeaponById(
  entryId: string,
): WeaponCompendiumEntry | undefined {
  return WEAPON_COMPENDIUM.find(
    (entry) => entry.id === entryId,
  );
}

export function getRelicById(
  entryId: string,
): RelicCompendiumEntry | undefined {
  return RELIC_COMPENDIUM.find(
    (entry) => entry.id === entryId,
  );
}

export function getItemById(
  entryId: string,
): ItemCompendiumEntry | undefined {
  return ITEM_COMPENDIUM.find(
    (entry) => entry.id === entryId,
  );
}

export function getCompanionById(
  entryId: string,
): CompanionCompendiumEntry | undefined {
  return COMPANION_COMPENDIUM.find(
    (entry) => entry.id === entryId,
  );
}