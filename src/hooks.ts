import { isPlainObject, resolveNextState, shallowEqualObjects, StatePatch, StateUpdater } from "./utils";

type StateSetter<T> = (next: StateUpdater<T>) => void;

export interface StateRef<TElement = unknown> {
  current: TElement | null;
}

export type StateChangeHandler<T, TElement = unknown> = (
  ref: StateRef<TElement>,
  state: T,
  previous: T
) => void;

export type StateHook<T, TElement = unknown> = StateSetter<T> & {
  get: () => T;
  subscribe: (listener: StateChangeHandler<T, TElement>) => () => void;
};

type LifecycleCleanup = () => void;
type LifecycleMountCallback = () => void | LifecycleCleanup;
type LifecycleUnmountCallback = () => void;

interface LifecycleCollector {
  mountCallbacks: LifecycleMountCallback[];
  unmountCallbacks: LifecycleUnmountCallback[];
}

interface LifecycleEntry {
  targets: Node[];
  mounted: boolean;
  unmounted: boolean;
  mountCallbacks: LifecycleMountCallback[];
  unmountCallbacks: LifecycleUnmountCallback[];
}

let activeLifecycleCollector: LifecycleCollector | null = null;
const lifecycleEntries = new Set<LifecycleEntry>();
let lifecycleObserver: MutationObserver | null = null;
let lifecycleFlushQueued = false;

function resolveLifecycleTargets(node: Node) {
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    const children = Array.from(node.childNodes);
    return children.length > 0 ? children : [node];
  }

  return [node];
}

function fireMount(entry: LifecycleEntry) {
  if (entry.mounted) {
    return;
  }

  entry.mounted = true;
  for (const callback of entry.mountCallbacks) {
    const cleanup = callback();
    if (typeof cleanup === "function") {
      entry.unmountCallbacks.push(cleanup);
    }
  }
}

function fireUnmount(entry: LifecycleEntry) {
  if (entry.unmounted) {
    return;
  }

  entry.unmounted = true;
  for (const callback of entry.unmountCallbacks) {
    callback();
  }
}

function flushLifecycleEntries() {
  for (const entry of Array.from(lifecycleEntries)) {
    const isConnected = entry.targets.some((target) => target.isConnected);

    if (!entry.mounted && isConnected) {
      fireMount(entry);
      continue;
    }

    if (entry.mounted && !isConnected) {
      fireUnmount(entry);
      lifecycleEntries.delete(entry);
    }
  }
}

function scheduleLifecycleFlush() {
  if (lifecycleFlushQueued) {
    return;
  }

  lifecycleFlushQueued = true;
  queueMicrotask(() => {
    lifecycleFlushQueued = false;
    flushLifecycleEntries();
  });
}

function ensureLifecycleObserver() {
  if (lifecycleObserver || typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return;
  }

  const root = document.documentElement;
  if (!root) {
    return;
  }

  lifecycleObserver = new MutationObserver(() => {
    flushLifecycleEntries();
  });

  lifecycleObserver.observe(root, {
    childList: true,
    subtree: true
  });
}

function registerLifecycle(node: Node, collector: LifecycleCollector) {
  if (collector.mountCallbacks.length === 0 && collector.unmountCallbacks.length === 0) {
    return;
  }

  lifecycleEntries.add({
    targets: resolveLifecycleTargets(node),
    mounted: false,
    unmounted: false,
    mountCallbacks: [...collector.mountCallbacks],
    unmountCallbacks: [...collector.unmountCallbacks]
  });

  ensureLifecycleObserver();
  scheduleLifecycleFlush();
}

export function useMount(callback: LifecycleMountCallback) {
  if (!activeLifecycleCollector) {
    throw new Error("useMount must run inside a function component");
  }

  activeLifecycleCollector.mountCallbacks.push(callback);
}

export function useUnmount(callback: LifecycleUnmountCallback) {
  if (!activeLifecycleCollector) {
    throw new Error("useUnmount must run inside a function component");
  }

  activeLifecycleCollector.unmountCallbacks.push(callback);
}

export function __renderWithLifecycle(render: () => Node) {
  const previousCollector = activeLifecycleCollector;
  const collector: LifecycleCollector = {
    mountCallbacks: [],
    unmountCallbacks: []
  };

  activeLifecycleCollector = collector;
  let node: Node;

  try {
    node = render();
  } finally {
    activeLifecycleCollector = previousCollector;
  }

  registerLifecycle(node, collector);
  return node;
}

export function useState<T, TElement = unknown>(
  initial: T | (() => T),
  onChange?: StateChangeHandler<T, TElement>
): readonly [StateRef<TElement>, StateHook<T, TElement>] {
  let state = typeof initial === "function" ? (initial as () => T)() : initial;
  const ref: StateRef<TElement> = { current: null };
  const listeners = new Set<StateChangeHandler<T, TElement>>();

  if (onChange) {
    listeners.add(onChange);
  }

  const setState = ((next: StateUpdater<T>) => {
    const previous = state;
    const patch = typeof next === "function"
      ? (next as (prev: T) => StatePatch<T>)(previous)
      : next;
    const resolved = resolveNextState(previous, patch);

    if (Object.is(previous, resolved)) {
      return;
    }

    if (isPlainObject(previous) && isPlainObject(resolved) && shallowEqualObjects(previous, resolved)) {
      return;
    }

    state = resolved;
    for (const listener of listeners) {
      listener(ref, state, previous);
    }
  }) as StateHook<T, TElement>;

  setState.get = () => state;
  setState.subscribe = (listener: StateChangeHandler<T, TElement>) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return [ref, setState] as const;
}