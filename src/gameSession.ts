import type { SetStateAction } from "react";
import type { PlayerInventory } from "./inventory";
import {
  createCurrentRun,
  createUserProgress,
  discoverInventory,
  type CurrentRun,
  type FlowState,
  type GameMode,
  type UserProgress,
} from "./sessionState";
import {
  readRun,
  readUser,
  writeSlot,
  type SaveStorage,
} from "./saveStorage";

export interface SessionSnapshot {
  run: CurrentRun;
  user: UserProgress;
  saveError: string | null;
}

export interface GameSession {
  mode: GameMode;
  slot: number | null;
  getSnapshot: () => SessionSnapshot;
  subscribe: (listener: () => void) => () => void;
  updateRun: (
    update: (current: CurrentRun) => CurrentRun,
  ) => void;
  setRunField: <K extends keyof CurrentRun>(
    key: K,
    value: SetStateAction<CurrentRun[K]>,
  ) => void;
  setFlowField: <K extends keyof FlowState>(
    key: K,
    value: SetStateAction<FlowState[K]>,
  ) => void;
  setInventory: (value: SetStateAction<PlayerInventory>) => void;
  checkpoint: () => void;
  retrySave: () => void;
  restart: () => void;
  endRun: () => void;
  gainFate: (amount: number) => void;
}

function resolve<T>(value: SetStateAction<T>, current: T): T {
  return typeof value === "function"
    ? (value as (current: T) => T)(current)
    : value;
}

function createSession(
  mode: GameMode,
  slot: number | null,
  initialRun: CurrentRun,
  initialUser: UserProgress,
  storage?: SaveStorage,
): GameSession {
  let snapshot: SessionSnapshot = {
    run: structuredClone(initialRun),
    user: structuredClone(initialUser),
    saveError: null,
  };

  // 运行中的状态和最近完成的检查点分别保存。
  let savedRun = structuredClone(initialRun);

  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function flush(): void {
    if (mode === "debug") {
      return;
    }

    let saveError: string | null = null;

    try {
      if (!storage || slot === null) {
        throw new Error("Normal 会话缺少存档存储。");
      }

      writeSlot(storage, slot, snapshot.user, savedRun);
    } catch (error) {
      saveError =
        error instanceof Error
          ? error.message
          : "无法写入存档。";
    }

    if (snapshot.saveError !== saveError) {
      snapshot = {
        ...snapshot,
        saveError,
      };

      notify();
    }
  }

  function updateRun(
    update: (current: CurrentRun) => CurrentRun,
  ): void {
    const run = update(snapshot.run);

    if (run === snapshot.run) {
      return;
    }

    // 尚未确认主控时，不把预置库存算作实际获得。
    const canDiscover =
      run.phase !== "opening" &&
      run.phase !== "character-select";

    const user =
      mode === "normal" && canDiscover
        ? discoverInventory(snapshot.user, run.inventory)
        : snapshot.user;

    const userChanged = user !== snapshot.user;

    snapshot = {
      ...snapshot,
      run,
      user,
    };

    notify();

    if (userChanged) {
      // 只更新永久发现；本局仍写最近完成的检查点。
      flush();
    }
  }

  function checkpoint(): void {
    savedRun = structuredClone(snapshot.run);
    flush();
  }

  const session: GameSession = {
    mode,
    slot,

    getSnapshot: () => snapshot,

    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    updateRun,

    setRunField: (key, value) => {
      updateRun((current) => ({
        ...current,
        [key]: resolve(value, current[key]),
      }));
    },

    setFlowField: (key, value) => {
      updateRun((current) => ({
        ...current,
        flow: {
          ...current.flow,
          [key]: resolve(value, current.flow[key]),
        },
      }));
    },

    setInventory: (value) => {
      updateRun((current) => ({
        ...current,
        inventory: resolve(value, current.inventory),
      }));
    },

    checkpoint,

    // 重试写入现有检查点，不提交当前未完成节点。
    retrySave: flush,

    restart: () => {
      snapshot = {
        ...snapshot,
        run: createCurrentRun(),
      };

      notify();
      checkpoint();
    },

    endRun: () => {
      if (snapshot.run.phase === "failed") {
        return;
      }

      updateRun((current) => ({
        ...current,
        phase: "failed",
        pageIndex: 0,
      }));

      checkpoint();
    },

    gainFate: (amount) => {
      if (!Number.isSafeInteger(amount) || amount < 0) {
        throw new Error("增加的命运必须是非负整数。");
      }

      const fate = snapshot.user.fate + amount;

      if (!Number.isSafeInteger(fate)) {
        throw new Error("命运数值超出有效范围。");
      }

      snapshot = {
        ...snapshot,
        user: {
          ...snapshot.user,
          fate,
        },
      };

      notify();
      flush();
    },
  };

  return session;
}

export function createDebugSession(): GameSession {
  // 不取得 localStorage，也不读取任何槽位。
  return createSession(
    "debug",
    null,
    createCurrentRun(),
    createUserProgress(),
  );
}

export function createNormalSession(
  storage: SaveStorage,
  slot: number,
  startNew: boolean,
): GameSession {
  const existingUser = readUser(storage, slot);

  if (startNew) {
    const session = createSession(
      "normal",
      slot,
      createCurrentRun(),
      existingUser ?? createUserProgress(),
      storage,
    );

    session.checkpoint();

    return session;
  }

  const run = readRun(storage, slot);

  if (!run) {
    throw new Error("这个槽位没有本局存档，请选择新开一局。");
  }

  if (!existingUser) {
    throw new Error("本局存档缺少对应永久进度，不能安全继续。");
  }

  return createSession(
    "normal",
    slot,
    run,
    existingUser,
    storage,
  );
}