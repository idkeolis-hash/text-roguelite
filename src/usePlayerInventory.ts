import {
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ProtagonistDefinition } from "./content";
import {
  createStartingInventory,
  type PlayerInventory,
} from "./inventory";
import { isConfigurationLocked } from "./configurationLock";
import {
  changeInventoryCompanionSlot,
  equipInventoryItem,
  equipInventoryWeapon,
} from "./inventoryConfiguration";

export function usePlayerInventory(
  inventory: PlayerInventory,
  setInventory: Dispatch<SetStateAction<PlayerInventory>>,
) {
  const prepareInventory = useCallback(
    (protagonist: ProtagonistDefinition) => {
      if (isConfigurationLocked()) {
        return;
      }

      setInventory(createStartingInventory(protagonist));
    },
    [setInventory],
  );

  const equipWeapon = useCallback(
    (weaponId: string) => {
      if (isConfigurationLocked()) {
        return;
      }

      setInventory((current) =>
        equipInventoryWeapon(
          current,
          weaponId,
          isConfigurationLocked(),
        ),
      );
    },
    [setInventory],
  );

  const equipItem = useCallback(
    (itemId: string) => {
      if (isConfigurationLocked()) {
        return;
      }

      setInventory((current) =>
        equipInventoryItem(
          current,
          itemId,
          isConfigurationLocked(),
        ),
      );
    },
    [setInventory],
  );

  const setCompanionSlot = useCallback(
    (slotIndex: number, companionId: string | null) => {
      if (isConfigurationLocked()) {
        return;
      }

      setInventory((current) =>
        changeInventoryCompanionSlot(
          current,
          slotIndex,
          companionId,
          isConfigurationLocked(),
        ),
      );
    },
    [setInventory],
  );

  return {
    inventory,
    setInventory,
    prepareInventory,
    equipWeapon,
    equipItem,
    setCompanionSlot,
  };
}