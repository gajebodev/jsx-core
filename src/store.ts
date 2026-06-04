import { StatePatch, StateUpdater, isPlainObject, resolveNextState, shallowEqualObjects } from "./utils";

type Listener<T> = (state: T) => void;

export interface Store<T> {
  getState: () => T;
  setState: (patch: StateUpdater<T>) => void;
  subscribe: (listener: Listener<T>) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  const getState = () => state;

  const setState = (patch: StateUpdater<T>) => {
    const previous = state;
    const nextPatch = typeof patch === "function"
      ? (patch as (prev: T) => StatePatch<T>)(previous)
      : patch;
    const nextState = resolveNextState(previous, nextPatch);

    if (Object.is(previous, nextState)) {
      return;
    }

    if (isPlainObject(previous) && isPlainObject(nextState) && shallowEqualObjects(previous, nextState)) {
      return;
    }

    state = nextState;

    listeners.forEach((listener) => listener(state));
  };

  const subscribe = (listener: Listener<T>) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { getState, setState, subscribe };
}

export function bindStoreText<T>(
  store: Store<T>,
  select: (state: T) => string,
  target: HTMLElement
) {
  const render = () => {
    target.textContent = select(store.getState());
  };

  render();
  return store.subscribe(render);
}
