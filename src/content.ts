export interface CharacterStats {
  maxHp: number;
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
}

export type SpeakerId =
  | "narrator"
  | "protagonist"
  | "fairy"
  | "mage-general"
  | "shield-soldier"
  | "scythe-soldier"
  | "system";

export interface DialogueLine {
  speaker: SpeakerId;

  /**
   * 显示在台词前面的名字。
   * 旁白可以不填写。
   */
  name?: string;

  text: string;
}

export type StoryPage =
  | string
  | DialogueLine[];

export interface ProtagonistDefinition {
  id: string;
  name: string;
  realityDescription: string;
  combatDescription: string;
  stats: CharacterStats;

  /**
   * 不填写时使用测试武器。
   */
  startingWeaponId?: string;

  /**
   * undefined：使用测试回复药。
   * null：没有初始道具。
   */
  startingItemId?: string | null;

  startingRelicIds?: string[];

  /**
   * 不填写时使用测试同伴“猫”。
   * 填写空数组表示没有初始同伴。
   */
  startingCompanionIds?: string[];
}

export const OPENING_PAGES = [
  `
在这里填写“遥远的过去”式的开场旁白。`,

  `
在这里填写魔王出现、世界陷入危机的内容。`,

  `
在这里填写勇者出发或与魔王相关的内容。`,

  `
在这里填写“做了这样的梦”以及画面转入现世的内容。`,
];

export const WAKE_UP_PAGES = [
  `
填写主控角色醒来后的环境和状态。`,

  `
填写主控想起昨晚打开了游戏，并怀疑自己因为太困而提前退出。`,

  `
填写主控重新打开游戏，却发现又要进入新手教程。`,
];

export const CHURCH_PAGES: StoryPage[] = [
  [
    {
      speaker: "narrator",
      text: "在这里填写从现世进入幻世的旁白。",
    },
    {
      speaker: "protagonist",
      name: "勇者",
      text: "在这里填写勇者的台词。",
    },
    {
      speaker: "fairy",
      name: "妖精",
      text: "在这里填写妖精的台词。",
    },
  ],

  [
    {
      speaker: "narrator",
      text: "在这里填写雨夜与破败教堂的描写。",
    },
    {
      speaker: "mage-general",
      name: "魔将",
      text: "在这里填写魔将的台词。",
    },
    {
      speaker: "shield-soldier",
      name: "盾矛兵",
      text: "在这里填写盾矛兵的台词。",
    },
    {
      speaker: "scythe-soldier",
      name: "巨镰兵",
      text: "在这里填写巨镰兵的台词。",
    },
  ],
];

export const TUTORIAL_END_PAGES = [
  `
盾矛兵和巨镰兵挡在勇者面前，为魔将争取到了最后的时间。`,

  `
传送的光芒吞没了魔将。最后一件部件也随之消失在破败教堂中。`,

  `
在魔王复活之前阻止一切的计划失败了。`,

  `
勇者只能踏上新的旅途，寻找足以对抗四件部件的力量。`,
];

export const SKIP_TUTORIAL_PAGES = [
  `
教程战斗被跳过了。`,

  `
魔将取得了最后一件部件，并在两名士兵的掩护下成功离开。`,

  `
阻止复活的计划失败。勇者开始寻找能够对抗四件部件的力量。`,
];

export const PROTAGONISTS: ProtagonistDefinition[] = [
  {
    id: "protagonist-balanced",
    name: "白鸟鸟（原色）",

    realityDescription:
      `住在最高的大楼的最高一层，据说那里离雨后的彩虹最近。
没关系，我可是很强的！这样在句末自己犹豫起来。
喜欢热闹，习惯向需要帮助的人伸手，根本不需要理由。
每逢雨停是第一个跑去看天空的人。`,

    combatDescription:
      `利用速度强化不断提高自身的攻击节奏。
能够施加失衡阻止敌人蓄能，并在敌人准备释放强力行动时拔剑打断。`,

    startingWeaponId:
      "weapon-rainbow",

    startingItemId: null,

    startingRelicIds: [
      "relic-hero-armament",
    ],

    startingCompanionIds: [],

    stats: {
      maxHp: 200,
      attack: 40,
      defense: 30,
      speed: 90,
      actionPower: 2,

      strength: 10,
      agility: 10,
      constitution: 10,
      intelligence: 10,
      perception: 10,
      charisma: 10,
    },
  },
  {
    id: "protagonist-fast",
    name: "主控角色B",
    realityDescription:
      "填写生活状态、性格和当前处境。",
    combatDescription:
      "填写该角色偏高速、低耐久的特点。",
    stats: {
      maxHp: 68,
      attack: 15,
      defense: 3,
      speed: 135,
      actionPower: 2,

      strength: 4,
      agility: 7,
      constitution: 3,
      intelligence: 5,
      perception: 4,
      charisma: 4,
    },
  },
  {
    id: "protagonist-tough",
    name: "主控角色C",
    realityDescription:
      "填写生活状态、性格和当前处境。",
    combatDescription:
      "填写该角色偏耐久、低速度的特点。",
    stats: {
      maxHp: 105,
      attack: 17,
      defense: 6,
      speed: 78,
      actionPower: 2,

      strength: 6,
      agility: 3,
      constitution: 7,
      intelligence: 3,
      perception: 5,
      charisma: 4,
    },
  },
];