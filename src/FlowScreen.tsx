import {
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ProtagonistDefinition } from "./content";
import type { GameSession } from "./gameSession";
import type { FlowState } from "./sessionState";
import {
  applyInventoryBonuses,
  type PlayerInventory,
} from "./inventory";
import {
  changeInventoryGold,
  changeInventoryStat,
  changeInventoryStats,
} from "./inventoryOperations";
import {
  createPlaceholderBattle,
  type PlaceholderBattleType,
} from "./game";
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
  type FlowNodeId,
  type FlowReward,
} from "./flow";
import BattleScreen from "./BattleScreen";

import {
  buyInventoryReward,
  grantInventoryReward,
} from "./inventoryRewards";

function FlowScreen(props: {
  flow: FlowState;
  session: GameSession;
  protagonist: ProtagonistDefinition;
  inventory: PlayerInventory;

  setInventory: Dispatch<
    SetStateAction<PlayerInventory>
  >;

  onComplete: () => void;
  onDefeat: () => void;
}) {
 const {
    areaNumber,
    stageIndex,
    view,
  } = props.flow;

  function setAreaNumber(value: SetStateAction<number>): void {
    props.session.setFlowField("areaNumber", value);
  }

  function setStageIndex(value: SetStateAction<number>): void {
    props.session.setFlowField("stageIndex", value);
  }

  function setView(
    value: SetStateAction<FlowState["view"]>,
  ): void {
    props.session.setFlowField("view", value);
  }
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
    props.setInventory((current) =>
      changeInventoryGold(current, amount),
    );
  }

  function addStat(
    stat: CoreStatKey,
    amount: number,
  ) {
    props.setInventory((current) =>
      changeInventoryStat(current, stat, amount),
    );
  }

  function addSeveralStats(
    stats: CoreStatKey[],
    amount: number,
  ) {
    props.setInventory((current) =>
      changeInventoryStats(current, stats, amount),
    );
  }

  function grantReward(reward: FlowReward) {
    props.setInventory((current) =>
      grantInventoryReward(current, reward),
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
      goToStage(stageIndex + 1);
    } else if (areaNumber >= 5) {
      props.onComplete();
      return;
    } else {
      setAreaNumber((current) => current + 1);
      setStageIndex(0);
      setView({
        type: "fool",
      });
    }

    props.session.checkpoint();
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

   props.setInventory((current) =>
      buyInventoryReward(current, slot.reward, slot.price),
    );

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

      message = `获得${outcome.reward.name}。`;
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
        onDefeat={props.onDefeat}
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

export default FlowScreen;