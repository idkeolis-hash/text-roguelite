import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  CHURCH_PAGES,
  OPENING_PAGES,
  PROTAGONISTS,
  SKIP_TUTORIAL_PAGES,
  TUTORIAL_END_PAGES,
  WAKE_UP_PAGES,
  type CharacterStats,
  type ProtagonistDefinition,
  type StoryPage,
} from "./content";


import {
  createPlaceholderBattle,
  createTutorialBattle,
  getCurrentActor,
  getUnitActionInfo,
  performEnemyAction,
  performPlayerAction,
  type BattleState,
  type BattleUnit,
  type PlaceholderBattleType,
  type PlayerActionId,
} from "./game";

import {
  applyInventoryBonuses,
  createStartingInventory,
  type PlayerInventory,
} from "./inventory";

import {
  getCompendiumEntries,
  getCompendiumEntryById,
  getItemById,
  getWeaponById,
  type CompendiumEntry,
  type CompendiumKind,
} from "./compendium";

import {
  CORE_STATS,
  FLOW_NODES,
  createReward,
  createShopSlots,
  getRandomCoreStat,
  getRandomDistinctStats,
  rollCommonNodes,
  rollFlowEvent,
  rollRelicOrItem,
  rollWheelOutcome,
  type CoreStatKey,
  type FlowEventDefinition,
  type FlowNodeId,
  type FlowReward,
  type FlowShopSlot,
} from "./flow";

import {
  getEffectiveBattleStat,
  type BattleStatusEffect,
} from "./statuses";

type GamePhase =
  | "opening"
  | "character-select"
  | "wake-up"
  | "tutorial-choice"
  | "church"
  | "battle"
  | "tutorial-end"
  | "skip-end"
  | "flow"
  | "complete";

function StoryContent(props: {
  content: StoryPage;
}) {
  if (typeof props.content === "string") {
    return (
      <div className="story-text">
        {props.content}
      </div>
    );
  }

  return (
    <div className="story-text dialogue-container">
      {props.content.map((line, index) => (
        <div
          className={`dialogue-line speaker-${line.speaker}`}
          key={`${line.speaker}-${index}`}
        >
          {line.name && (
            <strong className="speaker-name">
              {line.name}
            </strong>
          )}

          <div className="dialogue-content">
            {line.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function StoryScreen(props: {
  title: string;
  text: StoryPage;
  currentPage: number;
  pageCount: number;
  nextLabel?: string;
  onNext: () => void;
}) {
  return (
    <main className="screen story-screen">
      <section className="panel story-panel">
        <header className="story-header">
          <h1>{props.title}</h1>

          <span className="page-indicator">
            {props.currentPage + 1} / {props.pageCount}
          </span>
        </header>

        <StoryContent content={props.text} />

        <div className="button-row right">
          <button
            className="primary-button"
            onClick={props.onNext}
          >
            {props.nextLabel ?? "继续"}
          </button>
        </div>
      </section>
    </main>
  );
}

function CharacterSelectScreen(props: {
  selectedId: string;
  onSelect: (id: string) => void;
  onConfirm: () => void;
}) {
  const [showStats, setShowStats] = useState(false);

  return (
    <main className="screen">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PLAYER CHARACTER</p>
            <h1>选择主控角色</h1>
          </div>

          <button
            className="secondary-button"
            onClick={() => setShowStats((value) => !value)}
          >
            {showStats ? "查看人物介绍" : "查看战斗数值"}
          </button>
        </div>

        <p className="muted-text">
          在这里填写选择主控前的提示。
        </p>

        <div className="character-grid">
          {PROTAGONISTS.map((character) => {
            const selected = character.id === props.selectedId;

            return (
              <button
                type="button"
                key={character.id}
                className={`character-card ${selected ? "selected" : ""
                  }`}
                onClick={() => props.onSelect(character.id)}
              >
                <h2>{character.name}</h2>

                {showStats ? (
                  <CharacterStatsView
                    stats={character.stats}
                    description={character.combatDescription}
                  />
                ) : (
                  <p className="character-description">
                    {character.realityDescription}
                  </p>
                )}

                <span className="select-mark">
                  {selected ? "已选择" : "选择"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="button-row right">
          <button
            className="primary-button"
            onClick={props.onConfirm}
          >
            确认主控
          </button>
        </div>
      </section>
    </main>
  );
}

function CharacterStatsView(props: {
  stats: CharacterStats;
  description: string;
}) {
  const stats = [
    ["生命", props.stats.maxHp],
    ["攻击", props.stats.attack],
    ["防御", props.stats.defense],
    ["速度", props.stats.speed],
    ["行动力", props.stats.actionPower],
    ["力量", props.stats.strength],
    ["敏捷", props.stats.agility],
    ["体质", props.stats.constitution],
    ["智力", props.stats.intelligence],
    ["感知", props.stats.perception],
    ["魅力", props.stats.charisma],
  ];

  return (
    <>
      <p className="character-description">
        {props.description}
      </p>

      <div className="stat-grid">
        {stats.map(([name, value]) => (
          <div className="stat-item" key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

function TutorialChoiceScreen(props: {
  onReview: () => void;
  onSkip: () => void;
}) {
  return (
    <main className="screen story-screen">
      <section className="panel choice-panel">
        <p className="eyebrow">TUTORIAL</p>
        <h1>检测到新手教程</h1>

        <div className="story-text">

          {"\n"}
          在这里填写主控发现教程重新开始时的反应。
        </div>

        <div className="choice-list">
          <button
            className="choice-button"
            onClick={props.onReview}
          >
            <strong>就当复习一下吧</strong>
            <span>进入教堂并进行教程战斗。</span>
          </button>

          <button
            className="choice-button"
            onClick={props.onSkip}
          >
            <strong>跳过</strong>
            <span>直接查看教程结果摘要。</span>
          </button>
        </div>
      </section>
    </main>
  );
}

interface ActionDefinition {
  id: PlayerActionId;
  name: string;
  description: string;

  targetRequired?: boolean;
  requiresFullCharge?: boolean;
}

const ACTIONS: ActionDefinition[] = [
  {
    id: "basic",
    name: "普攻",
    description: "对选中敌人造成物理伤害，蓄能+1。",
  },
  {
    id: "skill",
    name: "技能",
    description: "造成倍率较高的物理伤害。",
  },
  {
    id: "charge",
    name: "蓄能",
    description: "蓄能+2，不需要选择目标。",
  },
  {
    id: "charged-skill",
    name: "蓄能技能",
    description: "满蓄时可用，造成物理伤害，蓄能-1。",
  },
  {
    id: "burst",
    name: "蓄能爆发",
    description: "满蓄时可用，对所有敌人造成能量伤害。",
  },
  {
    id: "item",
    name: "道具",
    description: "恢复生命，每场战斗只能使用1次。",
  },
  {
    id: "special",
    name: "特殊：防御",
    description: "降低下一次受到的伤害。",
  },
];

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
          const durationText =
            status.duration < 0
              ? "永久"
              : `${status.duration}回合`;

          const stackText =
            status.stacks > 1
              ? `\n层数：${status.stacks}`
              : "";

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

          return (
            <span
              key={status.id}
              className={[
                "status-badge",
                `status-tag-${status.tag}`,
              ].join(" ")}
              title={
                `${status.name}\n${status.description}\n持续时间：${durationText}${stackText}${cooldownText}`
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

  const logEndRef =
    useRef<HTMLDivElement | null>(null);

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

    const equippedItem =
    getItemById(
      battle.equippedItemId,
    );
    const equippedWeapon =
    getWeaponById(
      battle.equippedWeaponId,
    );

  const displayedActions:
  ActionDefinition[] =
    selectedPlayerUnit &&
    selectedPlayerUnit.role !==
      "player"
      ? getUnitActionInfo(
          selectedPlayerUnit,
        )
      : ACTIONS.map((action) => {
          if (action.id === "item") {
            return {
              ...action,

              name:
                equippedItem
                  ?.actionName ??
                "未装备道具",

              description:
                equippedItem
                  ?.actionDescription ??
                "当前没有可以使用的道具。",
            };
          }

          const weaponOverride =
            equippedWeapon
              ?.actionOverrides?.[
                action.id
              ];

          if (weaponOverride) {
            return {
              ...action,
              ...weaponOverride,
            };
          }

          return action;
        });

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
            action.id !== "charge",
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

  const fullCharge = Boolean(
    selectedPlayerUnit &&
      selectedPlayerUnit.charge >=
        selectedPlayerUnit.maxCharge,
  );

  /**
   * 在背包中更换道具时，
   * 同步修改当前战斗使用的道具。
   *
   * 更换道具不会恢复已经消耗的使用次数。
   */
  useEffect(() => {
    setBattle((previousBattle) => {
      if (
        previousBattle
          .equippedItemId ===
        props.inventory
          .equippedItemId
      ) {
        return previousBattle;
      }

      const nextItem =
        getItemById(
          props.inventory
            .equippedItemId,
        );

      return {
        ...previousBattle,

        equippedItemId:
          props.inventory
            .equippedItemId,

        itemUsesLeft: Math.min(
          previousBattle.itemUsesLeft,
          nextItem
            ?.maxUsesPerBattle ??
            0,
        ),

        actionSerial:
          previousBattle.actionSerial +
          1,
      };
    });
  }, [
    props.inventory.equippedItemId,
  ]);

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
    action: PlayerActionId,
  ) {
    if (
      !canSelectedPlayerUnitAct ||
      !selectedPlayerUnit
    ) {
      return true;
    }

    const isMainProtagonist =
      selectedPlayerUnit.role ===
      "player";

      /*
 * 数据驱动同伴使用行动定义本身的条件。
 */
if (!isMainProtagonist) {
  const actionDefinition =
    displayedActions.find(
      (definition) =>
        definition.id === action,
    );

  if (!actionDefinition) {
    return true;
  }

  if (
    actionDefinition
      .requiresFullCharge &&
    !fullCharge
  ) {
    return true;
  }

  if (
    actionDefinition
      .targetRequired &&
    !livingSelectedTarget
  ) {
    return true;
  }

  return false;
}

    switch (action) {
      case "charged-skill":
        return (
          !fullCharge ||
          (
            isMainProtagonist &&
            !livingSelectedTarget
          )
        );

      case "burst":
        return !fullCharge;

      case "item":
        return (
          !isMainProtagonist ||
          !equippedItem ||
          battle.itemUsesLeft <= 0
        );

      case "basic":
      case "skill":
        /*
         * 当前只有主控的普攻和技能需要目标。
         * 猫的“喵”系列不需要目标。
         */
        return (
          isMainProtagonist &&
          !livingSelectedTarget
        );

      case "special":
        return !isMainProtagonist;

      case "charge":
        return false;

      default:
        return true;
    }
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
        selectedTargetId,
      ),
    );
  }

  function retryBattle() {
    setBattle(
      createCurrentBattle(),
    );

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
type FlowView =
  | {
      type: "fool";
    }
  | {
      type: "route";
      options: FlowNodeId[];
    }
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
      battleType:
        PlaceholderBattleType;
    }
  | {
      type: "reward";
      rewards: FlowReward[];
      title: string;
    };

function FlowScreen(props: {
  protagonist: ProtagonistDefinition;
  inventory: PlayerInventory;

  setInventory: Dispatch<
    SetStateAction<PlayerInventory>
  >;

  onComplete: () => void;
}) {
  const [areaNumber, setAreaNumber] =
    useState(1);

  const [stageIndex, setStageIndex] =
    useState(0);

  const [view, setView] =
    useState<FlowView>({
      type: "fool",
    });

  const effectiveProtagonist =
    useMemo(
      () =>
        applyInventoryBonuses(
          props.protagonist,
          props.inventory,
        ),
      [
        props.protagonist,
        props.inventory,
      ],
    );

  function addGold(amount: number) {
    props.setInventory(
      (current) => ({
        ...current,

        gold: Math.max(
          0,
          current.gold + amount,
        ),
      }),
    );
  }

  function addStat(
    stat: CoreStatKey,
    amount: number,
  ) {
    props.setInventory(
      (current) => ({
        ...current,

        statBonuses: {
          ...current.statBonuses,

          [stat]: Math.max(
            -99,
            current.statBonuses[
              stat
            ] + amount,
          ),
        },
      }),
    );
  }

  function addSeveralStats(
    stats: CoreStatKey[],
    amount: number,
  ) {
    props.setInventory(
      (current) => {
        const nextBonuses = {
          ...current.statBonuses,
        };

        for (const stat of stats) {
          nextBonuses[stat] =
            Math.max(
              -99,
              nextBonuses[stat] +
                amount,
            );
        }

        return {
          ...current,
          statBonuses: nextBonuses,
        };
      },
    );
  }

  function grantReward(
    reward: FlowReward,
  ) {
    props.setInventory(
      (current) => {
        if (
          reward.kind === "relic"
        ) {
          return {
            ...current,

            ownedRelicIds:
              current.ownedRelicIds
                .includes(reward.id)
                ? current
                    .ownedRelicIds
                : [
                    ...current
                      .ownedRelicIds,
                    reward.id,
                  ],
          };
        }

        if (
          reward.kind === "item"
        ) {
          return {
            ...current,

            ownedItemIds:
              current.ownedItemIds
                .includes(reward.id)
                ? current
                    .ownedItemIds
                : [
                    ...current
                      .ownedItemIds,
                    reward.id,
                  ],
          };
        }

        if (
          reward.kind === "weapon"
        ) {
          return {
            ...current,

            ownedWeaponIds:
              current.ownedWeaponIds
                .includes(reward.id)
                ? current
                    .ownedWeaponIds
                : [
                    ...current
                      .ownedWeaponIds,
                    reward.id,
                  ],
          };
        }

        return {
          ...current,

          ownedCompanionIds:
            current
              .ownedCompanionIds
              .includes(reward.id)
              ? current
                  .ownedCompanionIds
              : [
                  ...current
                    .ownedCompanionIds,
                  reward.id,
                ],
        };
      },
    );
  }

  function openNode(
    nodeId: FlowNodeId,
  ) {
    if (nodeId === "strength") {
      setView({
        type: "battle",
        battleType: "strength",
      });

      return;
    }

    if (nodeId === "chariot") {
      setView({
        type: "battle",
        battleType: "chariot",
      });

      return;
    }

    if (nodeId === "moon") {
      setView({
        type: "battle",
        battleType: "moon",
      });

      return;
    }

    if (nodeId === "death") {
      setView({
        type: "event",
        event: rollFlowEvent(),
      });

      return;
    }

    if (
      nodeId === "hanged-man"
    ) {
      setView({
        type: "shop",
        slots: createShopSlots(),
      });

      return;
    }

    if (nodeId === "star") {
      setView({
        type: "rest",
        picksLeft: 2,
      });

      return;
    }

    if (
      nodeId === "magician"
    ) {
      setView({
        type: "magician",

        rewards: [
          rollRelicOrItem(),
          rollRelicOrItem(),
        ],
      });

      return;
    }

    setView({
      type: "wheel",
      spins: 0,
    });
  }

  function goToStage(
    nextStage: number,
  ) {
    setStageIndex(nextStage);

    if (
      nextStage === 0 ||
      nextStage === 5
    ) {
      setView({
        type: "route",
        options:
          rollCommonNodes(3),
      });

      return;
    }

    if (nextStage === 1) {
      openNode("strength");
      return;
    }

    if (nextStage === 2) {
      openNode("death");
      return;
    }

    if (nextStage === 3) {
      const [randomNode] =
        rollCommonNodes(1);

      openNode(randomNode);
      return;
    }

    if (nextStage === 4) {
      openNode("chariot");
      return;
    }

    openNode("moon");
  }

  function finishCurrentNode() {
    if (stageIndex < 6) {
      goToStage(
        stageIndex + 1,
      );

      return;
    }

    if (areaNumber >= 5) {
      props.onComplete();
      return;
    }

    setAreaNumber(
      (current) => current + 1,
    );

    setStageIndex(0);

    setView({
      type: "fool",
    });
  }

  function applyEventChoice(
    choiceIndex: number,
  ) {
    if (
      view.type !== "event" ||
      view.resultText
    ) {
      return;
    }

    const choice =
      view.event.choices[
        choiceIndex
      ];

    const resultParts: string[] =
      [choice.resultText];

    for (
      const effect of
        choice.effects
    ) {
      if (effect.type === "gold") {
        addGold(effect.amount);

        resultParts.push(
          effect.amount >= 0
            ? `金币+${effect.amount}。`
            : `金币${effect.amount}。`,
        );
      }

      if (
        effect.type ===
        "random-stat"
      ) {
        const stat =
          getRandomCoreStat();

        addStat(
          stat,
          effect.amount,
        );

        const statName =
          CORE_STATS.find(
            (item) =>
              item.id === stat,
          )?.name ?? stat;

        resultParts.push(
          `${statName}${
            effect.amount >= 0
              ? "+"
              : ""
          }${effect.amount}。`,
        );
      }

      if (
        effect.type === "reward"
      ) {
        grantReward(
          effect.reward,
        );

        resultParts.push(
          `获得${effect.reward.name}。`,
        );
      }
    }

    setView({
      ...view,
      resultText:
        resultParts.join("\n"),
    });
  }

  function buyShopSlot(
    slotId: string,
  ) {
    if (view.type !== "shop") {
      return;
    }

    const slot =
      view.slots.find(
        (candidate) =>
          candidate.id === slotId,
      );

    if (!slot || slot.sold) {
      return;
    }

    if (
      props.inventory.gold <
      slot.price
    ) {
      setView({
        ...view,
        message:
          "金币不足，无法购买。",
      });

      return;
    }

    addGold(-slot.price);
    grantReward(slot.reward);

    setView({
      ...view,

      slots: view.slots.map(
        (candidate) =>
          candidate.id === slotId
            ? {
                ...candidate,
                sold: true,
              }
            : candidate,
      ),

      message:
        `购买了${slot.reward.name}。`,
    });
  }

  function chooseRestStat(
    stat: CoreStatKey,
  ) {
    if (
      view.type !== "rest" ||
      view.picksLeft <= 0
    ) {
      return;
    }

    addStat(stat, 1);

    const statName =
      CORE_STATS.find(
        (item) =>
          item.id === stat,
      )?.name ?? stat;

    setView({
      ...view,

      picksLeft:
        view.picksLeft - 1,

      message:
        `${statName}+1。`,
    });
  }

  function chooseRandomRest() {
    if (
      view.type !== "rest" ||
      view.picksLeft <= 0
    ) {
      return;
    }

    const stats =
      getRandomDistinctStats(3);

    addSeveralStats(stats, 1);

    const names = stats.map(
      (stat) =>
        CORE_STATS.find(
          (item) =>
            item.id === stat,
        )?.name ?? stat,
    );

    setView({
      ...view,

      picksLeft: 0,

      message:
        `${names.join("、")}各+1。`,
    });
  }

  function spinWheel() {
    if (view.type !== "wheel") {
      return;
    }

    const price =
      view.spins === 0
        ? 0
        : view.spins * 20;

    if (
      props.inventory.gold <
      price
    ) {
      setView({
        ...view,
        message:
          "金币不足，命运之轮没有转动。",
      });

      return;
    }

    if (price > 0) {
      addGold(-price);
    }

    const outcome =
      rollWheelOutcome();

    let message = "";

    if (outcome.type === "gold") {
      addGold(outcome.amount);

      message =
        outcome.amount >= 0
          ? `命运之轮吐出了金币。金币+${outcome.amount}。`
          : `命运之轮吞走了金币。金币${outcome.amount}。`;
    }

    if (outcome.type === "stat") {
      const stat =
        getRandomCoreStat();

      addStat(
        stat,
        outcome.amount,
      );

      const statName =
        CORE_STATS.find(
          (item) =>
            item.id === stat,
        )?.name ?? stat;

      message =
        `${statName}${
          outcome.amount >= 0
            ? "+"
            : ""
        }${outcome.amount}。`;
    }

    if (
      outcome.type === "reward"
    ) {
      grantReward(
        outcome.reward,
      );

      message =
        outcome.reward.cursed
          ? `命运之轮交给了你${outcome.reward.name}。它似乎不太对劲。`
          : `获得${outcome.reward.name}。`;
    }

    setView({
      ...view,

      spins:
        view.spins + 1,

      message,
    });
  }

  function finishBattle(
    battleType:
      PlaceholderBattleType,
  ) {
    if (
      battleType === "strength"
    ) {
      setView({
        type: "reward",
        title: "力量的奖励",
        rewards: [
          rollRelicOrItem(),
        ],
      });

      return;
    }

    if (
      battleType === "chariot"
    ) {
      setView({
        type: "reward",
        title: "战车的奖励",
        rewards: [
          createReward("weapon"),
        ],
      });

      return;
    }

    setView({
      type: "reward",
      title: "月亮的奖励",

      rewards: [
        rollRelicOrItem(),
        rollRelicOrItem(),
        rollRelicOrItem(),
      ],
    });
  }

  function chooseReward(
    reward: FlowReward,
  ) {
    grantReward(reward);
    finishCurrentNode();
  }

  const areaProgress =
    Math.min(
      7,
      stageIndex + 1,
    );

  if (view.type === "battle") {
    const battleNames = {
      strength: "力量",
      chariot: "战车",
      moon: "月亮",
    };

    return (
      <BattleScreen
        protagonist={
          effectiveProtagonist
        }
        inventory={
          props.inventory
        }
        eyebrow={`AREA ${areaNumber}`}
        title={
          battleNames[
            view.battleType
          ]
        }
        objective={
          view.battleType ===
          "strength"
            ? "击败盾矛兵"
            : view.battleType ===
                "chariot"
              ? "击败强化敌人"
              : "击败区域首领"
        }
        completeText="战斗胜利。可以领取节点奖励。"
        createBattle={() =>
          createPlaceholderBattle(
            effectiveProtagonist,
            props.inventory,
            areaNumber,
            view.battleType,
          )
        }
        onComplete={() =>
          finishBattle(
            view.battleType,
          )
        }
      />
    );
  }

  return (
    <main className="screen flow-screen">
      <section className="panel flow-panel">
        <header className="flow-header">
          <div>
            <p className="eyebrow">
              AREA {areaNumber} / 5
            </p>

            <h1>
              第{areaNumber}区域
            </h1>
          </div>

          <div className="flow-resource-summary">
            <span>
              节点 {areaProgress}/7
            </span>

            <strong>
              金币 {props.inventory.gold}
            </strong>
          </div>
        </header>

        {view.type === "fool" && (
          <section className="flow-content">
            <p className="flow-arcana">
              0 · 愚者
            </p>

            <h2>
              尚未踏出的道路
            </h2>

            <div className="story-text flow-story-text">
              {`勇者进入了第${areaNumber}区域。

道路在面前分裂又重合。妖精轻快地飞向前方，仿佛早已知道哪里才是正确的方向。

“出发吧。要找的东西，一定就在更深处。”`}
            </div>

            <div className="button-row right">
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  goToStage(0)
                }
              >
                进入区域
              </button>
            </div>
          </section>
        )}

        {view.type === "route" && (
          <section className="flow-content">
            <p className="flow-arcana">
              选择道路
            </p>

            <h2>
              前方出现了三条道路
            </h2>

            <div className="flow-choice-grid">
              {view.options.map(
                (nodeId) => {
                  const node =
                    FLOW_NODES[nodeId];

                  return (
                    <button
                      type="button"
                      className="flow-node-card"
                      key={nodeId}
                      onClick={() =>
                        openNode(
                          nodeId,
                        )
                      }
                    >
                      <span>
                        {node.subtitle}
                      </span>

                      <strong>
                        {node.name}
                      </strong>

                      <p>
                        {node.description}
                      </p>
                    </button>
                  );
                },
              )}
            </div>
          </section>
        )}

        {view.type === "event" && (
          <section className="flow-content">
            <p className="flow-arcana">
              XIII · 死神
            </p>

            <h2>
              {view.event.title}
            </h2>

            <div className="flow-text-window">
              {view.resultText ??
                view.event.text}
            </div>

            {!view.resultText ? (
              <div className="flow-option-list">
                {view.event.choices.map(
                  (
                    choice,
                    index,
                  ) => (
                    <button
                      type="button"
                      className="choice-button"
                      key={choice.text}
                      onClick={() =>
                        applyEventChoice(
                          index,
                        )
                      }
                    >
                      <strong>
                        {choice.text}
                      </strong>
                    </button>
                  ),
                )}
              </div>
            ) : (
              <div className="button-row right">
                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    finishCurrentNode
                  }
                >
                  继续前进
                </button>
              </div>
            )}
          </section>
        )}

        {view.type === "shop" && (
          <section className="flow-content">
            <p className="flow-arcana">
              XII · 吊人
            </p>

            <h2>商店</h2>

            <div className="flow-shop-grid">
              {view.slots.map(
                (slot) => (
                  <article
                    className="flow-shop-slot"
                    key={slot.id}
                  >
                    <span>
                      {slot.reward.kind}
                    </span>

                    <h3>
                      {slot.reward.name}
                    </h3>

                    <strong>
                      {slot.price}金币
                    </strong>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        slot.sold
                      }
                      onClick={() =>
                        buyShopSlot(
                          slot.id,
                        )
                      }
                    >
                      {slot.sold
                        ? "已售出"
                        : "购买"}
                    </button>
                  </article>
                ),
              )}
            </div>

            {view.message && (
              <p className="flow-result-message">
                {view.message}
              </p>
            )}

            <div className="button-row right">
              <button
                type="button"
                className="primary-button"
                onClick={
                  finishCurrentNode
                }
              >
                离开商店
              </button>
            </div>
          </section>
        )}

        {view.type === "rest" && (
          <section className="flow-content">
            <p className="flow-arcana">
              XVII · 星星
            </p>

            <h2>在星光下休息</h2>

            <p className="muted-text">
              剩余属性选择次数：
              {view.picksLeft}
            </p>

            <div className="flow-stat-grid">
              {CORE_STATS.map(
                (stat) => (
                  <button
                    type="button"
                    className="flow-stat-button"
                    key={stat.id}
                    disabled={
                      view.picksLeft <= 0
                    }
                    onClick={() =>
                      chooseRestStat(
                        stat.id,
                      )
                    }
                  >
                    {stat.name}+1
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              className="choice-button flow-random-stat-button"
              disabled={
                view.picksLeft <= 0
              }
              onClick={
                chooseRandomRest
              }
            >
              <strong>
                接受随机星光
              </strong>

              <span>
                三个互不重复的随机属性+1，并结束休息。
              </span>
            </button>

            {view.message && (
              <p className="flow-result-message">
                {view.message}
              </p>
            )}

            {view.picksLeft <= 0 && (
              <div className="button-row right">
                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    finishCurrentNode
                  }
                >
                  结束休息
                </button>
              </div>
            )}
          </section>
        )}

        {view.type === "magician" && (
          <section className="flow-content">
            <p className="flow-arcana">
              I · 魔术师
            </p>

            <h2>选择一个基座</h2>

            <div className="flow-choice-grid two-columns">
              {view.rewards.map(
                (
                  reward,
                  index,
                ) => (
                  <button
                    type="button"
                    className="flow-reward-card"
                    key={`${reward.id}-${index}`}
                    onClick={() =>
                      chooseReward(
                        reward,
                      )
                    }
                  >
                    <span>
                      基座{index + 1}
                    </span>

                    <strong>
                      {reward.name}
                    </strong>

                    <p>
                      类型：
                      {reward.kind}
                    </p>
                  </button>
                ),
              )}
            </div>
          </section>
        )}

        {view.type === "wheel" && (
          <section className="flow-content">
            <p className="flow-arcana">
              X · 命运之轮
            </p>

            <h2>转动轮盘</h2>

            <div className="flow-wheel">
              <div className="wheel-symbol">
                X
              </div>

              <p>
                已转动{view.spins}次
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={spinWheel}
              >
                {view.spins === 0
                  ? "免费转动"
                  : `花费${view.spins * 20}金币`}
              </button>
            </div>

            {view.message && (
              <p className="flow-result-message">
                {view.message}
              </p>
            )}

            <div className="button-row right">
              <button
                type="button"
                className="secondary-button"
                onClick={
                  finishCurrentNode
                }
              >
                离开命运之轮
              </button>
            </div>
          </section>
        )}

        {view.type === "reward" && (
          <section className="flow-content">
            <p className="flow-arcana">
              战利品
            </p>

            <h2>{view.title}</h2>

            <div
              className={[
                "flow-choice-grid",
                view.rewards.length === 1
                  ? "one-column"
                  : "",
              ].join(" ")}
            >
              {view.rewards.map(
                (
                  reward,
                  index,
                ) => (
                  <button
                    type="button"
                    className="flow-reward-card"
                    key={`${reward.id}-${index}`}
                    onClick={() =>
                      chooseReward(
                        reward,
                      )
                    }
                  >
                    <span>
                      {reward.kind}
                    </span>

                    <strong>
                      {reward.name}
                    </strong>

                    <p>
                      选择后加入背包。
                    </p>
                  </button>
                ),
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
type DockKind =
  | CompendiumKind
  | "backpack";

const DOCK_TITLES: Record<
  DockKind,
  string
> = {
  weapon: "武器图鉴",
  relic: "遗物图鉴",
  item: "道具图鉴",
  companion: "同伴图鉴",
  backpack: "背包",
};

const DOCK_BUTTON_LABELS: Record<
  DockKind,
  string
> = {
  weapon: "武",
  relic: "遗",
  item: "道",
  companion: "伴",
  backpack: "包",
};

function CompendiumEntryDetail(props: {
  entry: CompendiumEntry | undefined;
  actionLabel?: string;
  onAction?: () => void;
}) {
  if (!props.entry) {
    return (
      <div className="entry-detail-empty">
        请选择一个条目。
      </div>
    );
  }

  if (!props.entry.encountered) {
    return (
      <article className="entry-detail-panel">
        <h2>？？？</h2>

        <p className="compendium-description">
          尚未在游戏中遇到这个条目。
        </p>
      </article>
    );
  }

  return (
    <article className="entry-detail-panel">
      <div className="compendium-entry-heading">
        <h2>{props.entry.name}</h2>

        <span className="encountered-mark">
          已遇到
        </span>
      </div>

      <p className="compendium-description">
        {props.entry.description}
      </p>

      <dl className="compendium-details">
        {props.entry.details.map(
          (detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ),
        )}
      </dl>

      <p className="compendium-fairy-comment">
        {props.entry.fairyComment}
      </p>

      {props.actionLabel &&
        props.onAction && (
          <button
            type="button"
            className="primary-button entry-action-button"
            onClick={props.onAction}
          >
            {props.actionLabel}
          </button>
        )}
    </article>
  );
}

function CompendiumBrowser(props: {
  kind: CompendiumKind;
}) {
  const entries =
    getCompendiumEntries(props.kind);

  const [query, setQuery] =
    useState("");

  const [
    searchDescription,
    setSearchDescription,
  ] = useState(false);

  const [selectedId, setSelectedId] =
    useState(entries[0]?.id ?? "");

  const normalizedQuery =
    query.trim().toLowerCase();

    const filteredEntries =
    entries.filter((entry) => {
      if (!normalizedQuery) {
        return true;
      }

      /*
       * 描述搜索开启时：
       * 只搜索description，不再搜索名称。
       */
      if (searchDescription) {
        if (!entry.encountered) {
          return false;
        }

        return entry.description
          .toLowerCase()
          .includes(
            normalizedQuery,
          );
      }

      /*
       * 描述搜索关闭时：
       * 只搜索名称。
       */
      if (!entry.encountered) {
        return "？？？".includes(
          normalizedQuery,
        );
      }

      return entry.name
        .toLowerCase()
        .includes(
          normalizedQuery,
        );
    });

  const selectedEntry =
    filteredEntries.find(
      (entry) =>
        entry.id === selectedId,
    ) ??
    filteredEntries[0];

  return (
    <div className="library-browser">
      <aside className="library-list-panel">
        <div className="compendium-search-row">
          <input
            className="compendium-search"
            value={query}
            placeholder={
              searchDescription
                ? "只搜索描述……"
                : "只搜索名称……"
            }
            onChange={(event) =>
              setQuery(
                event.target.value,
              )
            }
          />

          <button
            type="button"
            className={[
              "description-search-toggle",
              searchDescription
                ? "active"
                : "",
            ].join(" ")}
            aria-pressed={
              searchDescription
            }
            title={
              searchDescription
                ? "当前只搜索描述"
                : "当前只搜索名称"
            }
            onClick={() =>
              setSearchDescription(
                (current) =>
                  !current,
              )
            }
          >
            描述
          </button>
        </div>

        <p className="compendium-progress">
          已遇到{" "}
          {
            entries.filter(
              (entry) =>
                entry.encountered,
            ).length
          }
          /{entries.length}
        </p>

        <div className="library-entry-list">
          {filteredEntries.map(
            (entry) => (
              <button
                type="button"
                key={entry.id}
                className={[
                  "library-entry-button",
                  entry.id ===
                  selectedEntry?.id
                    ? "selected"
                    : "",
                  entry.encountered
                    ? ""
                    : "unknown",
                ].join(" ")}
                onClick={() =>
                  setSelectedId(entry.id)
                }
              >
                <strong>
                  {entry.encountered
                    ? entry.name
                    : "？？？"}
                </strong>

                <span>
                  {entry.encountered
                    ? "已遇到"
                    : "未遇到"}
                </span>
              </button>
            ),
          )}

          {filteredEntries.length ===
            0 && (
            <p className="empty-list-message">
              没有符合条件的条目。
            </p>
          )}
        </div>
      </aside>

      <div className="library-detail-column">
        <CompendiumEntryDetail
          entry={selectedEntry}
        />
      </div>
    </div>
  );
}

interface BackpackListEntry {
  id: string;
  section: string;
  status?: string;
}

function BackpackBrowser(props: {
  inventory: PlayerInventory;

  onEquipWeapon: (
    weaponId: string,
  ) => void;

  onEquipItem: (
    itemId: string,
  ) => void;

  onSetCompanionSlot: (
    slotIndex: number,
    companionId: string | null,
  ) => void;
}) {
  const otherWeaponIds =
    props.inventory.ownedWeaponIds.filter(
      (id) =>
        id !==
        props.inventory
          .equippedWeaponId,
    );

  const otherItemIds =
    props.inventory.ownedItemIds.filter(
      (id) =>
        id !==
        props.inventory.equippedItemId,
    );

  const listEntries:
    BackpackListEntry[] = [
      {
        id:
          props.inventory
            .equippedWeaponId,
        section: "当前武器",
        status: "已装备",
      },

      {
        id:
          props.inventory
            .equippedItemId,
        section: "当前道具",
        status: "已装备",
      },

      ...otherWeaponIds.map(
        (id) => ({
          id,
          section: "其他武器",
          status: "可更换",
        }),
      ),

      ...props.inventory
        .ownedRelicIds
        .map((id) => ({
          id,
          section: "拥有的遗物",
          status: "生效中",
        })),

      ...otherItemIds.map(
        (id) => ({
          id,
          section: "其他道具",
          status: "可更换",
        }),
      ),

      ...props.inventory
        .ownedCompanionIds
        .map((id) => {
          const slotIndex =
            props.inventory
              .companionSlots
              .indexOf(id);

          return {
            id,
            section: "拥有的同伴",

            status:
              slotIndex >= 0
                ? `位置${slotIndex + 1}`
                : "未上阵",
          };
        }),
    ];

  const [selectedId, setSelectedId] =
    useState(
      listEntries[0]?.id ?? "",
    );

 const selectedEntry =
    getCompendiumEntryById(
      selectedId,
    );

  const selectedCompanionSlot =
    selectedEntry?.kind ===
    "companion"
      ? props.inventory
          .companionSlots
          .indexOf(
            selectedEntry.id,
          )
      : -1;

  let actionLabel:
    | string
    | undefined;

  let onAction:
    | (() => void)
    | undefined;

  if (
    selectedEntry?.kind ===
      "weapon" &&
    selectedEntry.id !==
      props.inventory
        .equippedWeaponId &&
    props.inventory.ownedWeaponIds.includes(
      selectedEntry.id,
    )
  ) {
    actionLabel = "装备此武器";

    onAction = () =>
      props.onEquipWeapon(
        selectedEntry.id,
      );
  }

  if (
    selectedEntry?.kind ===
      "item" &&
    selectedEntry.id !==
      props.inventory
        .equippedItemId &&
    props.inventory.ownedItemIds.includes(
      selectedEntry.id,
    )
  ) {
    actionLabel = "装备此道具";

    onAction = () =>
      props.onEquipItem(
        selectedEntry.id,
      );
  }

  const sectionOrder = [
    "当前武器",
    "当前道具",
    "其他武器",
    "拥有的遗物",
    "其他道具",
    "拥有的同伴"
  ];

  return (
    <div className="library-browser">
      <aside className="library-list-panel backpack-list-panel">
        <section className="companion-slot-summary">
          <h3>同伴位置</h3>

          <div className="companion-slot-grid">
            {props.inventory
              .companionSlots
              .map(
                (
                  companionId,
                  slotIndex,
                ) => {
                  const companion =
                    companionId
                      ? getCompendiumEntryById(
                          companionId,
                        )
                      : undefined;

                  return (
                    <button
                      type="button"
                      key={slotIndex}
                      className={[
                        "companion-slot-button",
                        companionId
                          ? "occupied"
                          : "empty",
                      ].join(" ")}
                      disabled={
                        !companionId
                      }
                      onClick={() => {
                        if (
                          companionId
                        ) {
                          setSelectedId(
                            companionId,
                          );
                        }
                      }}
                    >
                      <span>
                        位置
                        {slotIndex + 1}
                      </span>

                      <strong>
                        {companion
                          ?.name ??
                          "空"}
                      </strong>
                    </button>
                  );
                },
              )}
          </div>
        </section>

        <div className="library-entry-list">
          {sectionOrder.map(
            (section) => {
              const sectionEntries =
                listEntries.filter(
                  (entry) =>
                    entry.section ===
                    section,
                );

              return (
                <section
                  className="backpack-section"
                  key={section}
                >
                  <h3>{section}</h3>

                  {sectionEntries.length >
                  0 ? (
                    sectionEntries.map(
                      (item) => {
                        const entry =
                          getCompendiumEntryById(
                            item.id,
                          );

                        return (
                          <button
                            type="button"
                            key={`${section}-${item.id}`}
                            className={[
                              "library-entry-button",
                              item.id ===
                              selectedId
                                ? "selected"
                                : "",
                            ].join(" ")}
                            onClick={() =>
                              setSelectedId(
                                item.id,
                              )
                            }
                          >
                            <strong>
                              {entry?.name ??
                                "未知条目"}
                            </strong>

                            <span>
                              {item.status}
                            </span>
                          </button>
                        );
                      },
                    )
                  ) : (
                    <p className="empty-backpack-section">
                      暂无
                    </p>
                  )}
                </section>
              );
            },
          )}
        </div>
      </aside>

      <div className="library-detail-column">
        <CompendiumEntryDetail
          entry={selectedEntry}
          actionLabel={actionLabel}
          onAction={onAction}
        />

        {selectedEntry?.kind ===
          "companion" && (
          <section className="companion-position-controls">
            <h3>分配同伴位置</h3>

            <p>
              当前：
              {selectedCompanionSlot >=
              0
                ? `位置${selectedCompanionSlot + 1}`
                : "未上阵"}
            </p>

            <div className="companion-position-button-grid">
              {props.inventory
                .companionSlots
                .map(
                  (
                    occupantId,
                    slotIndex,
                  ) => {
                    const isCurrentSlot =
                      occupantId ===
                      selectedEntry.id;

                    const occupant =
                      occupantId
                        ? getCompendiumEntryById(
                            occupantId,
                          )
                        : undefined;

                    return (
                      <button
                        type="button"
                        key={slotIndex}
                        className={[
                          "secondary-button",
                          "companion-position-button",
                          isCurrentSlot
                            ? "current"
                            : "",
                        ].join(" ")}
                        onClick={() =>
                          props.onSetCompanionSlot(
                            slotIndex,

                            isCurrentSlot
                              ? null
                              : selectedEntry.id,
                          )
                        }
                      >
                        {isCurrentSlot
                          ? `从位置${slotIndex + 1}卸下`
                          : occupant
                            ? `替换位置${slotIndex + 1}的${occupant.name}`
                            : `放入位置${slotIndex + 1}`}
                      </button>
                    );
                  },
                )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CompendiumDock(props: {
  inventory: PlayerInventory;

  onEquipWeapon: (
    weaponId: string,
  ) => void;

  onEquipItem: (
    itemId: string,
  ) => void;

  onSetCompanionSlot: (
    slotIndex: number,
    companionId: string | null,
  ) => void;
}) {
  const [
    openedKind,
    setOpenedKind,
  ] = useState<DockKind | null>(
    null,
  );

  const dockKinds: DockKind[] = [
    "weapon",
    "relic",
    "item",
    "companion",
    "backpack",
  ];

  return (
    <>
      <aside
        className="compendium-dock"
        aria-label="图鉴和背包按钮"
      >
        {dockKinds.map((kind) => (
          <button
            type="button"
            key={kind}
            className={[
              "compendium-dock-button",
              openedKind === kind
                ? "active"
                : "",
            ].join(" ")}
            title={DOCK_TITLES[kind]}
            aria-label={
              DOCK_TITLES[kind]
            }
            onClick={() =>
              setOpenedKind(
                openedKind === kind
                  ? null
                  : kind,
              )
            }
          >
            <strong>
              {
                DOCK_BUTTON_LABELS[
                  kind
                ]
              }
            </strong>

            <span>
              {DOCK_TITLES[kind]}
            </span>
          </button>
        ))}
      </aside>

      {openedKind && (
        <div
          className="compendium-overlay"
          onMouseDown={() =>
            setOpenedKind(null)
          }
        >
          <section
            className="compendium-window panel"
            role="dialog"
            aria-modal="true"
            aria-label={
              DOCK_TITLES[openedKind]
            }
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <header className="compendium-header">
              <div>
                <p className="eyebrow">
                  {openedKind ===
                  "backpack"
                    ? "INVENTORY"
                    : "COMPENDIUM"}
                </p>

                <h1>
                  {
                    DOCK_TITLES[
                      openedKind
                    ]
                  }
                </h1>
              </div>

              <button
                type="button"
                className="compendium-close-button"
                aria-label="关闭"
                onClick={() =>
                  setOpenedKind(null)
                }
              >
                ×
              </button>
            </header>

            <div className="compendium-window-content">
              {openedKind ===
              "backpack" ? (
               <BackpackBrowser
                  inventory={
                    props.inventory
                  }
                  onEquipWeapon={
                    props.onEquipWeapon
                  }
                  onEquipItem={
                    props.onEquipItem
                  }
                  onSetCompanionSlot={
                    props.onSetCompanionSlot
                  }
                />
              ) : (
                <CompendiumBrowser
                  key={openedKind}
                  kind={openedKind}
                />
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function CompleteScreen(props: {
  onRestart: () => void;
}) {
  return (
    <main className="screen story-screen">
      <section className="panel story-panel complete-panel">
        <p className="eyebrow">PROTOTYPE COMPLETE</p>
        <h1>测试版结束</h1>

        <div className="story-text">

          {"\n"}
          当前版本已经完成开场、角色选择、现世部分和新手教程。
        </div>

        <div className="button-row right">
          <button
            className="secondary-button"
            onClick={props.onRestart}
          >
            返回开场
          </button>
        </div>
      </section>
    </main>
  );
}

function GameContent(props: {
  inventory: PlayerInventory;

  setInventory: Dispatch<
    SetStateAction<PlayerInventory>
  >;

  onPrepareInventory: (
    protagonist: ProtagonistDefinition,
  ) => void;
}) {
  const [phase, setPhase] =
    useState<GamePhase>("opening");

  const [pageIndex, setPageIndex] = useState(0);

  const [selectedProtagonistId, setSelectedProtagonistId] =
    useState(PROTAGONISTS[0].id);

  const protagonist = useMemo(
    () =>
      PROTAGONISTS.find(
        (item) => item.id === selectedProtagonistId,
      ) ?? PROTAGONISTS[0],
    [selectedProtagonistId],
  );

  function changePhase(nextPhase: GamePhase) {
    setPhase(nextPhase);
    setPageIndex(0);
  }

  function advancePages(
    pages: StoryPage[],
    nextPhase: GamePhase,
  ) {
    if (pageIndex < pages.length - 1) {
      setPageIndex((current) => current + 1);
      return;
    }

    changePhase(nextPhase);
  }

  function restartGame() {
    setSelectedProtagonistId(
      PROTAGONISTS[0].id,
    );

    props.onPrepareInventory(
      PROTAGONISTS[0],
    );

    changePhase("opening");
  }

  if (phase === "opening") {
    return (
      <StoryScreen
        title="开场"
        text={OPENING_PAGES[pageIndex]}
        currentPage={pageIndex}
        pageCount={OPENING_PAGES.length}
        onNext={() =>
          advancePages(
            OPENING_PAGES,
            "character-select",
          )
        }
      />
    );
  }

  if (phase === "character-select") {
    return (
      <CharacterSelectScreen
        selectedId={selectedProtagonistId}
        onSelect={setSelectedProtagonistId}
        onConfirm={() => {
  props.onPrepareInventory(
    protagonist,
  );

  changePhase("wake-up");
}}
      />
    );
  }

  if (phase === "wake-up") {
    return (
      <StoryScreen
        title={protagonist.name}
        text={WAKE_UP_PAGES[pageIndex]}
        currentPage={pageIndex}
        pageCount={WAKE_UP_PAGES.length}
        onNext={() =>
          advancePages(
            WAKE_UP_PAGES,
            "tutorial-choice",
          )
        }
      />
    );
  }

  if (phase === "tutorial-choice") {
    return (
      <TutorialChoiceScreen
        onReview={() => changePhase("church")}
        onSkip={() => changePhase("skip-end")}
      />
    );
  }

  if (phase === "church") {
    return (
      <StoryScreen
        title="破败教堂"
        text={CHURCH_PAGES[pageIndex]}
        currentPage={pageIndex}
        pageCount={CHURCH_PAGES.length}
        onNext={() =>
          advancePages(CHURCH_PAGES, "battle")
        }
        nextLabel={
          pageIndex === CHURCH_PAGES.length - 1
            ? "开始战斗"
            : "继续"
        }
      />
    );
  }

  if (phase === "battle") {
    return (
      <BattleScreen
  protagonist={protagonist}
  inventory={props.inventory}
  onComplete={() =>
    changePhase("tutorial-end")
  }
/>
    );
  }

  if (phase === "tutorial-end") {
    return (
      <StoryScreen
        title="教程战结束"
        text={TUTORIAL_END_PAGES[pageIndex]}
        currentPage={pageIndex}
        pageCount={TUTORIAL_END_PAGES.length}
        onNext={() =>
          advancePages(
            TUTORIAL_END_PAGES,
            "flow",
          )
        }
      />
    );
  }

  if (phase === "skip-end") {
    return (
      <StoryScreen
        title="教程摘要"
        text={SKIP_TUTORIAL_PAGES[pageIndex]}
        currentPage={pageIndex}
        pageCount={SKIP_TUTORIAL_PAGES.length}
        onNext={() =>
          advancePages(
            SKIP_TUTORIAL_PAGES,
            "flow",
          )
        }
      />
    );
  }

  if (phase === "flow") {
    return (
      <FlowScreen
        protagonist={protagonist}
        inventory={props.inventory}
        setInventory={
          props.setInventory
        }
        onComplete={() =>
          changePhase("complete")
        }
      />
    );
  }

  return <CompleteScreen onRestart={restartGame} />;
}

export default function App() {
  const [
    inventory,
    setInventory,
  ] = useState<PlayerInventory>(
    () =>
      createStartingInventory(
        PROTAGONISTS[0],
      ),
  );

  function prepareInventory(
    protagonist: ProtagonistDefinition,
  ) {
    setInventory(
      createStartingInventory(
        protagonist,
      ),
    );
  }

  function equipWeapon(
    weaponId: string,
  ) {
    setInventory(
      (currentInventory) => {
        if (
          !currentInventory
            .ownedWeaponIds
            .includes(weaponId)
        ) {
          return currentInventory;
        }

        return {
          ...currentInventory,
          equippedWeaponId: weaponId,
        };
      },
    );
  }

  function equipItem(
    itemId: string,
  ) {
    setInventory(
      (currentInventory) => {
        if (
          !currentInventory
            .ownedItemIds
            .includes(itemId)
        ) {
          return currentInventory;
        }

        return {
          ...currentInventory,
          equippedItemId: itemId,
        };
      },
    );
  }

  function setCompanionSlot(
    slotIndex: number,
    companionId: string | null,
  ) {
    if (
      slotIndex < 0 ||
      slotIndex >= 4
    ) {
      return;
    }

    setInventory(
      (currentInventory) => {
        if (
          companionId &&
          !currentInventory
            .ownedCompanionIds
            .includes(companionId)
        ) {
          return currentInventory;
        }

        const nextSlots: [
          string | null,
          string | null,
          string | null,
          string | null,
        ] = [
          ...currentInventory
            .companionSlots,
        ];

        /*
         * 同一个同伴不能同时占据两个位置。
         */
        if (companionId) {
          for (
            let index = 0;
            index < nextSlots.length;
            index += 1
          ) {
            if (
              nextSlots[index] ===
              companionId
            ) {
              nextSlots[index] = null;
            }
          }
        }

        nextSlots[slotIndex] =
          companionId;

        return {
          ...currentInventory,
          companionSlots: nextSlots,
        };
      },
    );
  }

  return (
    <>
      <GameContent
        inventory={inventory}
        setInventory={setInventory}
        onPrepareInventory={
          prepareInventory
        }
      />

      <CompendiumDock
        inventory={inventory}
        onEquipWeapon={
          equipWeapon
        }
        onEquipItem={equipItem}
        onSetCompanionSlot={
          setCompanionSlot
        }
      />
    </>
  );
}