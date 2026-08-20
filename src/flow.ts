export type FlowNodeId =
  | "strength"
  | "death"
  | "hanged-man"
  | "star"
  | "magician"
  | "wheel"
  | "chariot"
  | "moon";

export interface FlowNodeDefinition {
  id: FlowNodeId;
  name: string;
  subtitle: string;
  description: string;
}

export const FLOW_NODES: Record<
  FlowNodeId,
  FlowNodeDefinition
> = {
  strength: {
    id: "strength",
    name: "力量",
    subtitle: "战斗",
    description:
      "与敌人进行一场普通战斗。胜利后获得一个遗物或道具。",
  },

  death: {
    id: "death",
    name: "死神",
    subtitle: "事件",
    description:
      "从当前事件池中随机抽取一个事件。",
  },

  "hanged-man": {
    id: "hanged-man",
    name: "吊人",
    subtitle: "商店",
    description:
      "花费金币购买遗物、道具或同伴。",
  },

  star: {
    id: "star",
    name: "星星",
    subtitle: "休息",
    description:
      "选择两次属性+1，或者令三个不同的随机属性+1。",
  },

  magician: {
    id: "magician",
    name: "魔术师",
    subtitle: "奖励",
    description:
      "在两个随机基座中选择一个奖励。",
  },

  wheel: {
    id: "wheel",
    name: "命运之轮",
    subtitle: "抽奖",
    description:
      "第一次转动免费，之后的价格不断提高。",
  },

  chariot: {
    id: "chariot",
    name: "战车",
    subtitle: "困难战斗",
    description:
      "进行一场困难战斗。胜利后获得武器。",
  },

  moon: {
    id: "moon",
    name: "月亮",
    subtitle: "首领战",
    description:
      "区域最终战。胜利后从三个随机奖励中选择一个。",
  },
};

export const COMMON_NODE_IDS:
  FlowNodeId[] = [
    "strength",
    "death",
    "hanged-man",
    "star",
    "magician",
    "wheel",
  ];

export type CoreStatKey =
  | "strength"
  | "agility"
  | "constitution"
  | "intelligence"
  | "perception"
  | "charisma";

export const CORE_STATS: {
  id: CoreStatKey;
  name: string;
}[] = [
  {
    id: "strength",
    name: "力量",
  },
  {
    id: "agility",
    name: "敏捷",
  },
  {
    id: "constitution",
    name: "体质",
  },
  {
    id: "intelligence",
    name: "智力",
  },
  {
    id: "perception",
    name: "感知",
  },
  {
    id: "charisma",
    name: "魅力",
  },
];

export type FlowRewardKind =
  | "relic"
  | "item"
  | "weapon"
  | "companion";

export interface FlowReward {
  kind: FlowRewardKind;
  id: string;
  name: string;
  cursed?: boolean;
}

export function createReward(
  kind: FlowRewardKind,
  cursed = false,
): FlowReward {
  if (kind === "relic") {
    return {
      kind,
      id: "relic-placeholder",
      name: cursed
        ? "被诅咒的占位符遗物"
        : "占位符遗物",
      cursed,
    };
  }

  if (kind === "item") {
    return {
      kind,
      id: "item-test-medicine",
      name: "测试回复药",
    };
  }

  if (kind === "weapon") {
    return {
      kind,
      id: "weapon-placeholder",
      name: "占位符武器",
    };
  }

  return {
    kind,
    id: "companion-cat",
    name: "猫",
  };
}

/**
 * 66%遗物，33%道具。
 */
export function rollRelicOrItem():
  FlowReward {
  return Math.random() < 0.66
    ? createReward("relic")
    : createReward("item");
}

export function rollCommonNodes(
  count: number,
): FlowNodeId[] {
  const pool = [
    ...COMMON_NODE_IDS,
  ];

  const result: FlowNodeId[] = [];

  while (
    result.length < count &&
    pool.length > 0
  ) {
    const index = Math.floor(
      Math.random() * pool.length,
    );

    const [selected] =
      pool.splice(index, 1);

    result.push(selected);
  }

  return result;
}

export function getRandomCoreStat():
  CoreStatKey {
  const index = Math.floor(
    Math.random() *
      CORE_STATS.length,
  );

  return CORE_STATS[index].id;
}

export function getRandomDistinctStats(
  count: number,
): CoreStatKey[] {
  const pool = CORE_STATS.map(
    (stat) => stat.id,
  );

  const result: CoreStatKey[] = [];

  while (
    result.length < count &&
    pool.length > 0
  ) {
    const index = Math.floor(
      Math.random() * pool.length,
    );

    const [selected] =
      pool.splice(index, 1);

    result.push(selected);
  }

  return result;
}

/* ========================================================
   事件池
   ======================================================== */

export type FlowEventEffect =
  | {
      type: "gold";
      amount: number;
    }
  | {
      type: "random-stat";
      amount: number;
    }
  | {
      type: "reward";
      reward: FlowReward;
    }
  | {
      type: "nothing";
    };

export interface FlowEventChoice {
  text: string;
  resultText: string;
  effects: FlowEventEffect[];
}

export interface FlowEventDefinition {
  id: string;
  title: string;
  text: string;
  choices: FlowEventChoice[];
}

export const FLOW_EVENTS:
  FlowEventDefinition[] = [
    {
      id: "abandoned-well",
      title: "没有回声的井",
      text:
        "道路旁有一口枯井。井底没有水声，却隐约传来金属碰撞的声音。",

      choices: [
        {
          text: "把手伸进去",
          resultText:
            "你在井壁的裂缝里摸到了几枚旧金币。",
          effects: [
            {
              type: "gold",
              amount: 25,
            },
          ],
        },

        {
          text: "向井中投入金币",
          resultText:
            "金币坠入黑暗。片刻后，一股微弱的力量从井底回应了你。",
          effects: [
            {
              type: "gold",
              amount: -15,
            },
            {
              type: "random-stat",
              amount: 1,
            },
          ],
        },

        {
          text: "不要靠近",
          resultText:
            "你绕开了枯井。什么也没有发生。",
          effects: [
            {
              type: "nothing",
            },
          ],
        },
      ],
    },

    {
      id: "silent-pedestal",
      title: "无人的基座",
      text:
        "一座石制基座孤零零地立在荒野中。基座上的东西已经被拿走，只剩一点未散去的光。",

      choices: [
        {
          text: "触碰残光",
          resultText:
            "残留的力量进入了你的身体。",
          effects: [
            {
              type: "random-stat",
              amount: 1,
            },
          ],
        },

        {
          text: "搜索基座周围",
          resultText:
            "你在碎石下面找到了一件被遗忘的东西。",
          effects: [
            {
              type: "reward",
              reward:
                createReward("item"),
            },
          ],
        },
      ],
    },

    {
      id: "masked-traveler",
      title: "戴面具的旅人",
      text:
        "一名戴着白色面具的旅人拦住了去路。它没有说明来意，只向你摊开手掌。",

      choices: [
        {
          text: "交出20金币",
          resultText:
            "旅人收下金币，将一件遗物放在你的手中。",
          effects: [
            {
              type: "gold",
              amount: -20,
            },
            {
              type: "reward",
              reward:
                createReward("relic"),
            },
          ],
        },

        {
          text: "拒绝交易",
          resultText:
            "旅人没有纠缠，只是在你身后安静地消失了。",
          effects: [
            {
              type: "nothing",
            },
          ],
        },
      ],
    },
  ];

export function rollFlowEvent():
  FlowEventDefinition {
  const index = Math.floor(
    Math.random() *
      FLOW_EVENTS.length,
  );

  return FLOW_EVENTS[index];
}

/* ========================================================
   商店
   ======================================================== */

export interface FlowShopSlot {
  id: string;
  reward: FlowReward;
  price: number;
  sold: boolean;
}

export function createShopSlots():
  FlowShopSlot[] {
  return [
    {
      id: "shop-relic-1",
      reward:
        createReward("relic"),
      price: 55,
      sold: false,
    },
    {
      id: "shop-relic-2",
      reward:
        createReward("relic"),
      price: 65,
      sold: false,
    },
    {
      id: "shop-item-1",
      reward:
        createReward("item"),
      price: 30,
      sold: false,
    },
    {
      id: "shop-companion-1",
      reward:
        createReward("companion"),
      price: 80,
      sold: false,
    },
  ];
}

/* ========================================================
   命运之轮
   ======================================================== */

export type WheelOutcome =
  | {
      type: "stat";
      amount: 1 | -1;
    }
  | {
      type: "gold";
      amount: number;
    }
  | {
      type: "reward";
      reward: FlowReward;
    };

export function rollWheelOutcome():
  WheelOutcome {
  const roll = Math.floor(
    Math.random() * 7,
  );

  if (roll === 0) {
    return {
      type: "stat",
      amount: -1,
    };
  }

  if (roll === 1) {
    return {
      type: "gold",
      amount: -20,
    };
  }

  if (roll === 2) {
    return {
      type: "gold",
      amount: 35,
    };
  }

  if (roll === 3) {
    return {
      type: "stat",
      amount: 1,
    };
  }

  if (roll === 4) {
    return {
      type: "reward",
      reward:
        createReward("relic"),
    };
  }

  if (roll === 5) {
    return {
      type: "reward",
      reward:
        createReward("item"),
    };
  }

  return {
    type: "reward",
    reward:
      createReward(
        "relic",
        true,
      ),
  };
}