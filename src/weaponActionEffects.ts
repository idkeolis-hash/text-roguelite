import type { BattleUnit } from "./game";
import type {
  ActionEffectContext,
  SpecialActionId,
} from "./actionTypes";
import {
  addBuiltInStatus,
  addBurningStatuses,
  addImbalance,
  addStatus,
  getEffectiveBattleStat,
  getStatusByDefinition,
  getStatusNumber,
  getStatusesByDefinition,
  getStatusTags,
  hasStatus,
  purgeStatuses,
  removeStatusInstance,
  type AddStatusInput,
} from "./statuses";

type Handler = (context: ActionEffectContext) => void;

function enemies(context: ActionEffectContext): BattleUnit[] {
  return context.targets({ type: "all-enemies" });
}

function chosenEnemy(
  context: ActionEffectContext,
): BattleUnit | undefined {
  return context.targets({ type: "chosen-enemy" })[0];
}

function burningCount(unit: BattleUnit): number {
  return getStatusesByDefinition(unit, "burning").length;
}

function customStatus(
  context: ActionEffectContext,
  target: BattleUnit,
  input: AddStatusInput,
) {
  if (!target.alive) {
    return undefined;
  }

  return addStatus(context.state, target.id, {
    ...input,
    data: {
      ...input.data,
      sourceId: context.actor.id,
    },
  });
}

function addWind(
  context: ActionEffectContext,
  target: BattleUnit,
): void {
  customStatus(context, target, {
    definitionId: "attached-wind",
    name: "附风",
    icon: "风",
    description:
      "被附加燃烧时，其他拥有附风的单位被附加相同的燃烧，然后解除自身的附风。",
    tags: ["特殊"],
    duration: 2,
  });
}

function addBurning(
  context: ActionEffectContext,
  target: BattleUnit,
  attackRatio: number,
): void {
  if (!target.alive) {
    return;
  }

  addBurningStatuses(context.state, [target.id], {
    value:
      getEffectiveBattleStat(context.actor, "attack") *
      attackRatio,
    duration: 2,
    sourceId: context.actor.id,
  });
}

function randomPaleAilment(
  context: ActionEffectContext,
  target: BattleUnit,
): void {
  if (!target.alive) {
    return;
  }

  const candidates = [
    ["burning", 0.5],
    ["poison", 5],
    ["bleeding", 2],
    ["frozen", 0],
    ["paralysis", 1],
  ] as const;

  const missing = candidates.filter(
    ([id]) => !hasStatus(target, id),
  );
  const pool = missing.length > 0 ? missing : candidates;

  const [definitionId, value] = pool[
    Math.floor(Math.random() * pool.length)
  ];

  addBuiltInStatus(
    context.state,
    target.id,
    definitionId,
    {
      value:
        definitionId === "burning"
          ? getEffectiveBattleStat(context.actor, "attack") * value
          : value,
      duration: 1,
      sourceId: context.actor.id,
    },
  );
}

const handlers: Record<SpecialActionId, Handler> = {
  "rainbow-basic"(context) {
    const intended = chosenEnemy(context);
    if (!intended) {
      return;
    }

    // 低血量条件在本次整项效果开始前判断。
    const initialTarget = context.redirect(intended);
    const count =
      initialTarget.hp < initialTarget.maxHp * 0.5 ? 2 : 1;

    for (let execution = 0; execution < count; execution += 1) {
      for (let hit = 0; hit < 2; hit += 1) {
        if (!intended.alive || !context.actor.alive) {
          break;
        }
        context.attack(intended, 1, "physical");
      }

      if (!context.actor.alive) {
        break;
      }

      customStatus(context, context.actor, {
        definitionId: "double-rainbow-speed",
        name: "双重彩虹·加速",
        icon: "速",
        tags: ["正面"],
        stacking: "independent",
        duration: 3,
        description: "速度增加20%。",
        percentModifiers: { speed: 0.2 },
      });
    }
  },

  "rainbow-skill"(context) {
    const target = chosenEnemy(context);
    if (!target) {
      return;
    }

    const actual = context.attack(target, 1.6, "physical");
    if (actual?.alive) {
      addImbalance(context.state, actual.id, 1);
    }
  },

  "rainbow-charged-skill"(context) {
    context.heal(
      context.actor,
      Math.round(context.actor.maxHp * 0.2),
    );

    customStatus(context, context.actor, {
      definitionId: "riding-the-wind",
      name: "乘风",
      icon: "乘",
      tags: ["特殊"],
      duration: 3,
      description:
        "自身行动结束时，根据当前速度与基础速度的比值，附加持续3回合的速度增加、攻击力增加。",
      hookIds: ["riding-the-wind-action-end"],
    });
  },

  "rainbow-burst"(context) {
    for (const [stat, label, icon] of [
      ["attack", "攻击", "攻"],
      ["defense", "防御", "防"],
      ["speed", "速度", "速"],
    ] as const) {
      customStatus(context, context.actor, {
        definitionId: `hero-born-${stat}`,
        name: `勇者诞生·${label}`,
        icon,
        tags: ["正面"],
        duration: 3,
        description: `${label}增加30%。`,
        percentModifiers: { [stat]: 0.3 },
      });
    }

    const existing = getStatusByDefinition(
      context.actor,
      "draw-sword",
    );

    if (existing) {
      existing.data.cooldownActions = 0;
      return;
    }

    customStatus(context, context.actor, {
      definitionId: "draw-sword",
      name: "拔剑",
      icon: "拔",
      tags: ["特殊"],
      duration: -1,
      description:
        "敌人将要使用蓄能技能或蓄能爆发时，取消该行动并使自身获得1次额外行动。触发后需要经过自身7次行动才能再次触发。",
      hookIds: [
        "draw-sword-intercept",
        "draw-sword-cooldown",
      ],
      data: { cooldownActions: 0 },
    });
  },

  "blue-origin-basic"(context) {
    const intended = chosenEnemy(context);
    if (!intended) {
      return;
    }

    const actual = context.attack(
      intended,
      1.25,
      "physical",
    );

    // 只解除最多两个非特殊异常，不再连续调用全量净化。
    const removable = context.actor.statuses
      .filter((status) => {
        const tags = getStatusTags(status);
        return (
          tags.includes("异常") &&
          !tags.includes("特殊")
        );
      })
      .slice(0, 2);

    for (const status of removable) {
      removeStatusInstance(context.actor, status.id);
    }

    if (
      actual?.alive &&
      hasStatus(context.actor, "residual-fire")
    ) {
      addBurning(context, actual, 1.25);
    }
  },

  "blue-residual-basic"(context) {
    const intended = chosenEnemy(context);
    if (!intended) {
      return;
    }

    const target = context.redirect(intended);
    const finalDamageBonus = Math.min(
      1,
      burningCount(target) * 0.25,
    );

    const actual = context.attack(
      target,
      1.25,
      "energy",
      false,
      finalDamageBonus,
    );

    if (actual?.alive) {
      addBurning(context, actual, 1.25);
    }
  },

  "blue-origin-skill"(context) {
    const target = chosenEnemy(context);
    if (!target) {
      return;
    }

    addWind(context, target);

    for (const enemy of enemies(context)) {
      if (
        enemy.id !== target.id &&
        Math.random() < 0.5
      ) {
        addWind(context, enemy);
      }
    }
  },

  "blue-residual-skill"(context) {
    for (const enemy of enemies(context)) {
      const chance = Math.min(
        1.5,
        0.4 + burningCount(enemy) * 0.1,
      );

      if (Math.random() >= chance) {
        continue;
      }

      const status = addBuiltInStatus(
        context.state,
        enemy.id,
        "fear",
        {
          duration: 2,
          stacks: 1,
          sourceId: context.actor.id,
        },
      );

      if (status) {
        context.heal(
          context.actor,
          Math.round(context.actor.maxHp * 0.06),
        );
      }
    }
  },

  "blue-origin-charged-skill"(context) {
    for (const enemy of enemies(context)) {
      customStatus(context, enemy, {
        definitionId: "erosion-fire",
        name: "蚀火",
        icon: "蚀",
        description:
          "被附加燃烧时层数+1；每层降低5%攻击(最大50%)。回合开始时每层20%附加禁疗1回合(最大100%)。",
        tags: ["特殊"],
        stacking: "layers",
        stacks: 1,
        duration: -1,
      });
    }

    customStatus(context, context.actor, {
      definitionId: "blue-reversal-defense",
      name: "青之逆转·减伤",
      icon: "减",
      description: "受到的伤害降低33%。",
      tags: ["强化"],
      duration: 3,
    });

    customStatus(context, context.actor, {
      definitionId: "blue-reversal-attack",
      name: "青之逆转·攻击",
      icon: "攻",
      description: "攻击力降低33%。",
      tags: ["弱化"],
      duration: 3,
      percentModifiers: { attack: -0.33 },
    });
  },

  "blue-residual-charged-skill"(context) {
    const target = chosenEnemy(context);

    if (target) {
      const count = burningCount(target);

      if (count === 1) {
        for (const burning of getStatusesByDefinition(
          target,
          "burning",
        )) {
          if (burning.duration >= 0) {
            burning.duration += 1;
          }
        }
      } else if (count === 2) {
        addBuiltInStatus(
          context.state,
          target.id,
          "marked",
          {
            stacks: 2,
            duration: -1,
            sourceId: context.actor.id,
          },
        );
      } else if (count >= 3) {
        purgeStatuses(
          context.state,
          context.actor.id,
          target.id,
          "positive",
        );
      }
    }

    customStatus(context, context.actor, {
      definitionId: "residual-fire",
      name: "残火",
      icon: "残",
      description:
        "受到燃烧敌人的攻击时，每层燃烧使伤害降低5%(最大降低50%)。回合结束时，敌全体附加攻击力0.75倍燃烧2回合。",
      tags: ["特殊"],
      duration: 3,
    });

    addBuiltInStatus(
      context.state,
      context.actor.id,
      "charge-loss-nullification",
      { stacks: 1 },
    );

    // 保留现有代码中的全体燃烧延长效果。
    for (const enemy of enemies(context)) {
      for (const burning of getStatusesByDefinition(
        enemy,
        "burning",
      )) {
        if (burning.duration >= 0) {
          burning.duration += 1;
        }
      }
    }
  },

  "blue-origin-burst"(context) {
    const level = Number(context.action.data?.level ?? 1);

    const removed = purgeStatuses(
      context.state,
      context.actor.id,
      context.actor.id,
      "negative",
    );

    context.gainCharge(
      context.actor,
      removed.length * (level >= 2 ? 2 : 1),
    );

    context.heal(context.actor, 30);

    customStatus(context, context.actor, {
      definitionId: "blue-elevation-attack",
      name: "青之升华·攻击",
      icon: "攻",
      description: "攻击力提高30%。",
      tags: ["强化"],
      duration: 3,
      percentModifiers: { attack: 0.3 },
    });

    context.actor.weaponState = {
      ...context.actor.weaponState,
      blueForm: "residual",
      blueLevel: level >= 2 ? level : level + 1,
    };
  },

  "blue-residual-burst"(context) {
    let burningCountTotal = 0;

    for (const enemy of enemies(context)) {
      if (!context.actor.alive) {
        break;
      }

      const burningStatuses = [
        ...getStatusesByDefinition(enemy, "burning"),
      ];

      burningCountTotal += burningStatuses.length;

      context.attack(enemy, 2, "energy", true);

      for (const burning of burningStatuses) {
        if (enemy.alive) {
          context.fixedDamage(
            enemy,
            getStatusNumber(burning, "value"),
            "燃烧",
          );
        }

        if (
          enemy.statuses.some(
            (status) => status.id === burning.id,
          ) &&
          burning.duration >= 0
        ) {
          burning.duration += 1;
        }
      }
    }

    const previousChargeGain =
      context.executionData.blueResidualBurstCharge ?? 0;
    const chargeGained = Math.min(
      4 - previousChargeGain,
      burningCountTotal,
    );

    if (chargeGained > 0) {
      context.executionData.blueResidualBurstCharge =
        previousChargeGain + chargeGained;
      context.gainCharge(context.actor, chargeGained);
    }

    context.actor.weaponState = {
      ...context.actor.weaponState,
      blueForm: "origin",
      blueLevel: Number(context.action.data?.level ?? 1),
    };
  },

  "pale-basic"(context) {
    const target = chosenEnemy(context);
    if (!target) {
      return;
    }

    customStatus(context, context.actor, {
      definitionId: "star-enchantment",
      name: "星附魔",
      icon: "星",
      description:
        "每次攻击随机附加燃烧（攻击力0.5倍）、中毒5、流血2、麻痹或冻结1回合。",
      tags: ["特殊"],
      duration: 2,
    });

    for (let hit = 0; hit < 2; hit += 1) {
      if (!target.alive || !context.actor.alive) {
        break;
      }

      const actual = context.attack(
        target,
        0.5,
        "physical",
      );

      if (actual?.alive) {
        randomPaleAilment(context, actual);
      }
    }
  },

  "pale-skill"(context) {
    const target = chosenEnemy(context);
    if (!target) {
      return;
    }

    customStatus(context, target, {
      definitionId: "damage-taken-increase",
      name: "受伤增加",
      icon: "伤",
      description: "受到的伤害增加35%。",
      tags: ["弱化"],
      stacking: "independent",
      duration: 2,
    });

    randomPaleAilment(context, target);
  },

  "pale-charged-skill"(context) {
    for (const enemy of enemies(context)) {
      addBuiltInStatus(
        context.state,
        enemy.id,
        "taunt",
        {
          duration: 2,
          sourceId: context.actor.id,
        },
      );
    }

    addBuiltInStatus(
      context.state,
      context.actor.id,
      "protector",
      {
        duration: 2,
        sourceId: context.actor.id,
      },
    );

    const ally = context.targets({
      type: "chosen-other-ally",
    })[0];

    if (!ally) {
      context.log(
        `${context.action.name}的其他盟友效果 miss。`,
      );
      return;
    }

    addBuiltInStatus(
      context.state,
      ally.id,
      "damage-nullification",
      {
        duration: 2,
        stacks: 4,
        sourceId: context.actor.id,
      },
    );
  },

  "pale-burst"(context) {
    const primary = chosenEnemy(context);
    if (!primary) {
      return;
    }

    for (const enemy of enemies(context)) {
      if (!context.actor.alive) {
        break;
      }

      const isPrimary = enemy.id === primary.id;

      const ailmentTypes = new Set(
        enemy.statuses
          .filter((status) =>
            getStatusTags(status).some(
              (tag) => tag === "异常" || tag === "DoT",
            ),
          )
          .map((status) => status.definitionId),
      );

      // 这是覆盖敌全体的攻击，不进行单体守护/嘲讽重定向。
      context.attack(
        enemy,
        isPrimary ? 3 : 1,
        "physical",
        true,
      );

      if (!isPrimary) {
        continue;
      }

      for (let index = 0; index < ailmentTypes.size; index += 1) {
        if (!enemy.alive || !context.actor.alive) {
          break;
        }

        context.fixedDamage(
          enemy,
          getEffectiveBattleStat(context.actor, "attack") * 0.5,
          "异常追加伤害",
        );
      }
    }
  },
};

export function hasSpecialActionHandler(
  id: SpecialActionId,
): boolean {
  return typeof handlers[id] === "function";
}

export function executeSpecialAction(
  context: ActionEffectContext,
): void {
  const id = context.action.special;
  if (!id) {
    return;
  }

  const handler = handlers[id];
  if (!handler) {
    throw new Error(`缺少特殊行动处理器：${id}`);
  }

  handler(context);
}