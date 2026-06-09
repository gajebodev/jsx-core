import { useMount, useUnmount } from "./lifecycle";

type StatePatch<T> = T extends object ? Partial<T> : T;
export type StateUpdater<T> = StatePatch<T> | ((prev: T) => StatePatch<T>);
type Listener<T> = (state: T) => void;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return Object.getPrototypeOf(value) === Object.prototype;
}

function shallowEqualObjects(
  a: Record<string, unknown>,
  b: Record<string, unknown>
) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is(a[key], b[key])
    ) {
      return false;
    }
  }

  return true;
}

function resolveNextState<T>(previous: T, patch: StatePatch<T>): T {
  if (isPlainObject(previous) && isPlainObject(patch)) {
    return {
      ...(previous as Record<string, unknown>),
      ...(patch as Record<string, unknown>)
    } as T;
  }
  return patch as T;
}

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
    const nextPatch =
      typeof patch === "function"
        ? (patch as (prev: T) => StatePatch<T>)(previous)
        : patch;
    const nextState = resolveNextState(previous, nextPatch);

    // Skip updates if reference hasn't shifted
    if (Object.is(previous, nextState)) {
      return;
    }

    // Skip updates if object shapes have shallow structural match
    if (
      isPlainObject(previous) &&
      isPlainObject(nextState) &&
      shallowEqualObjects(previous, nextState)
    ) {
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

// Declarative Fine-Grained JSX Text Binder
export function $text<T>(store: Store<T>, select: (state: T) => unknown): Text {
  // Create an initial native TextNode using the current slice of state
  const textNode = document.createTextNode(String(select(store.getState())));
  let unsubscribe: (() => void) | null = null;

  // Mount cleanups map seamlessly to your single-run mutation lifecycle tracking
  useMount(() => {
    unsubscribe = store.subscribe((state) => {
      textNode.textContent = String(select(state));
    });
  });

  useUnmount(() => {
    if (unsubscribe) unsubscribe();
  });

  return textNode;
}
