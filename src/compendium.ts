

export type CompendiumKind =
  | "weapon"
  | "relic"
  | "item"
  | "companion"
  | "status";

export interface CompendiumDetail {
  label: string;
  value: string;
}

export interface BaseCompendiumEntry {
  id: string;
  name: string;

  

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

export interface StatusCompendiumEntry
  extends BaseCompendiumEntry {
  kind: "status";
  tags: string[];
}

export type CompendiumEntry =
  | WeaponCompendiumEntry
  | RelicCompendiumEntry
  | ItemCompendiumEntry
  | CompanionCompendiumEntry
  | StatusCompendiumEntry;

export const STATUS_COMPENDIUM:
  StatusCompendiumEntry[] = [
    {
      id: "status-rebirth",
      kind: "status",
      name: "重生",
        
      tags: ["特殊", "强化"],
      description: "死亡时自动复活。",
      fairyComment: "巴拉巴拉",
      details: [{ label: "类型", value: "层数型特殊强化状态" }],
    },
    {
      id: "status-stealth",
      kind: "status",
      name: "隐身",
       
      tags: ["强化"],
      description: "存在其他盟友时，无法成为单体攻击目标。",
      fairyComment: "巴拉巴拉",
      details: [{ label: "类型", value: "覆盖型强化状态" }],
    },
    {
      id: "status-fear",
      kind: "status",
      name: "恐惧",
       
      tags: ["异常"],
      description: "行动时有50%概率取消行动，然后解除1层。",
      fairyComment: "巴拉巴拉",
      details: [{ label: "类型", value: "层数型异常状态" }],
    },
    {
      id: "status-reprise",
      kind: "status",
      name: "复起",
       
      tags: ["强化"],
      description: "拥有者的武器行动效果额外发生一次，然后解除1层。",
      fairyComment: "巴拉巴拉",
      details: [{ label: "类型", value: "层数型强化状态" }],
    },
    {
      id: "status-steadfast",
      kind: "status",
      name: "坚持",
       
      tags: ["强化"],
      description: "受到致死伤害时保留生命，然后解除1层。",
      fairyComment: "巴拉巴拉",
      details: [{ label: "类型", value: "层数型强化效果" }],
    },
    ...([
      ["burning", "燃烧", ["DoT"], "回合结束时受到固定能量伤害。"],
      ["poison", "中毒", ["DoT"], "回合结束时受到最大生命值百分比的能量伤害。"],
      ["bleeding", "流血", ["DoT"], "行动开始时受到当前生命值百分比的物理伤害。"],
      ["confusion", "困惑", ["异常"], "行动时有50%概率取消行动，并受到自身攻击力1倍的伤害。"],
      ["regeneration", "再生", ["强化"], "回合开始时恢复生命。"],
      ["healing-blocked", "禁疗", ["异常"], "受到的治疗量为0。"],
      ["frozen", "冻结", ["异常"], "无法行动。"],
      ["paralysis", "麻痹", ["异常"], "行动时取消行动并失去一层。"],
      ["invincible", "无敌", ["正面"], "不受到伤害和负面状态。"],
      ["sleep", "睡眠", ["异常"], "无法行动，受到伤害会缩短持续时间。"],
      ["etched", "蚀刻", ["异常"], "无法受到蚀刻以外的状态。"],
      ["taunt", "嘲讽", ["异常"], "单体攻击必须选择嘲讽来源作为目标。"],
      ["protector", "守护", ["正面"], "敌人的单体攻击优先选择自己作为目标。"],
      ["counter", "反击", ["正面"], "受到攻击时反击攻击来源。"],
      ["damage-nullification", "伤害无效", ["正面"], "抵消一次伤害并失去一层。"],
      ["ailment-nullification", "异常无效", ["正面"], "抵消一次异常状态并失去一层。"],
      ["weaken-nullification", "弱化无效", ["正面"], "抵消一次弱化状态并失去一层。"],
      ["negative-nullification", "负面无效", ["正面"], "抵消一次负面状态并失去一层。"],
      ["purge-nullification", "净化无效", ["正面"], "抵消一次敌方的净化并失去一层。"],
      ["pursuit-damage", "追伤", ["正面"], "攻击命中时造成额外固定伤害。"],
      ["disarmed", "缴械", ["异常"], "无法使用普攻和蓄能爆发。"],
      ["silenced", "沉默", ["异常"], "无法使用技能和蓄能技能。"],
      ["charge-locked", "锁定", ["异常"], "无法蓄能或通过普攻获得蓄能。"],
      ["sealed", "封印", ["异常"], "无法使用蓄能技能和蓄能爆发。"],
      ["marked", "标记", ["异常"], "守护对被标记目标失效，且无法应用伤害无效状态。"],
      ["guided-pin", "引路针", ["特殊"], "其他盟友蓄能爆发时，层数+1。层数首次到达3后，每回合行动次数+1、蓄能槽减少2（至少为2）。层数为4时，重置为1，自身附加重生50。"],
      ["charge-loss-nullification", "蓄能减少无效", ["正面"], "下一次蓄能减少效果无效，然后解除1层。"],
    ] as [string, string, string[], string][]).map(([id, name, tags, description]) => ({
      id: `status-${id}`,
      kind: "status" as const,
      name,
       
      tags,
      description,
      fairyComment: "战斗中会改变行动与结算的状态。",
      details: [{ label: "类型", value: tags.join("、") }],
    })),
  ];

export const WEAPON_COMPENDIUM:
  WeaponCompendiumEntry[] = [
    {
      id: "weapon-rainbow",
      kind: "weapon",
      name: "彩虹",
       
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
            "单体2次1倍物理，自身速度+20% 3回合。目标攻击前低于50%生命时，执行2次。",
        },

        skill: {
          name: "雨过天晴",
          description:
            "单体1.6倍物理，附加1层失衡。",
        },

        charge: {
          name: "凝聚虹光",
          description:
            "蓄能+2。",
        },

        "charged-skill": {
          name: "随风而动",
          description:
            "恢复20%，附加乘风3回合。",
        },

        burst: {
          name: "雨天是勇者的诞生！",
          description:
            "自身附加攻、防、速+30% 3回合，并附加或立即冷却拔剑。",
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
            "双重彩虹：单体2次1倍物理，自身速度+20% 3回合。目标攻击前低于50%生命时，执行2次。",
        },
        {
          label: "技能",
          value:
            "雨过天晴：单体1.6倍物理，附加1层失衡。",
        },
        {
          label: "蓄能技能",
          value:
            "随风而动：恢复20%，附加乘风3回合。",
        },
        {
          label: "蓄能爆发",
          value:
            "雨天是勇者的诞生！：自身附加攻、防、速+30% 3回合，并附加或立即冷却拔剑。",
        },
      ],
    },
    {
      id: "weapon-placeholder",
      kind: "weapon",
      name: "占位符武器",
       
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
    {
      id: "weapon-blue-slayer",
      kind: "weapon",
      name: "青羽·青之弑焰",
       
      maxCharge: 5,
      description: "以青焰、燃烧与形态切换为核心的魔法武器。",
      fairyComment: "青柠色的火焰，看起来很清爽，烧起来却一点也不客气。",
      actionOverrides: {
        basic: { name: "青之涡流 / 青焰怒火", description: "青之涡流：单体1.25倍物理，解除自身2个异常状态；拥有残火时，目标附加燃烧（攻击1.25倍）2回合。青焰怒火：单体1.25倍魔法，附加燃烧（攻击1.25倍）2回合；根据目标燃烧数量伤害增加25%，最大100%。" },
        skill: { name: "青之微风 / 恐恶凶瞳", description: "青之微风：单体附加附风2回合，其他敌人50%概率附加附风。恐恶凶瞳：敌全体40%概率附加1层恐惧2回合；根据目标燃烧数量提升概率，最高150%；每成功附加1个，自身回复6%。" },
        "charged-skill": { name: "青之逆转 / 弑王者之焰", description: "青之逆转：敌全体附加1层蚀火，自身附加减伤33%、攻击力减少33%3回合。弑王者之焰：自身附加残火3回合、1层蓄能减少无效；根据目标燃烧数量，1层延长燃烧，2层附加2层标记，3层净化。" },
        burst: { name: "青之升华 / 无尽的青焰之兽", description: "青之升华：净化自身负面，每解除1个蓄能+1；恢复30，攻击力增加30%3回合，变为残火武装，使用后lv增加。lv2每解除1个负面蓄能+2。无尽的青焰之兽：敌全体2倍魔法，触发所有燃烧并使其持续+1，根据目标燃烧数量蓄能增加1（每个目标最多4）；复起时重新结算一次。变为原形态。" },
      },
      details: [
        { label: "蓄能上限", value: "5" },
        { label: "普攻", value: "青之涡流：单体1.25倍物理，解除自身2个异常状态；拥有残火时，目标附加燃烧（攻击1.25倍）2回合。/青焰怒火：单体1.25倍魔法，附加燃烧（攻击1.25倍）2回合；根据目标燃烧数量伤害增加25%，最大100%。" },
        { label: "技能", value: "青之微风：单体附加附风2回合，其他敌人50%概率附加附风。/恐恶凶瞳：敌全体40%概率附加1层恐惧2回合；根据目标燃烧数量提升概率，最高150%；每成功附加1个，自身回复6%。" },
        { label: "蓄能技能", value: "青之逆转：敌全体附加1层蚀火，自身附加减伤33%、攻击力减少33%3回合。/弑王者之焰：自身附加残火3回合、1层蓄能减少无效；根据目标燃烧数量，1层延长燃烧，2层附加2层标记，3层净化。" },
        { label: "蓄能爆发", value: "青之升华：净化自身负面，每解除1个蓄能+1；恢复30，攻击力增加30%3回合，变为残火武装，使用后lv增加。lv2每解除1个负面蓄能+2。/无尽的青焰之兽：敌全体2倍魔法，触发所有燃烧并使其持续+1，根据目标燃烧数量蓄能增加1（每个目标最多4）；复起。变为原形态。" },
      ],
    },
    {
      id: "weapon-endless-pale-sword",
      kind: "weapon",
      name: "无尽苍剑",
       
      maxCharge: 5,
      description: "仅属于【兽之王】的银白色巨剑，长度来到了惊人的两米半，是一把极其巨大且厚重的武器。在战斗时剑身会变形，两侧的银白色剑刃裂开向内收缩，漏出内部的青蓝色剑刃，整体散发着一股幽蓝色的光芒。",
      fairyComment: "白得像雪，砍下来的时候也一样冷。",
      actionOverrides: {
        basic: { name: "风暴之星", description: "自身附加星附魔2回合，然后单体0.5倍物理攻击2次。" },
        skill: { name: "循环中的无尽爱恋", description: "单体附加受伤增加35% 2回合，并随机附加一种以下异常1回合：燃烧（攻击力0.5倍），中毒5，流血2，麻痹，冻结。" },
        "charged-skill": { name: "予你的黑白螺旋", description: "敌全体附加嘲讽2回合，自身附加守护2回合，并使选中的其他盟友附加4层伤害无效2回合。" },
        burst: { name: "终焉的纯白之兽", description: "目标3倍物理，其余敌人1倍物理攻击；目标每拥有一种异常追加一次0.5倍攻击力固定伤害。" },
      },
      details: [
        { label: "蓄能上限", value: "5" },
        { label: "普攻", value: "风暴之星：自身附加星附魔2回合，然后单体0.5倍物理攻击2次。" },
        { label: "技能", value: "循环中的无尽爱恋：单体附加受伤增加35% 2回合，并随机附加一种以下异常1回合：燃烧（攻击力0.5倍），中毒5，流血2，麻痹，冻结。" },
        { label: "蓄能技能", value: "予你的黑白螺旋：敌全体附加嘲讽2回合，自身附加守护2回合，并使选中的其他盟友附加4层伤害无效2回合。" },
        { label: "蓄能爆发", value: "终焉的纯白之兽:目标3倍物理，其余敌人1倍物理攻击；目标每拥有一种异常追加一次0.5倍攻击力固定伤害。" },
      ],
    },
  ];

export const RELIC_COMPENDIUM:
  RelicCompendiumEntry[] = [
    {
      id: "relic-miracle-compass",
      kind: "relic",
      name: "奇迹的引路针",
       
      description: "以引路针积累奇迹，在复活后继续引导纯白兽之王。",
      fairyComment: "它不一定指出正确方向，但一定会让你再走一次。",
      details: [
        { label: "战斗开始", value: "附加重生50、1层引路针" },
        { label: "其他盟友蓄能爆发", value: "引路针层数+1" },
        { label: "首次达到3层", value: "此后每回合行动次数+1，蓄能槽上限-2（最低为2）" },
        { label: "达到4层", value: "层数重置为1，自身附加重生50" },
      ],
      hookIds: [
        "miracle-compass-battle-start",
        "miracle-compass-action-start",
      ],
    },
    {
      id: "relic-unripe-beast-ribbon",
      kind: "relic",
      name: "青涩之兽的发带",
       
      description: "记录受击蓄能，并在首次蓄能爆发时唤起青焰。",
      fairyComment: "看起来像发带，实际上很会记仇。",
      details: [
        { label: "首次蓄能爆发前", value: "受击时蓄能+1" },
        { label: "首次蓄能爆发", value: "敌全体附加燃烧（攻击力0.75倍）3回合，自身附加2层异常无效" },
      ],
      hookIds: [
        "unripe-beast-ribbon-damage-taken",
        "unripe-beast-ribbon-first-burst",
      ],
    },
    {
      id: "relic-hero-armament",
      kind: "relic",
      name: "勇者武装",
       

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
  if (kind === "status") {
    return STATUS_COMPENDIUM;
  }

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
    ...STATUS_COMPENDIUM,
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