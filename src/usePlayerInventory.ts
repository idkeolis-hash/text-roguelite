import { useCallback, useState } from "react";
import {
  PROTAGONISTS,
  type ProtagonistDefinition,
} from "./content";
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

export function usePlayerInventory() {
  const [inventory, setInventory] = useState<PlayerInventory>(() =>
    createStartingInventory(PROTAGONISTS[0]),
  );

  const prepareInventory = useCallback(
    (protagonist: ProtagonistDefinition) => {
      if (isConfigurationLocked()) {
        return;
      }

      setInventory(createStartingInventory(protagonist));
    },
    [],
  );

  const equipWeapon = useCallback((weaponId: string) => {
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
  }, []);

  const equipItem = useCallback((itemId: string) => {
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
  }, []);

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
    [],
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