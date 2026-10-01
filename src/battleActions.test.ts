import { afterEach, describe, expect, it, vi } from "vitest";
import {
  performEnemyAction,
  performPlayerAction,
  type BattleState,
  type BattleUnit,
} from "./game";
import {
  getActionAvailability,
  getUnitActionInfo,
  resolveCombatTargets,
} from "./battleActions";
import {
  addBuiltInStatus,
  addBurningStatuses,
  addStatus,
  getStatusByDefinition,
  getStatusesByDefinition,
  hasStatus,
} from "./statuses";
import { COMBATANT_DEFINITIONS } from "./combatants";
import { getWeaponActionDefinitions } from "./weaponActions";

function unit(
  id: string,
  role: string,
  side: "player" | "enemy",
  tieOrder: number,
): BattleUnit {
  return {
    id,
    name: id,
    role,
    side,
    maxHp: 10000,
    hp: 10000,
    attack: 100,
    defense: 0,
    speed: side === "player" ? 1000 : 1,
    actionPower: 10,
    strength: 1,
    agility: 1,
    constitution: 1,
    intelligence: 1,
    perception: 1,
    charisma: 1,
    nextActionAt: side === "player" ? 10 : 10000,
    tieOrder,
    apLeft: 10,
    alive: true,
    guarded: false,
    charge: 0,
    maxCharge: 5,
    actionsTaken: 0,
    fullChargeActionsUsed: 0,
    relicIds: [],
    hookIds: [],
    hookUsage: {},
    statuses: [],
    weaponState: {
      blueForm: "origin",
      blueLevel: 1,
    },
  };
}

function battle(
  weaponId = "weapon-training-sword",
): BattleState {
  return {
    battleKind: "standard",
    units: [
      unit("player", "player", "player", 0),
      unit("enemy", "scythe-soldier", "enemy", 1),
      unit("ally-1", "cat-companion", "player", 2),
      unit("ally-2", "cat-companion", "player", 4),
    ],
    currentActorId: "player",
    roundNumber: 1,
    status: "playing",
    logs: [],
    equippedWeaponId: weaponId,
    equippedItemId: "",
    itemUsesLeft: 0,
    playerActivations: 1,
    teleporting: false,
    actionSerial: 0,
    nextStatusId: 1,
  };
}

function use(
  state: BattleState,
  category: string,
  enemyId: string | null = "enemy",
  allyId: string | null = "player",
): BattleState {
  const actor = state.units.find(
    (candidate) => candidate.id === "player",
  )!;

  const action = getUnitActionInfo(actor, state).find(
    (candidate) => candidate.category === category,
  )!;

  return performPlayerAction(
    state,
    actor.id,
    action.id,
    { enemyId, allyId },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("公共行动定义", () => {
  it("不同单位的同类别行动具有不同识别码", () => {
    const ids = COMBATANT_DEFINITIONS.flatMap(
      (definition) =>
        definition.actions.map((action) => action.id),
    );

    expect(new Set(ids).size).toBe(ids.length);

    for (const definition of COMBATANT_DEFINITIONS) {
      for (const action of definition.actions) {
        expect(action.id).toContain(`${definition.id}:`);
      }
    }
  });

  it("青羽形态拥有不同的具体行动 ID", () => {
    const origin = getWeaponActionDefinitions(
      "weapon-blue-slayer",
      "origin",
      1,
    );
    const residual = getWeaponActionDefinitions(
      "weapon-blue-slayer",
      "residual",
      2,
    );

    expect(
      origin.find((action) => action.category === "skill")?.id,
    ).not.toBe(
      residual.find((action) => action.category === "skill")?.id,
    );
  });
});

describe("目标与可用性", () => {
  it("选择自己时，其他盟友效果回退到位置最低的合法盟友", () => {
    const state = battle();
    const actor = state.units[0];

    expect(
      resolveCombatTargets(
        state,
        actor,
        { enemyId: null, allyId: actor.id },
        { type: "chosen-other-ally" },
      ).map((target) => target.id),
    ).toEqual(["ally-1"]);
  });

  it("明确选择其他盟友时，不擅自替换成第一名同伴", () => {
    const state = battle();

    expect(
      resolveCombatTargets(
        state,
        state.units[0],
        { enemyId: null, allyId: "ally-2" },
        { type: "chosen-other-ally" },
      ).map((target) => target.id),
    ).toEqual(["ally-2"]);
  });

  it("无其他盟友时，只有该目标效果 miss", () => {
    const state = battle("weapon-endless-pale-sword");
    state.units = state.units.slice(0, 2);
    state.units[0].charge = 5;

    const next = use(state, "charged-skill", null);

    expect(hasStatus(next.units[0], "protector")).toBe(true);
    expect(hasStatus(next.units[1], "taunt")).toBe(true);
    expect(next.units[0].charge).toBe(4);
    expect(next.units[0].actionsTaken).toBe(1);
  });

  it("彩虹自身治疗不需要敌人选择", () => {
    const state = battle("weapon-rainbow");
    state.units[0].charge = 5;
    state.units[0].hp = 1000;

    const next = use(state, "charged-skill", null);

    expect(next.units[0].hp).toBe(3000);
    expect(next.units[0].charge).toBe(4);
    expect(hasStatus(next.units[0], "riding-the-wind")).toBe(true);
  });

  it("沉默判断与实际入口一致，拒绝时不消耗行动", () => {
    const state = battle();
    addBuiltInStatus(state, "player", "silenced");

    const action = getUnitActionInfo(
      state.units[0],
      state,
    ).find((candidate) => candidate.category === "skill")!;

    expect(
      getActionAvailability(
        state,
        "player",
        action.id,
        { enemyId: "enemy", allyId: "player" },
      ).allowed,
    ).toBe(false);

    const next = use(state, "skill");

    expect(next.units[0].apLeft).toBe(10);
    expect(next.units[0].actionsTaken).toBe(0);
    expect(next.units[1].hp).toBe(10000);
  });
});

describe("行动执行与结算", () => {
  it("彩虹低血重复效果仍只获得一次普攻基础蓄能", () => {
    const state = battle("weapon-rainbow");
    state.units[1].hp = 4000;

    const next = use(state, "basic");

    expect(next.units[0].charge).toBe(1);
    expect(
      getStatusesByDefinition(next.units[0], "double-rainbow-speed"),
    ).toHaveLength(2);
  });

  it("青焰怒火按伤害最终数值增加而非提高攻击倍率", () => {
    const state = battle("weapon-blue-slayer");
    state.units[0].weaponState = {
      blueForm: "residual",
      blueLevel: 2,
    };
    state.units[1].defense = 97;
    addBurningStatuses(state, ["enemy"], {
      value: 1,
      duration: 3,
      sourceId: "player",
    });
    addBurningStatuses(state, ["enemy"], {
      value: 1,
      duration: 3,
      sourceId: "player",
    });

    const next = use(state, "basic");

    expect(next.units[1].hp).toBe(9958);
  });

  it("弑王者之焰在燃烧达到3层时净化正面状态而非负面", () => {
    const state = battle("weapon-blue-slayer");
    state.units[0].weaponState = {
      blueForm: "residual",
      blueLevel: 2,
    };
    state.units[0].charge = 5;
    for (let index = 0; index < 3; index += 1) {
      addBurningStatuses(state, ["enemy"], {
        value: 1,
        duration: 3,
        sourceId: "player",
      });
    }
    addStatus(state, "enemy", {
      definitionId: "test-buff",
      name: "测试强化",
      icon: "强",
      description: "测试正面状态。",
      tags: ["强化"],
      duration: 3,
    });
    addBuiltInStatus(state, "enemy", "frozen", { duration: 2 });

    const next = use(state, "charged-skill");

    expect(hasStatus(next.units[1], "test-buff")).toBe(false);
    expect(hasStatus(next.units[1], "frozen")).toBe(true);
  });

  it("燃烧被免疫时不会增加蚀火层数", () => {
    const state = battle();
    addStatus(state, "enemy", {
      definitionId: "erosion-fire",
      name: "蚀火",
      icon: "蚀",
      description: "测试蚀火。",
      tags: ["特殊"],
      stacking: "layers",
      stacks: 1,
      duration: -1,
    });
    addBuiltInStatus(state, "enemy", "invincible");

    addBurningStatuses(state, ["enemy"], {
      value: 1,
      duration: 2,
      sourceId: "player",
    });

    expect(getStatusByDefinition(state.units[1], "erosion-fire")?.stacks).toBe(1);
  });

  it("无尽的青焰之兽整次行动蓄能最多增加4", () => {
    const state = battle("weapon-blue-slayer");
    state.units[0].weaponState = {
      blueForm: "residual",
      blueLevel: 2,
    };
    state.units[0].charge = 5;
    addBuiltInStatus(state, "player", "reprise", { stacks: 1 });
    const secondEnemy = unit(
      "enemy-2",
      "shield-soldier",
      "enemy",
      3,
    );
    state.units.push(secondEnemy);

    for (const enemyId of ["enemy", "enemy-2"]) {
      for (let index = 0; index < 3; index += 1) {
        addBurningStatuses(state, [enemyId], {
          value: 1,
          duration: 3,
          sourceId: "player",
        });
      }
    }

    const next = use(state, "burst", null);

    expect(next.units[0].charge).toBe(4);
  });

  it("星附魔随机附加指定数值且持续1回合的异常", () => {
    const state = battle("weapon-endless-pale-sword");
    vi.spyOn(Math, "random").mockReturnValue(0);

    const next = use(state, "basic");

    expect(getStatusByDefinition(next.units[1], "burning")?.data.value).toBe(50);
    expect(getStatusByDefinition(next.units[1], "burning")?.duration).toBe(1);
    expect(getStatusByDefinition(next.units[1], "poison")?.data.value).toBe(5);
    expect(getStatusByDefinition(next.units[1], "poison")?.duration).toBe(1);
  });

  it("无尽苍剑正确作用于指定盟友", () => {
    const state = battle("weapon-endless-pale-sword");
    state.units[0].charge = 5;

    const next = use(
      state,
      "charged-skill",
      null,
      "ally-2",
    );

    expect(hasStatus(next.units[2], "damage-nullification")).toBe(false);
    expect(
      getStatusByDefinition(
        next.units[3],
        "damage-nullification",
      )?.stacks,
    ).toBe(4);

    expect(
      getStatusByDefinition(next.units[1], "taunt")?.data.sourceId,
    ).toBe("player");
  });

  it("复起重复效果，但只消耗一次行动力和基础蓄能规则", () => {
    const state = battle();
    addBuiltInStatus(state, "player", "reprise", { stacks: 1 });

    const next = use(state, "basic");

    expect(next.units[0].apLeft).toBe(9);
    expect(next.units[0].actionsTaken).toBe(1);
    expect(next.units[0].charge).toBe(1);
    expect(hasStatus(next.units[0], "reprise")).toBe(false);

    const hits = next.logs.filter(
      (log) => log.includes("造成") && log.includes("伤害"),
    );
    expect(hits).toHaveLength(2);
  });

  it("青羽爆发先支付旧蓄能，保留效果获得的新蓄能", () => {
    const state = battle("weapon-blue-slayer");
    state.units[0].charge = 5;
    addBuiltInStatus(state, "player", "silenced");

    const next = use(state, "burst", null);

    expect(next.units[0].charge).toBe(1);
    expect(next.units[0].weaponState?.blueForm).toBe("residual");
    expect(next.units[0].weaponState?.blueLevel).toBe(2);
  });

  it("青羽残火技能按每个目标独立计算概率并治疗", () => {
    const state = battle("weapon-blue-slayer");
    state.units[0].weaponState = {
      blueForm: "residual",
      blueLevel: 2,
    };
    state.units[0].hp = 1000;

    const secondEnemy = unit(
      "enemy-2",
      "shield-soldier",
      "enemy",
      3,
    );
    state.units.push(secondEnemy);

    addBurningStatuses(state, ["enemy"], {
      value: 1,
      duration: 3,
      sourceId: "player",
    });

    vi.spyOn(Math, "random").mockReturnValue(0.45);

    const next = use(state, "skill", null);

    expect(hasStatus(next.units[1], "fear")).toBe(true);
    expect(
      hasStatus(
        next.units.find((candidate) => candidate.id === "enemy-2")!,
        "fear",
      ),
    ).toBe(false);

    expect(next.units[0].hp).toBe(1600);
  });

  it("全体攻击不会被守护重定向为只打同一个敌人", () => {
    const state = battle();
    state.units[0].charge = 5;

    const secondEnemy = unit(
      "enemy-2",
      "shield-soldier",
      "enemy",
      3,
    );
    state.units.push(secondEnemy);

    addBuiltInStatus(state, "enemy", "protector");

    const next = use(state, "burst", null);

    expect(next.units[1].hp).toBeLessThan(10000);
    expect(
      next.units.find((candidate) => candidate.id === "enemy-2")!.hp,
    ).toBeLessThan(10000);
  });

  it("特殊武器击杀最后一个敌人后结束正式战斗", () => {
    const state = battle("weapon-endless-pale-sword");
    state.units[1].hp = 1;

    const next = use(state, "basic");

    expect(next.status).toBe("won");
    expect(next.currentActorId).toBeNull();
    expect(next.units[0].apLeft).toBe(9);
  });

  it("敌人使用同一个行动入口并完成公共结算", () => {
    const state = battle();
    state.currentActorId = "enemy";

    const next = performEnemyAction(state);

    expect(next.units[1].actionsTaken).toBe(1);
    expect(next.units[1].apLeft).toBe(9);
    expect(next.units[0].hp).toBeLessThan(10000);
  });

  it("残火攻击附加燃烧到实际受击者", () => {
    const state = battle("weapon-blue-slayer");
    state.units[0].weaponState = {
      blueForm: "residual",
      blueLevel: 2,
    };

    const protector = unit(
      "enemy-protector",
      "shield-soldier",
      "enemy",
      3,
    );
    state.units.push(protector);
    addBuiltInStatus(state, protector.id, "protector");

    const next = use(state, "basic");

    expect(
      getStatusesByDefinition(next.units[1], "burning"),
    ).toHaveLength(0);

    expect(
      getStatusesByDefinition(
        next.units.find(
          (candidate) => candidate.id === protector.id,
        )!,
        "burning",
      ),
    ).toHaveLength(1);
  });

  it("高速单位的第二动可以早于低速单位第一动", () => {
    const state = battle();
    state.units = state.units.slice(0, 2);
    state.units[0].apLeft = 2;
    state.units[0].actionPower = 2;

    const next = use(state, "charge", null);

    expect(next.currentActorId).toBe("player");
    expect(next.units[0].apLeft).toBe(1);
    expect(next.units[1].actionsTaken).toBe(0);
  });
});