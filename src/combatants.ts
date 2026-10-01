import type {
  CharacterStats,
} from "./content";

import {
  defineAction,
  type CombatActionDefinition,
  type CombatActionSource,
} from "./actionTypes";

export type {
  CombatActionDefinition,
  CombatActionEffect,
  CombatDamageType,
  CombatTargetSelector,
} from "./actionTypes";

export interface CombatantAiDefinition {
  /**
   * 未满蓄时按顺序循环使用。
   */
  normalPattern: string[];

  /**
   * 满蓄时按顺序循环使用。
   */
  fullChargePattern: string[];
}

export interface CombatantDefinition {
  /**
   * 这个ID同时作为BattleUnit.role使用。
   */
  id: string;

  name: string;

  kind: "enemy" | "companion";

  stats: CharacterStats;

  maxCharge: number;

  actions: CombatActionDefinition[];

  /**
   * 玩家手动操作的同伴可以不填写AI。
   */
  ai?: CombatantAiDefinition;
}

type CombatantSource =
  Omit<CombatantDefinition, "actions"> & {
    actions: CombatActionSource[];
  };

const COMBATANT_SOURCES: CombatantSource[] = [
    /* =====================================================
       同伴：猫
       ===================================================== */

    {
      id: "cat-companion",
      name: "猫",
      kind: "companion",

      stats: {
        maxHp: 45,
        attack: 1,
        defense: 2,
        speed: 110,
        actionPower: 1,

        strength: 1,
        agility: 6,
        constitution: 3,
        intelligence: 1,
        perception: 4,
        charisma: 8,
      },

      maxCharge: 4,

      actions: [
        {
           category: "basic",
          name: "喵",
          description:
            "无效果，蓄能+1。",

          effects: [
            {
              type: "gain-charge",
              target: {
                type: "self",
              },
              amount: 1,
            },
          ],
        },

        {
           category: "skill",
          name: "喵喵",
          description:
            "无效果。",

          effects: [],
        },

        {
           category: "charge",
          name: "蓄能",
          description:
            "蓄能+2。",

          effects: [
            {
              type: "gain-charge",
              target: {
                type: "self",
              },
              amount: 2,
            },
          ],
        },

        {
           category: "charged-skill",
          name: "喵喵喵",
          description:
            "满蓄时可用。无效果，蓄能-1。",

          requiresFullCharge: true,
          chargeCost: 1,

          effects: [],
        },

        {
           category: "burst",
          name: "喵喵喵喵",
          description:
            "满蓄时可用。无效果，蓄能归零。",

          requiresFullCharge: true,
          chargeCost: "all",

          effects: [],
        },
      ],
    },

    /* =====================================================
       敌人：魔将
       ===================================================== */

    {
      id: "mage-general",
      name: "魔将",
      kind: "enemy",

      stats: {
        maxHp: 286,
        attack: 14,
        defense: 5,
        speed: 92,
        actionPower: 1,

        strength: 3,
        agility: 4,
        constitution: 5,
        intelligence: 7,
        perception: 4,
        charisma: 6,
      },

      maxCharge: 4,

      ai: {
        normalPattern: [
          "basic",
          "charge",
          "skill",
        ],

        fullChargePattern: [
          "charged-skill",
          "burst",
        ],
      },

      actions: [
        {
           category: "basic",
          name: "魔力弹",
          description:
            "对主控造成能量伤害，并使自身蓄能+1。",

          effects: [
            {
              type: "damage",
              target: {
                type: "main-player",
              },
              multiplier: 0.85,
              damageType: "energy",
            },
            {
              type: "gain-charge",
              target: {
                type: "self",
              },
              amount: 1,
            },
          ],
        },

        {
           category: "skill",
          name: "暗蚀术",
          description:
            "对主控造成较高的能量伤害。",

          effects: [
            {
              type: "damage",
              target: {
                type: "main-player",
              },
              multiplier: 1.25,
              damageType: "energy",
            },
          ],
        },

        {
           category: "charge",
          name: "魔力汇聚",
          description:
            "停止攻击并汇聚魔力，使自身蓄能+2。",

          effects: [
            {
              type: "gain-charge",
              target: {
                type: "self",
              },
              amount: 2,
            },
          ],
        },

        {
           category: "charged-skill",
          name: "穿魂射线",
          description:
            "满蓄时可用。造成大量能量伤害，使用后蓄能-1。",

          requiresFullCharge: true,
          chargeCost: 1,

          effects: [
            {
              type: "damage",
              target: {
                type: "main-player",
              },
              multiplier: 1.75,
              damageType: "energy",
            },
          ],
        },

        {
           category: "burst",
          name: "黑夜坠落",
          description:
            "满蓄时可用。造成极高的能量伤害，使用后蓄能归零。",

          requiresFullCharge: true,
          chargeCost: "all",

          effects: [
            {
              type: "damage",
              target: {
                type: "main-player",
              },
              multiplier: 2.2,
              damageType: "energy",
            },
          ],
        },
      ],
    },

    /* =====================================================
       敌人：盾矛兵
       ===================================================== */

    {
      id: "shield-soldier",
      name: "盾矛兵",
      kind: "enemy",

      stats: {
        maxHp: 208,
        attack: 11,
        defense: 8,
        speed: 80,
        actionPower: 1,

        strength: 5,
        agility: 3,
        constitution: 7,
        intelligence: 2,
        perception: 6,
        charisma: 3,
      },

      maxCharge: 3,

      ai: {
        normalPattern: [
          "basic",
          "charge",
          "skill",
        ],

        fullChargePattern: [
          "charged-skill",
          "burst",
        ],
      },

      actions: [
        {
           category: "basic",
          name: "盾矛突刺",
          description:
            "对主控造成物理伤害，并使自身蓄能+1。",

          effects: [
            {
              type: "damage",
              target: {
                type: "main-player",
              },
              multiplier: 0.72,
              damageType: "physical",
            },
            {
              type: "gain-charge",
              target: {
                type: "self",
              },
              amount: 1,
            },
          ],
        },

        {
           category: "skill",
          name: "举盾掩护",
          description:
            "使魔将获得防御状态；如果魔将已经无法战斗，则保护自己。",

          effects: [
            {
              type: "guard",
              target: {
                type: "ally-role-or-self",
                roleId: "mage-general",
              },
            },
          ],
        },

        {
           category: "charge",
          name: "稳固阵势",
          description:
            "稳住阵脚，使自身蓄能+2。",

          effects: [
            {
              type: "gain-charge",
              target: {
                type: "self",
              },
              amount: 2,
            },
          ],
        },

        {
           category: "charged-skill",
          name: "壁垒冲锋",
          description:
            "满蓄时可用。攻击主控并使自己获得防御状态，使用后蓄能-1。",

          requiresFullCharge: true,
          chargeCost: 1,

          effects: [
            {
              type: "damage",
              target: {
                type: "main-player",
              },
              multiplier: 1.25,
              damageType: "physical",
            },
            {
              type: "guard",
              target: {
                type: "self",
              },
            },
          ],
        },

        {
           category: "burst",
          name: "不破军阵",
          description:
            "满蓄时可用。使所有存活敌人获得防御状态，使用后蓄能归零。",

          requiresFullCharge: true,
          chargeCost: "all",

          effects: [
            {
              type: "guard",
              target: {
                type: "all-allies",
              },
            },
          ],
        },
      ],
    },

    /* =====================================================
       敌人：巨镰兵
       ===================================================== */

    {
      id: "scythe-soldier",
      name: "巨镰兵",
      kind: "enemy",

      stats: {
        maxHp: 150,
        attack: 15,
        defense: 3,
        speed: 125,
        actionPower: 1,

        strength: 6,
        agility: 6,
        constitution: 4,
        intelligence: 2,
        perception: 3,
        charisma: 3,
      },

      maxCharge: 5,

      ai: {
        normalPattern: [
          "basic",
          "charge",
          "skill",
        ],

        fullChargePattern: [
          "charged-skill",
          "burst",
        ],
      },

      actions: [
        {
           category: "basic",
          name: "横斩",
          description:
            "对主控造成物理伤害，并使自身蓄能+1。",

          effects: [
            {
              type: "damage",
              target: {
                type: "main-player",
              },
              multiplier: 0.95,
              damageType: "physical",
            },
            {
              type: "gain-charge",
              target: {
                type: "self",
              },
              amount: 1,
            },
          ],
        },

        {
           category: "skill",
          name: "追命斩",
          description:
            "对主控造成较高的物理伤害。",

          effects: [
            {
              type: "damage",
              target: {
                type: "main-player",
              },
              multiplier: 1.35,
              damageType: "physical",
            },
          ],
        },

        {
           category: "charge",
          name: "磨刃",
          description:
            "暂时停止攻击，使自身蓄能+2。",

          effects: [
            {
              type: "gain-charge",
              target: {
                type: "self",
              },
              amount: 2,
            },
          ],
        },

        {
           category: "charged-skill",
          name: "断首",
          description:
            "满蓄时可用。对主控造成大量物理伤害，使用后蓄能-1。",

          requiresFullCharge: true,
          chargeCost: 1,

          effects: [
            {
              type: "damage",
              target: {
                type: "main-player",
              },
              multiplier: 1.9,
              damageType: "physical",
            },
          ],
        },

        {
           category: "burst",
          name: "死亡轮舞",
          description:
            "满蓄时可用。连续攻击主控3次，使用后蓄能归零。",

          requiresFullCharge: true,
          chargeCost: "all",

          effects: [
            {
              type: "damage",
              target: {
                type: "main-player",
              },
              multiplier: 0.68,
              damageType: "physical",
              hits: 3,
            },
          ],
        },
      ],
    },
  ];

export const COMBATANT_DEFINITIONS: CombatantDefinition[] =
  COMBATANT_SOURCES.map((source) => ({
    ...source,
    actions: source.actions.map((action) =>
      defineAction(source.id, action),
    ),
    ai: source.ai
      ? {
          normalPattern: source.ai.normalPattern.map(
            (category) => `${source.id}:${category}`,
          ),
          fullChargePattern: source.ai.fullChargePattern.map(
            (category) => `${source.id}:${category}`,
          ),
        }
      : undefined,
  }));

export function getCombatantDefinition(
  roleId: string,
): CombatantDefinition | undefined {
  return COMBATANT_DEFINITIONS.find(
    (definition) =>
      definition.id === roleId,
  );
}

export function getCombatantAction(
  roleId: string,
  actionId: string,
): CombatActionDefinition | undefined {
  return getCombatantDefinition(
    roleId,
  )?.actions.find(
    (action) =>
      action.id === actionId ||
      action.category === actionId,
  );
}