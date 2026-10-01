import type { BattleKind, BattleStatus } from "./game";

export function canRetryBattle(
  battleKind: BattleKind,
  status: BattleStatus,
): boolean {
  return battleKind === "tutorial" && status === "lost";
}