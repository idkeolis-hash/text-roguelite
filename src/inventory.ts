import type {
  CharacterStats,
  ProtagonistDefinition,
} from "./content";

export interface PlayerInventory {
  /**
   * 当前装备的武器。
   */
  equippedWeaponId: string;

  /**
   * 当前装备的主动道具。
   */
  equippedItemId: string;

  /**
   * 已拥有的全部武器。
   */
  ownedWeaponIds: string[];

  /**
   * 已拥有的全部遗物。
   */
  ownedRelicIds: string[];

  /**
   * 已拥有的全部主动道具。
   */
  ownedItemIds: string[];

  /**
   * 已拥有的全部同伴。
   */
  ownedCompanionIds: string[];

  /**
   * 当前上阵的4个同伴位置。
   */
  companionSlots: [
    string | null,
    string | null,
    string | null,
    string | null,
  ];

  /**
   * 当前拥有的金币。
   */
  gold: number;

  /**
   * 本局中获得的永久属性变化。
   */
  statBonuses: CharacterStats;
}

function createEmptyStatBonuses(): CharacterStats {
  return {
    maxHp: 0,
    attack: 0,
    defense: 0,
    speed: 0,
    actionPower: 0,

    strength: 0,
    agility: 0,
    constitution: 0,
    intelligence: 0,
    perception: 0,
    charisma: 0,
  };
}

export function createStartingInventory(
  protagonist: ProtagonistDefinition,
): PlayerInventory {
  const startingWeaponId =
    protagonist.startingWeaponId ??
    "weapon-placeholder";

  const startingItemId =
    protagonist.startingItemId ===
    undefined
      ? "item-test-medicine"
      : protagonist.startingItemId;

  const startingCompanionIds =
    protagonist.startingCompanionIds ??
    ["companion-cat"];

  const companionSlots: [
    string | null,
    string | null,
    string | null,
    string | null,
  ] = [
    startingCompanionIds[0] ?? null,
    startingCompanionIds[1] ?? null,
    startingCompanionIds[2] ?? null,
    startingCompanionIds[3] ?? null,
  ];

  return {
    equippedWeaponId:
      startingWeaponId,

    equippedItemId:
      startingItemId ?? "",

    ownedWeaponIds: [
      startingWeaponId,
    ],

    ownedRelicIds: [
      ...(protagonist.startingRelicIds ??
        []),
    ],

    ownedItemIds:
      startingItemId
        ? [startingItemId]
        : [],

    ownedCompanionIds: [
      ...startingCompanionIds,
    ],

    companionSlots,

    gold: 100,

    statBonuses:
      createEmptyStatBonuses(),
  };
}

/**
 * 将局内属性奖励应用到主控角色。
 */
export function applyInventoryBonuses(
  protagonist: ProtagonistDefinition,
  inventory: PlayerInventory,
): ProtagonistDefinition {
  const nextStats =
    Object.fromEntries(
      Object.entries(
        protagonist.stats,
      ).map(([key, value]) => {
        const statKey =
          key as keyof CharacterStats;

        const bonus =
          inventory.statBonuses[
            statKey
          ] ?? 0;

        return [
          statKey,
          Math.max(0, value + bonus),
        ];
      }),
    ) as unknown as CharacterStats;

  return {
    ...protagonist,
    stats: nextStats,
  };
}