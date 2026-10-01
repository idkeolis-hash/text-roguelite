import {
  useState,
  useSyncExternalStore,
} from "react";
import GameContent from "./GameContent";
import CompendiumDock from "./CompendiumDock";
import { usePlayerInventory } from "./usePlayerInventory";
import {
  createDebugSession,
  createNormalSession,
  type GameSession,
} from "./gameSession";

function SessionGame(props: {
  session: GameSession;
  onExit: () => void;
}) {
  const { session } = props;

  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  const {
    inventory,
    setInventory,
    prepareInventory,
    equipWeapon,
    equipItem,
    setCompanionSlot,
  } = usePlayerInventory(
    state.run.inventory,
    session.setInventory,
  );

  return (
    <>
      <header className="panel">
        <div className="button-row">
          <strong>
            {session.mode === "debug"
              ? "DEBUG"
              : `NORMAL · 槽位 ${session.slot}`}
          </strong>

          <span>命运：{state.user.fate}</span>

          <button
            type="button"
            className="secondary-button"
            onClick={props.onExit}
          >
            返回模式选择
          </button>
        </div>

        {session.mode === "normal" && (
          <p className="muted-text">
            本局只保存完成的检查点。
            在节点中途退出，会回到最近检查点。
          </p>
        )}

        {state.saveError && (
          <div role="alert">
            <p>
              存档写入失败：{state.saveError}
              当前进度尚未可靠保存，请不要关闭页面。
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={session.retrySave}
            >
              重试保存
            </button>
          </div>
        )}
      </header>

      <GameContent
        run={state.run}
        session={session}
        inventory={inventory}
        setInventory={setInventory}
        onPrepareInventory={prepareInventory}
      />

      <CompendiumDock
        inventory={inventory}
        mode={session.mode}
        discoveredIds={state.user.discoveredIds}
        onEquipWeapon={equipWeapon}
        onEquipItem={equipItem}
        onSetCompanionSlot={setCompanionSlot}
      />
    </>
  );
}

export default function App() {
  const [session, setSession] =
    useState<GameSession | null>(null);

  const [slot, setSlot] = useState(1);
  const [message, setMessage] = useState("");

  function enterNormal(startNew: boolean): void {
    if (
      startNew &&
      !window.confirm(
        `新开一局会替换槽位 ${slot} 的当前本局，保留图鉴和命运。继续吗？`,
      )
    ) {
      return;
    }

    try {
      const nextSession = createNormalSession(
        window.localStorage,
        slot,
        startNew,
      );

      setMessage("");
      setSession(nextSession);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "无法进入 Normal。",
      );
    }
  }

  if (session) {
    return (
      <SessionGame
        session={session}
        onExit={() => {
          setSession(null);
          setMessage("");
        }}
      />
    );
  }

  return (
    <main className="screen story-screen">
      <section className="panel choice-panel">
        <p className="eyebrow">GAME MODE</p>
        <h1>选择游戏模式</h1>

        <button
          type="button"
          className="choice-button"
          onClick={() => {
            setMessage("");
            setSession(createDebugSession());
          }}
        >
          <strong>Debug</strong>
          <span>
            图鉴全部开放。不读写存档，每次进入都是新会话。
          </span>
        </button>

        <h2>Normal</h2>

        <div className="button-row">
          {[1, 2, 3].map((number) => (
            <button
              type="button"
              key={number}
              className={
                number === slot
                  ? "primary-button"
                  : "secondary-button"
              }
              aria-pressed={number === slot}
              onClick={() => {
                setSlot(number);
                setMessage("");
              }}
            >
              槽位 {number}
            </button>
          ))}
        </div>

        <div className="button-row">
          <button
            type="button"
            className="primary-button"
            onClick={() => enterNormal(false)}
          >
            继续本局
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => enterNormal(true)}
          >
            新开一局
          </button>
        </div>

        {message && <p role="alert">{message}</p>}
      </section>
    </main>
  );
}