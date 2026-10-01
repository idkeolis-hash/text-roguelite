import {
  useLayoutEffect,
  useSyncExternalStore,
} from "react";

type Listener = () => void;

const activeLocks = new Set<symbol>();
const listeners = new Set<Listener>();

export function isConfigurationLocked(): boolean {
  return activeLocks.size > 0;
}

function notifyIfChanged(previous: boolean): void {
  if (previous === isConfigurationLocked()) {
    return;
  }

  for (const listener of [...listeners]) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function acquireConfigurationLock(): () => void {
  const token = Symbol("battle-configuration");
  const previous = isConfigurationLocked();

  activeLocks.add(token);
  notifyIfChanged(previous);

  return () => {
    const wasLocked = isConfigurationLocked();

    if (!activeLocks.delete(token)) {
      return;
    }

    notifyIfChanged(wasLocked);
  };
}

export function useConfigurationLocked(): boolean {
  return useSyncExternalStore(
    subscribe,
    isConfigurationLocked,
    () => false,
  );
}

export function useBattleConfigurationLock(
  active: boolean,
): void {
  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    return acquireConfigurationLock();
  }, [active]);
}