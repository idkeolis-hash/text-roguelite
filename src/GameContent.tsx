import {
  useMemo,
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
  type ProtagonistDefinition,
  type StoryPage,
} from "./content";
import type { PlayerInventory } from "./inventory";
import {
  StoryScreen,
  CharacterSelectScreen,
  TutorialChoiceScreen,
} from "./StoryScreens";
import BattleScreen from "./BattleScreen";
import FlowScreen from "./FlowScreen";

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
 | "complete"
  | "failed";

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
        onDefeat={() => changePhase("failed")}
      />
    );
  }

 if (phase === "failed") {
    return (
      <main className="screen story-screen">
        <section className="panel story-panel complete-panel">
          <p className="eyebrow">RUN ENDED</p>
          <h1>本局结束</h1>

          <div className="story-text">
            勇者倒在了旅途中。
            本局已经结束，无法返回刚才的战斗。
          </div>

          <div className="button-row right">
            <button
              type="button"
              className="secondary-button"
              onClick={restartGame}
            >
              返回开场，开始新的一局
            </button>
          </div>
        </section>
      </main>
    );
  }

  return <CompleteScreen onRestart={restartGame} />;
}

  export default GameContent;