type Listener<T> = (state: T) => void;

export interface Store<T> {
  getState: () => T;
  setState: (patch: Partial<T> | ((prev: T) => T)) => void;
  subscribe: (listener: Listener<T>) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  const getState = () => state;

  const setState = (patch: Partial<T> | ((prev: T) => T)) => {
    state =
      typeof patch === "function"
        ? (patch as (prev: T) => T)(state)
        : ({ ...state, ...patch } as T);

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
