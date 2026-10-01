import {
  CHURCH_PAGES,
  OPENING_PAGES,
  PROTAGONISTS,
  SKIP_TUTORIAL_PAGES,
  TUTORIAL_END_PAGES,
  WAKE_UP_PAGES,
} from "./content";
import { getCompendiumEntryById } from "./compendium";
import { FLOW_EVENTS, FLOW_NODES } from "./flow";
import { createStartingInventory } from "./inventory";
import {
  DISCOVERY_KINDS,
  type CurrentRun,
  type GamePhase,
  type UserProgress,
} from "./sessionState";

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getSlotKeys(slot: number) {
  if (!Number.isSafeInteger(slot) || slot < 1) {
    throw new Error("存档槽位必须是正整数。");
  }

  return {
    user: `slot${slot}user`,
    run: `slot${slot}currentrun`,
  };
}

function object(value: unknown): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("存档对象格式错误。");
  }

  return value as Record<string, unknown>;
}

function requireValue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function integer(
  value: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): boolean {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}

function optionalText(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function contentIds(value: unknown, kind: string): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (id) =>
        typeof id === "string" &&
        getCompendiumEntryById(id)?.kind === kind,
    )
  );
}

function validateUser(value: unknown): asserts value is UserProgress {
  const user = object(value);

  requireValue(integer(user.fate, 0), "命运数据格式错误。");
  requireValue(
    Array.isArray(user.discoveredIds) &&
      user.discoveredIds.every((id) => {
        if (typeof id !== "string") {
          return false;
        }

        const entry = getCompendiumEntryById(id);

        return Boolean(
          entry && DISCOVERY_KINDS.includes(entry.kind),
        );
      }) &&
      new Set(user.discoveredIds).size === user.discoveredIds.length,
    "图鉴发现数据格式错误或引用了不存在的内容。",
  );
}

function validateInventory(value: unknown): void {
  const inventory = object(value);

  const ownershipFields = [
    ["ownedWeaponIds", "weapon"],
    ["ownedRelicIds", "relic"],
    ["ownedItemIds", "item"],
    ["ownedCompanionIds", "companion"],
  ] as const;

  for (const [field, kind] of ownershipFields) {
    requireValue(
      contentIds(inventory[field], kind),
      `库存中的 ${field} 格式错误。`,
    );
  }

  const weapons = inventory.ownedWeaponIds as string[];
  const items = inventory.ownedItemIds as string[];
  const companions = inventory.ownedCompanionIds as string[];

  requireValue(
    typeof inventory.equippedWeaponId === "string" &&
      weapons.includes(inventory.equippedWeaponId),
    "装备的武器不在库存中。",
  );

  requireValue(
    typeof inventory.equippedItemId === "string" &&
      (
        inventory.equippedItemId === "" ||
        items.includes(inventory.equippedItemId)
      ),
    "装备的道具不在库存中。",
  );

  requireValue(
    Array.isArray(inventory.companionSlots) &&
      inventory.companionSlots.length === 4 &&
      inventory.companionSlots.every(
        (id) => id === null || companions.includes(id),
      ),
    "同伴位置数据格式错误。",
  );

  requireValue(
    typeof inventory.gold === "number" &&
      Number.isFinite(inventory.gold) &&
      inventory.gold >= 0,
    "金币数据格式错误。",
  );

  const bonuses = object(inventory.statBonuses);
  const template = createStartingInventory(PROTAGONISTS[0]).statBonuses;

  for (const key of Object.keys(template)) {
    requireValue(
      typeof bonuses[key] === "number" &&
        Number.isFinite(bonuses[key]),
      `属性变化 ${key} 格式错误。`,
    );
  }
}

function validReward(value: unknown): boolean {
  const reward = object(value);

  if (
    typeof reward.id !== "string" ||
    typeof reward.name !== "string"
  ) {
    return false;
  }

  const entry = getCompendiumEntryById(reward.id);

  return Boolean(
    entry &&
      DISCOVERY_KINDS.includes(entry.kind) &&
      entry.kind === reward.kind,
  );
}

function validateFlow(value: unknown): void {
  const flow = object(value);

  requireValue(integer(flow.areaNumber, 1, 5), "区域编号格式错误。");
  requireValue(integer(flow.stageIndex, 0, 6), "节点编号格式错误。");

  const view = object(flow.view);

  requireValue(optionalText(view.message), "节点提示格式错误。");

  switch (view.type) {
    case "fool":
      return;

    case "route":
      requireValue(
        Array.isArray(view.options) &&
          view.options.length > 0 &&
          view.options.every(
            (id) =>
              typeof id === "string" &&
              Object.hasOwn(FLOW_NODES, id),
          ),
        "道路选项格式错误。",
      );
      return;

    case "event":
      requireValue(
        FLOW_EVENTS.some(
          (event) =>
            JSON.stringify(event) === JSON.stringify(view.event),
        ) && optionalText(view.resultText),
        "事件数据与当前版本不匹配。",
      );
      return;

    case "shop": {
      requireValue(Array.isArray(view.slots), "商店数据格式错误.");

      const slots = view.slots as unknown[];
      const ids = new Set<string>();

      for (const value of slots) {
        const slot = object(value);

        requireValue(
          typeof slot.id === "string" &&
            !ids.has(slot.id) &&
            typeof slot.price === "number" &&
            Number.isFinite(slot.price) &&
            slot.price >= 0 &&
            typeof slot.sold === "boolean" &&
            validReward(slot.reward),
          "商店商品格式错误。",
        );

        ids.add(slot.id as string);
      }

      return;
    }

    case "rest":
      requireValue(integer(view.picksLeft, 0, 2), "休息次数格式错误。");
      return;

    case "wheel":
      requireValue(integer(view.spins, 0), "抽奖次数格式错误。");
      return;

    case "battle":
      requireValue(
        ["strength", "chariot", "moon"].includes(
          String(view.battleType),
        ),
        "战斗节点类型错误。",
      );
      return;

    case "magician":
    case "reward":
      requireValue(
        Array.isArray(view.rewards) &&
          view.rewards.length > 0 &&
          view.rewards.every(validReward),
        "奖励数据格式错误。",
      );

      if (view.type === "reward") {
        requireValue(
          typeof view.title === "string",
          "奖励标题格式错误。",
        );
      }

      return;

    default:
      throw new Error("无法识别存档中的节点页面。");
  }
}

function validateRun(value: unknown): asserts value is CurrentRun {
  const run = object(value);

  const phases: readonly GamePhase[] = [
    "opening",
    "character-select",
    "wake-up",
    "tutorial-choice",
    "church",
    "battle",
    "tutorial-end",
    "skip-end",
    "flow",
    "complete",
    "failed",
  ];

  requireValue(
    typeof run.phase === "string" &&
      phases.includes(run.phase as GamePhase),
    "流程阶段格式错误。",
  );

  requireValue(
    PROTAGONISTS.some(
      (protagonist) => protagonist.id === run.selectedProtagonistId,
    ),
    "存档中的主控不存在。",
  );

  const pageCounts: Partial<Record<GamePhase, number>> = {
    opening: OPENING_PAGES.length,
    "wake-up": WAKE_UP_PAGES.length,
    church: CHURCH_PAGES.length,
    "tutorial-end": TUTORIAL_END_PAGES.length,
    "skip-end": SKIP_TUTORIAL_PAGES.length,
  };

  const pageCount = pageCounts[run.phase as GamePhase] ?? 1;

  requireValue(
    integer(run.pageIndex, 0, pageCount - 1),
    "剧情页码格式错误。",
  );

  validateInventory(run.inventory);
  validateFlow(run.flow);
}

function decode(text: string): unknown {
  const envelope = object(JSON.parse(text));

  requireValue(
    envelope.version === 1,
    "存档版本不兼容。当前尚未实现存档迁移。",
  );

  return envelope.data;
}

function encode(data: unknown): string {
  return JSON.stringify({
    version: 1,
    data,
  });
}

export function readUser(
  storage: SaveStorage,
  slot: number,
): UserProgress | null {
  const text = storage.getItem(getSlotKeys(slot).user);

  if (text === null) {
    return null;
  }

  const value = decode(text);
  validateUser(value);

  return value;
}

export function readRun(
  storage: SaveStorage,
  slot: number,
): CurrentRun | null {
  const text = storage.getItem(getSlotKeys(slot).run);

  if (text === null) {
    return null;
  }

  const value = decode(text);
  validateRun(value);

  return value;
}

export function writeSlot(
  storage: SaveStorage,
  slot: number,
  user: UserProgress,
  checkpoint: CurrentRun,
): void {
  const keys = getSlotKeys(slot);

  // 先生成两份字符串，避免序列化失败后只写入一份。
  const userText = encode(user);
  const runText = encode(checkpoint);

  storage.setItem(keys.user, userText);
  storage.setItem(keys.run, runText);
}