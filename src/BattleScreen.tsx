import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { ProtagonistDefinition } from "./content";
import type { PlayerInventory } from "./inventory";
import {
  createTutorialBattle,
  getCurrentActor,
  getActionAvailability,
  getUnitActionInfo,
  performEnemyAction,
  performPlayerAction,
  type BattleState,
  type BattleUnit,
  type PlayerActionId,
} from "./game";
import {
  getItemById,
} from "./compendium";
import {
  getEffectiveBattleStat,
  getStatusTags,
  type BattleStatusEffect,
} from "./statuses";
import { useBattleConfigurationLock } from "./configurationLock";

import { canRetryBattle } from "./battleLifecycle";

function ChargeDiamonds(props: {
  charge: number;
  maxCharge: number;
}) {
  return (
    <span
      className="charge-diamonds"
      aria-label={`蓄能 ${props.charge}/${props.maxCharge}`}
    >
      {Array.from({
        length: props.maxCharge,
      }).map((_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={
            index < props.charge
              ? "diamond-filled"
              : "diamond-empty"
          }
        >
          {index < props.charge ? "◆" : "◇"}
        </span>
      ))}
    </span>
  );
}


function StatusBadges(props: {
  statuses: BattleStatusEffect[];
}) {
  if (props.statuses.length === 0) {
    return null;
  }

  return (
    <span className="status-badge-list">
      {props.statuses.map(
        (status) => {
          const cooldown =
            status.definitionId ===
            "draw-sword"
              ? Number(
                  status.data
                    .cooldownActions ??
                    0,
                )
              : null;

          const cooldownText =
            cooldown !== null
              ? `\n冷却：${
                  cooldown <= 0
                    ? "可以触发"
                    : `还需${cooldown}次行动`
                }`
              : "";

          const currentEffect = [
            status.duration < 0
              ? "永久"
              : `${status.duration}回合`,
            status.stacks > 1
              ? `${status.stacks}层`
              : "",
          ].filter(Boolean).join(" · ");

          return (
            <span
              key={status.id}
              className={[
                "status-badge",
                ...getStatusTags(status).map(
                  (tag) => `status-tag-${tag}`,
                ),
              ].join(" ")}
              title={
                `${status.name}\n${status.description}\n当前：${currentEffect}${cooldownText}`
              }
            >
              {status.icon.slice(0, 1)}
            </span>
          );
        },
      )}
    </span>
  );
}

function UnitNameRow(props: {
  unit: BattleUnit;
  prominent?: boolean;
  showStatuses?: boolean;
}) {
  return (
    <div
      className={[
        "unit-name-row",
        props.prominent
          ? "prominent-unit-name-row"
          : "",
      ].join(" ")}
    >
      <div className="unit-name-group">
       <strong>{props.unit.name}</strong>

        {props.showStatuses && (
          <StatusBadges
            statuses={
              props.unit.statuses
            }
          />
        )}

        {!props.unit.alive && (
          <span className="compact-defeated-mark">
            无法战斗
          </span>
        )}
      </div>

      <span
        className="unit-action-power"
        title="行动力"
      >
        M <strong>{props.unit.actionPower}</strong>
      </span>
    </div>
  );
}

/**
 * 详细信息区域使用。
 * 阵列内部不显示A、D、S。
 */
function SimpleStats(props: {
  unit: BattleUnit;
}) {
  const attack = Math.round(
    getEffectiveBattleStat(
      props.unit,
      "attack",
    ) * 10,
  ) / 10;

  const defense = Math.round(
    getEffectiveBattleStat(
      props.unit,
      "defense",
    ) * 10,
  ) / 10;

  const speed = Math.round(
    getEffectiveBattleStat(
      props.unit,
      "speed",
    ) * 10,
  ) / 10;

  return (
    <div
      className="simple-stats"
      title="A：实际攻击　D：实际防御　S：实际速度"
    >
      <span>
        A <strong>{attack}</strong>
      </span>

      <span>
        D <strong>{defense}</strong>
      </span>

      <span>
        S <strong>{speed}</strong>
      </span>
    </div>
  );
}

/**
 * 阵列中的单位仅显示：
 *
 * 名字                  M
 * HP数字
 * HP条
 * 蓄能
 */
function UnitReadout(props: {
  unit: BattleUnit;
}) {
  const hpPercent =
    props.unit.maxHp <= 0
      ? 0
      : (props.unit.hp / props.unit.maxHp) * 100;

  const safeHpPercent = Math.max(
    0,
    Math.min(100, hpPercent),
  );

  return (
    <div className="unit-readout">
      <UnitNameRow unit={props.unit} />

      <div className="compact-health-text">
        <span>HP</span>

        <span>
          {props.unit.hp}/{props.unit.maxHp}
        </span>
      </div>

      <div className="compact-health-bar">
        <div
          className="compact-health-fill"
          style={{
            width: `${safeHpPercent}%`,
          }}
        />
      </div>

      <ChargeDiamonds
        charge={props.unit.charge}
        maxCharge={props.unit.maxCharge}
      />

      {props.unit.guarded && (
        <span className="compact-status-tag">
          防御
        </span>
      )}
    </div>
  );
}

function EnemyFormation(props: {
  enemies: BattleUnit[];
  currentActorId: string | null;
  selectedTargetId: string;
  onSelect: (id: string) => void;
}) {
  const enemyCount = Math.min(
    5,
    props.enemies.length,
  );

  return (
    <div
      className={`enemy-formation enemy-count-${enemyCount}`}
    >
      {props.enemies
        .slice(0, 5)
        .map((enemy, index) => {
          const selected =
            enemy.id === props.selectedTargetId;

          const current =
            enemy.id === props.currentActorId;

          return (
            <button
              type="button"
              key={enemy.id}
              className={[
                "enemy-piece",
                `enemy-slot-${index + 1}`,
                selected
                  ? "selected-piece"
                  : "",
                current
                  ? "current-piece"
                  : "",
                !enemy.alive
                  ? "defeated-piece"
                  : "",
              ].join(" ")}
              disabled={!enemy.alive}
              aria-pressed={selected}
              onClick={() =>
                props.onSelect(enemy.id)
              }
            >
              <div className="enemy-piece-content">
                <UnitReadout unit={enemy} />
              </div>
            </button>
          );
        })}
    </div>
  );
}

function PlayerFormation(props: {
  units: BattleUnit[];
  currentActorId: string | null;
  selectedUnitId: string;
  onSelect: (id: string) => void;
}) {
  const protagonist =
    props.units.find(
      (unit) => unit.id === "player",
    ) ?? props.units[0];

  const companions = props.units
    .filter(
      (unit) =>
        unit.id !== protagonist?.id,
    )
    .slice(0, 4);

  const companionCount = companions.length;

  function getUnitClasses(
    unit: BattleUnit,
    baseClass: string,
  ) {
    return [
      baseClass,
      "selectable-player-unit",
      unit.id === props.currentActorId
        ? "current-player-unit"
        : "",
      unit.id === props.selectedUnitId
        ? "selected-player-unit"
        : "",
      !unit.alive
        ? "defeated-player-unit"
        : "",
    ].join(" ");
  }

  return (
    <div
      className={[
        "player-formation",
        `has-${companionCount}-companions`,
      ].join(" ")}
    >
      {protagonist && (
        <button
          type="button"
          className={getUnitClasses(
            protagonist,
            "player-main-unit",
          )}
          aria-pressed={
            protagonist.id ===
            props.selectedUnitId
          }
          onClick={() =>
            props.onSelect(protagonist.id)
          }
        >
          <UnitReadout unit={protagonist} />
        </button>
      )}

      {companionCount > 0 ? (
        <div
          className={[
            "companion-row",
            `companion-count-${companionCount}`,
          ].join(" ")}
        >
          {companions.map((companion) => (
            <button
              type="button"
              key={companion.id}
              className={getUnitClasses(
                companion,
                "companion-unit",
              )}
              aria-pressed={
                companion.id ===
                props.selectedUnitId
              }
              onClick={() =>
                props.onSelect(companion.id)
              }
            >
              <UnitReadout unit={companion} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-companion-row">
          暂无同伴
        </div>
      )}
    </div>
  );
}

function BattleScreen(props: {
  protagonist: ProtagonistDefinition;
  inventory: PlayerInventory;
  onComplete: () => void;
  onDefeat?: () => void;

  createBattle?: () => BattleState;

  eyebrow?: string;
  title?: string;
  objective?: string;
  completeText?: string;
}) {
  function createCurrentBattle() {
    if (props.createBattle) {
      return props.createBattle();
    }

    return createTutorialBattle(
      props.protagonist,
      props.inventory,
    );
  }

  const [battle, setBattle] =
    useState<BattleState>(() =>
      createCurrentBattle(),
    );

  /**
   * 当前选中的敌方攻击目标。
   */
  const [
    selectedTargetId,
    setSelectedTargetId,
  ] = useState<string>(
    props.createBattle
      ? "flow-enemy-0"
      : "enemy-mage",
  );

  /**
   * 当前正在查看的我方单位。
   *
   * 它不一定是当前行动者。
   */
  const [
    selectedPlayerUnitId,
    setSelectedPlayerUnitId,
  ] = useState<string>("player");

  /**
   * 行动的盟友目标，与当前查看/操作的单位分开。
   */
  const [
    selectedAllyTargetId,
    setSelectedAllyTargetId,
  ] = useState<string>("player");

  const logEndRef =
    useRef<HTMLDivElement | null>(null);

  const defeatReportedRef = useRef(false);

  useEffect(() => {
    if (
      battle.status !== "lost" ||
      battle.battleKind !== "standard" ||
      defeatReportedRef.current ||
      !props.onDefeat
    ) {
      return;
    }

    defeatReportedRef.current = true;
    props.onDefeat();
  }, [
    battle.status,
    battle.battleKind,
    props.onDefeat,
  ]);

     useBattleConfigurationLock(
    battle.status === "playing",
  );

  const playerUnits = battle.units.filter(
    (unit) => unit.side === "player",
  );

  const enemies = battle.units.filter(
    (unit) => unit.side === "enemy",
  );

  const selectedPlayerUnit =
    playerUnits.find(
      (unit) =>
        unit.id === selectedPlayerUnitId,
    ) ?? playerUnits[0];

    const equippedItem = getItemById(battle.equippedItemId);

  const displayedActions = selectedPlayerUnit
    ? getUnitActionInfo(selectedPlayerUnit, battle)
    : [];

  const livingSelectedTarget =
    battle.units.find(
      (unit) =>
        unit.id === selectedTargetId &&
        unit.side === "enemy" &&
        unit.alive,
    );

  const selectedEnemy =
    battle.units.find(
      (unit) =>
        unit.id === selectedTargetId &&
        unit.side === "enemy",
    );

  /**
   * 蓄能是所有人的通用行动，
   * 因此不在敌人详细资料中重复显示。
   */
  const selectedEnemyActions =
    selectedEnemy
      ? getUnitActionInfo(
          selectedEnemy,
        ).filter(
          (action) =>
            action.category !== "charge",
        )
      : [];

  /**
   * 当前查看的单位是否真的能够行动。
   *
   * 必须同时满足：
   * 1. 战斗仍在进行；
   * 2. 单位仍然存活；
   * 3. 当前正好轮到该单位；
   * 4. 该单位还有行动力。
   */
  const canSelectedPlayerUnitAct =
    battle.status === "playing" &&
    Boolean(selectedPlayerUnit?.alive) &&
    selectedPlayerUnit?.side ===
      "player" &&
    selectedPlayerUnit?.id ===
      battle.currentActorId &&
    (selectedPlayerUnit?.apLeft ?? 0) > 0;

  // 战斗装备由创建战斗时的库存快照确定。
  // 战斗期间不从背包同步替换道具。

  /**
   * 日志更新后自动滚动到底部。
   */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [battle.logs]);

  /**
   * 轮到我方单位时，
   * 自动切换到该行动者。
   *
   * 玩家仍然可以点击其他我方单位查看资料，
   * 但只有当前行动者的按钮可用。
   */
  useEffect(() => {
    if (
      battle.status !== "playing"
    ) {
      return;
    }

    const actor =
      getCurrentActor(battle);

    if (
      !actor ||
      actor.side !== "player"
    ) {
      return;
    }

    setSelectedPlayerUnitId(
      actor.id,
    );
  }, [
    battle.currentActorId,
    battle.status,
  ]);

  /**
   * 当前行动者是敌人时，
   * 延迟后自动执行敌方行动。
   */
  useEffect(() => {
    const actor =
      getCurrentActor(battle);

    if (
      battle.status !== "playing" ||
      !actor ||
      actor.side !== "enemy"
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBattle((previousBattle) => {
        const latestActor =
          getCurrentActor(previousBattle);

       if (
          previousBattle.status !==
            "playing" ||
          !latestActor ||
          latestActor.side !==
            "enemy"
        ) {
          return previousBattle;
        }

        return performEnemyAction(
          previousBattle,
        );
      });
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
  }, [battle]);

  /**
   * 当前敌方目标死亡后，
   * 自动选择下一名仍然存活的敌人。
   */
  useEffect(() => {
    if (livingSelectedTarget) {
      return;
    }

    const nextTarget = enemies.find(
      (enemy) => enemy.alive,
    );

    if (nextTarget) {
      setSelectedTargetId(nextTarget.id);
    }
  }, [
    livingSelectedTarget,
    enemies,
  ]);

  /**
   * 如果以后因为队伍变化，
   * 当前查看的我方单位不再存在，
   * 自动切回主控或第一名我方单位。
   */
  useEffect(() => {
    const selectedStillExists =
      playerUnits.some(
        (unit) =>
          unit.id ===
          selectedPlayerUnitId,
      );

    if (
      !selectedStillExists &&
      playerUnits.length > 0
    ) {
      setSelectedPlayerUnitId(
        playerUnits[0].id,
      );
    }
  }, [
    playerUnits,
    selectedPlayerUnitId,
  ]);

  function actionDisabled(
    actionId: PlayerActionId,
  ): boolean {
    if (!selectedPlayerUnit) {
      return true;
    }

    return !getActionAvailability(
      battle,
      selectedPlayerUnit.id,
      actionId,
      {
        enemyId: selectedTargetId,
        allyId: selectedAllyTargetId,
      },
    ).allowed;
  }
  function useAction(
    action: PlayerActionId,
  ) {
    if (
      !selectedPlayerUnit ||
      !canSelectedPlayerUnitAct
    ) {
      return;
    }

    setBattle((previousBattle) =>
      performPlayerAction(
        previousBattle,
        selectedPlayerUnit.id,
        action,
        {
          enemyId: selectedTargetId,
          allyId: selectedAllyTargetId,
        },
      ),
    );
  }

  

  function retryBattle() {
    if (!canRetryBattle(battle.battleKind, battle.status)) {
      return;
    }
    setBattle(
      createCurrentBattle(),
    );
    setSelectedAllyTargetId("player");

    setSelectedTargetId(
      props.createBattle
        ? "flow-enemy-0"
        : "enemy-mage",
    );
    setSelectedPlayerUnitId("player");
  }

  return (
    <main className="battle-screen">
      {/* <div
        className="battle-atmosphere void-mirror-layer"
        aria-hidden="true"
      /> */}

      <div
        className="battle-atmosphere rain-layer"
        aria-hidden="true"
      />

      <header className="battle-header">
        <div>
          <p className="eyebrow">
            {props.eyebrow ??
              "TUTORIAL BATTLE"}
          </p>

          <h1>
            {props.title ??
              "破败教堂"}
          </h1>
        </div>

        <div className="battle-objective">
          <strong>战斗目标</strong>

          <span>
            {props.objective ??
              (
                battle.teleporting
                  ? "魔将正在准备传送"
                  : "阻止魔将带走最后的部件"
              )}
          </span>
        </div>
      </header>

      <section className="combat-stage">
        {/* 敌方阵列 */}
        <section className="formation-panel enemy-side-panel panel">
          <span className="formation-count floating-count">
            {
              enemies.filter(
                (enemy) => enemy.alive,
              ).length
            }
            /{enemies.length}
          </span>

          <EnemyFormation
            enemies={enemies}
            currentActorId={
              battle.currentActorId
            }
            selectedTargetId={
              selectedTargetId
            }
            onSelect={
              setSelectedTargetId
            }
          />
        </section>

        {/* 当前选中的敌人资料 */}
        <section className="selected-enemy-panel panel">
          {selectedEnemy ? (
            <>
              <UnitNameRow
                unit={selectedEnemy}
                prominent
                showStatuses
              />

              <SimpleStats
                unit={selectedEnemy}
              />

              <div className="enemy-action-list">
                {selectedEnemyActions.map(
                  (action) => (
                    <div
                      className="enemy-action-entry"
                      key={action.id}
                    >
                      <strong>
                        {action.name}
                      </strong>

                      <p>
                        {action.description}
                      </p>
                    </div>
                  ),
                )}
              </div>

              <p className="fairy-comment">
                在这里填写妖精对这个敌人的主观评价。
              </p>
            </>
          ) : (
            <div className="empty-enemy-information">
              请选择一名敌人。
            </div>
          )}
        </section>

        {/* 我方阵列 */}
        <section className="formation-panel player-side-panel panel">
          <span className="formation-count floating-count">
            {
              playerUnits.filter(
                (unit) => unit.alive,
              ).length
            }
            /{playerUnits.length}
          </span>

          <PlayerFormation
            units={playerUnits}
            currentActorId={
              battle.currentActorId
            }
            selectedUnitId={
              selectedPlayerUnitId
            }
            onSelect={
              setSelectedPlayerUnitId
            }
          />
        </section>
      </section>

      <section className="battle-bottom-layout">
        {/* 我方单位资料与行动 */}
        <section className="command-panel panel">
          {battle.status === "playing" &&
            selectedPlayerUnit && (
              <>
                <div className="command-unit-summary">
                  <UnitNameRow
                    unit={selectedPlayerUnit}
                    prominent
                    showStatuses
                  />

                  <SimpleStats
                    unit={selectedPlayerUnit}
                  />
                </div>

                {displayedActions.some((action) =>
                  action.targets.some(
                    (target) =>
                      target.type === "chosen-ally" ||
                      target.type === "chosen-other-ally",
                  ),
                ) && (
                  <label>
                    盟友效果目标：
                    <select
                      value={selectedAllyTargetId}
                      onChange={(event) =>
                        setSelectedAllyTargetId(event.target.value)
                      }
                    >
                      {playerUnits.map((unit) => (
                        <option
                          key={unit.id}
                          value={unit.id}
                          disabled={!unit.alive}
                        >
                          {unit.name}
                          {unit.id === selectedPlayerUnit.id
                            ? "（行动者；其他盟友效果按位置回退）"
                            : ""}
                          {!unit.alive ? "（无法战斗）" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="action-grid">
                  {displayedActions.map((action) => (
                    <button
                      type="button"
                      key={action.id}
                      className="action-button"
                      disabled={actionDisabled(
                        action.id,
                      )}
                      onClick={() =>
                        useAction(action.id)
                      }
                    >
                      <strong>
                        {action.name}
                      </strong>

                      <span>
                        {action.description}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

          {battle.status === "won" && (
            <div className="battle-result">
              <h2>战斗结束</h2>

              <p>
                {props.completeText ??
                  "魔将完成了传送。教程战进入剧情结算。"}
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={props.onComplete}
              >
                继续剧情
              </button>
            </div>
          )}

          {battle.status === "lost" && (
            <div className="battle-result danger-result">
              <h2>战斗失败</h2>

              {canRetryBattle(battle.battleKind, battle.status) ? (
                <>
                  <p>
                    主控角色失去了战斗能力。可以重新开始教程战。
                  </p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={retryBattle}
                  >
                    重新战斗
                  </button>
                </>
              ) : (
                <>
                  <p>
                    主控角色失去了战斗能力。本局已经结束，不能重试本场战斗。
                  </p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={props.onDefeat}
                    disabled={!props.onDefeat}
                  >
                    结束本局
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* 战斗日志 */}
        <section className="panel log-panel">
          <div className="battle-log">
            {battle.logs.map(
              (log, index) => (
                <p key={`${index}-${log}`}>
                  {log}
                </p>
              ),
            )}

            <div ref={logEndRef} />
          </div>
        </section>
      </section>
    </main>
  );
}

export default BattleScreen;