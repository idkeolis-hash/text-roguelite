import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createDebugSession,
  createNormalSession,
} from "./gameSession";
import {
  getSlotKeys,
  readRun,
  readUser,
  type SaveStorage,
} from "./saveStorage";
import {
  getCompendiumEntries,
} from "./compendium";
import {
  grantInventoryReward,
} from "./inventoryRewards";

function memoryStorage() {
  const values = new Map<string, string>();

  const storage: SaveStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };

  return {
    storage,
    values,
  };
}

describe("游戏会话与存档", () => {
  it("新建 normal 使用独立的 user 和 currentrun 键", () => {
    const { storage, values } = memoryStorage();

    createNormalSession(storage, 1, true);

    expect(values.has("slot1user")).toBe(true);
    expect(values.has("slot1currentrun")).toBe(true);
    expect(readRun(storage, 1)?.phase).toBe("opening");
  });

  it("不同槽位不共享命运", () => {
    const { storage } = memoryStorage();

    const slot1 = createNormalSession(storage, 1, true);
    slot1.gainFate(3);

    const slot2 = createNormalSession(storage, 2, true);

    expect(slot2.getSnapshot().user.fate).toBe(0);
    expect(readUser(storage, 1)?.fate).toBe(3);
    expect(readUser(storage, 2)?.fate).toBe(0);
  });

  it("新开一局保留命运和图鉴，重置本局流程", () => {
    const { storage } = memoryStorage();
    const session = createNormalSession(storage, 1, true);

    session.setRunField("phase", "wake-up");
    session.gainFate(2);
    session.setFlowField("areaNumber", 4);

    const discovered =
      session.getSnapshot().user.discoveredIds;

    session.restart();

    const state = session.getSnapshot();

    expect(state.user.fate).toBe(2);
    expect(state.user.discoveredIds).toEqual(discovered);
    expect(state.run.phase).toBe("opening");
    expect(state.run.flow.areaNumber).toBe(1);
    expect(state.run.flow.stageIndex).toBe(0);
    expect(state.run.flow.view.type).toBe("fool");
  });

  it("节点中途的本局变化不会替换检查点", () => {
    const { storage } = memoryStorage();
    const session = createNormalSession(storage, 1, true);

    session.setRunField("phase", "flow");
    session.checkpoint();

    const gold = session.getSnapshot().run.inventory.gold;

    session.setInventory((inventory) => ({
      ...inventory,
      gold: inventory.gold + 50,
    }));

    const restored = createNormalSession(storage, 1, false);

    expect(restored.getSnapshot().run.inventory.gold).toBe(gold);
  });

  it("先发奖励再完成节点，保存的是结算后的库存", () => {
    const { storage } = memoryStorage();
    const session = createNormalSession(storage, 1, true);

    session.setRunField("phase", "flow");
    session.checkpoint();

    session.setInventory((inventory) => ({
      ...inventory,
      gold: inventory.gold + 25,
    }));

    session.setFlowField("stageIndex", 1);
    session.setFlowField("view", {
      type: "battle",
      battleType: "strength",
    });

    session.checkpoint();

    const restored = createNormalSession(storage, 1, false);

    expect(restored.getSnapshot().run.inventory.gold).toBe(125);
    expect(restored.getSnapshot().run.flow.stageIndex).toBe(1);
    expect(restored.getSnapshot().run.flow.view).toEqual({
      type: "battle",
      battleType: "strength",
    });
  });

  it("实际获得新内容后永久记录发现，但不提交未完成节点", () => {
    const { storage } = memoryStorage();
    const session = createNormalSession(storage, 1, true);

    session.setRunField("phase", "flow");
    session.checkpoint();

    const owned = session.getSnapshot().run.inventory.ownedWeaponIds;

    const weapon = getCompendiumEntries("weapon").find(
      (entry) => !owned.includes(entry.id),
    );

    expect(weapon).toBeDefined();

    if (!weapon) {
      throw new Error("测试需要至少一件尚未拥有的武器。");
    }

    session.setInventory((inventory) =>
      grantInventoryReward(inventory, {
        kind: "weapon",
        id: weapon.id,
        name: weapon.name,
      }),
    );

    expect(
      readUser(storage, 1)?.discoveredIds,
    ).toContain(weapon.id);

    expect(
      readRun(storage, 1)?.inventory.ownedWeaponIds,
    ).not.toContain(weapon.id);
  });

  it("正式失败立即成为新的检查点", () => {
    const { storage } = memoryStorage();
    const session = createNormalSession(storage, 1, true);

    session.setRunField("phase", "flow");
    session.checkpoint();
    session.endRun();

    const restored = createNormalSession(storage, 1, false);

    expect(restored.getSnapshot().run.phase).toBe("failed");
  });

  it("debug 不读写 normal，且每次创建都是干净会话", () => {
    const { storage } = memoryStorage();

    createNormalSession(storage, 1, true);

    const getSpy = vi.spyOn(storage, "getItem");
    const setSpy = vi.spyOn(storage, "setItem");

    const first = createDebugSession();

    first.gainFate(9);
    first.setRunField("phase", "flow");
    first.setFlowField("areaNumber", 5);
    first.checkpoint();
    first.endRun();

    const second = createDebugSession();

    expect(second.getSnapshot().user.fate).toBe(0);
    expect(second.getSnapshot().run.phase).toBe("opening");
    expect(second.getSnapshot().run.flow.areaNumber).toBe(1);

    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("坏档报错，不会被继续操作自动覆盖", () => {
    const { storage, values } = memoryStorage();

    createNormalSession(storage, 1, true);

    const key = getSlotKeys(1).run;
    values.set(key, "{ broken json");

    expect(
      () => createNormalSession(storage, 1, false),
    ).toThrow();

    expect(values.get(key)).toBe("{ broken json");
  });

  it("存储失败会暴露错误，重试保存不会提交未完成节点", () => {
    const { storage } = memoryStorage();
    const session = createNormalSession(storage, 1, true);

    const checkpointGold =
      session.getSnapshot().run.inventory.gold;

    session.setInventory((inventory) => ({
      ...inventory,
      gold: inventory.gold + 20,
    }));

    const spy = vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("测试：存储空间不足");
    });

    session.retrySave();

    expect(session.getSnapshot().saveError).toContain(
      "存储空间不足",
    );

    spy.mockRestore();
    session.retrySave();

    expect(session.getSnapshot().saveError).toBeNull();
    expect(readRun(storage, 1)?.inventory.gold).toBe(
      checkpointGold,
    );
  });
});