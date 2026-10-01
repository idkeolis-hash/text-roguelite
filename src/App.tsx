import GameContent from "./GameContent";
import CompendiumDock from "./CompendiumDock";
import { usePlayerInventory } from "./usePlayerInventory";

export default function App() {
  const {
    inventory,
    setInventory,
    prepareInventory,
    equipWeapon,
    equipItem,
    setCompanionSlot,
  } = usePlayerInventory();

  return (
    <>
      <GameContent
        inventory={inventory}
        setInventory={setInventory}
        onPrepareInventory={prepareInventory}
      />
      <CompendiumDock
        inventory={inventory}
        onEquipWeapon={equipWeapon}
        onEquipItem={equipItem}
        onSetCompanionSlot={setCompanionSlot}
      />
    </>
  );
}