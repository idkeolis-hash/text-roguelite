import { PROTAGONISTS } from "./content";
import {
  getCompendiumEntryById,
  type CompendiumKind,
} from "./compendium";
import {
  createStartingInventory,
  type PlayerInventory,
} from "./inventory";
import type {
  FlowEventDefinition,
  FlowNodeId,
  FlowReward,
  FlowShopSlot,
} from "./flow";
import type { PlaceholderBattleType } from "./game";

export type GameMode = "debug" | "normal";

export type GamePhase =
  | "opening"
  | "character-select"
  | "wake-up"
  | "tutorial-choice"
  | "church"
  | "battle"
  | "tutorial-end"
  | "skip-end"
  | "flow"
  | "complete"
  | "failed";

export type FlowView =
  | { type: "fool" }
  | { type: "route"; options: FlowNodeId[] }
  | {
      type: "event";
      event: FlowEventDefinition;
      resultText?: string;
    }
  | {
      type: "shop";
      slots: FlowShopSlot[];
      message?: string;
    }
  | {
      type: "rest";
      picksLeft: number;
      message?: string;
    }
  | {
      type: "magician";
      rewards: FlowReward[];
    }
  | {
      type: "wheel";
      spins: number;
      message?: string;
    }
  | {
      type: "battle";
      battleType: PlaceholderBattleType;
    }
  | {
      type: "reward";
      rewards: FlowReward[];
      title: string;
    };

export interface FlowState {
  areaNumber: number;
  stageIndex: number;
  view: FlowView;
}

export interface UserProgress {
  fate: number;
  discoveredIds: string[];
}

export interface CurrentRun {
  selectedProtagonistId: string;
  phase: GamePhase;
  pageIndex: number;
  inventory: PlayerInventory;
  flow: FlowState;
}

export const DISCOVERY_KINDS: readonly CompendiumKind[] = [
  "weapon",
  "relic",
  "item",
  "companion",
];

export function createUserProgress(): UserProgress {
  return {
    fate: 0,
    discoveredIds: [],
  };
}

export function createCurrentRun(): CurrentRun {
  return {
    selectedProtagonistId: PROTAGONISTS[0].id,
    phase: "opening",
    pageIndex: 0,
    inventory: createStartingInventory(PROTAGONISTS[0]),
    flow: {
      areaNumber: 1,
      stageIndex: 0,
      view: { type: "fool" },
    },
  };
}

export function discoverInventory(
  user: UserProgress,
  inventory: PlayerInventory,
): UserProgress {
  const ids = [
    ...inventory.ownedWeaponIds,
    ...inventory.ownedRelicIds,
    ...inventory.ownedItemIds,
    ...inventory.ownedCompanionIds,
  ];

  const discovered = new Set(user.discoveredIds);

  for (const id of ids) {
    const entry = getCompendiumEntryById(id);

    if (entry && DISCOVERY_KINDS.includes(entry.kind)) {
      discovered.add(id);
    }
  }

  if (discovered.size === user.discoveredIds.length) {
    return user;
  }

  return {
    ...user,
    discoveredIds: [...discovered],
  };
}