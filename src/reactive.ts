import { useMount, useUnmount } from "./lifecycle";

// ============================================================================
// ADVANCED TYPESCRIPT PATH INFERENCE HELPERS (WITH ARRAY SUPPORT)
// ============================================================================

type IsAny<T> = 0 extends 1 & T ? true : false;

type PathImpl<T, Key extends keyof T> =
  IsAny<T> extends true
    ? string
    : T extends readonly (infer U)[]
      ? U extends Record<string, any>
        ? U extends Node
          ? `${number}`
          : `${number}` | `${number}.${PathImpl<U, keyof U>}`
        : `${number}`
      : Key extends string | number
        ? T[Key] extends Record<string, any>
          ? T[Key] extends Node
            ? `${Key}`
            : `${Key}` | `${Key}.${PathImpl<T[Key], keyof T[Key]>}`
          : `${Key}`
        : never;

export type Path<T> =
  IsAny<T> extends true
    ? string
    : T extends readonly (infer U)[]
      ? U extends Record<string, any>
        ? U extends Node
          ? `${number}`
          : `${number}` | `${number}.${Path<U>}`
        : `${number}`
      : PathImpl<T, keyof T> | (keyof T & string);

export type PathValue<T, P extends string> =
  IsAny<T> extends true
    ? any
    : T extends readonly (infer U)[]
      ? P extends `${number}.${infer Rest}`
        ? PathValue<U, Rest>
        : P extends `${number}`
          ? U
          : any
      : P extends `${infer Key}.${infer Rest}`
        ? Key extends keyof T
          ? PathValue<T[Key], Rest>
          : any
        : P extends keyof T
          ? T[P]
          : any;

export type ReactiveStore<T extends Record<string, any>> = T & {
  $onChange: (cb: (paths: string[]) => void) => () => void;
};

export type ReactiveProp<V> = V | [ReactiveStore<any>, string];

type UnwrapDependency<Dep> = Dep extends [ReactiveStore<infer T>, infer P]
  ? P extends string
    ? PathValue<T, P>
    : Dep
  : Dep;

type DependencyValues<Deps extends readonly any[]> = {
  [K in keyof Deps]: UnwrapDependency<Deps[K]>;
};

// ============================================================================
// DYNAMIC INLINE JSX REACTIVE PROP BINDERS
// ============================================================================

export const REACTIVE_MARKER = Symbol("REACTIVE_MARKER");

export interface ReactiveBinding<V> {
  [REACTIVE_MARKER]: true;
  deps: readonly any[];
  compute: (...args: any[]) => V;
}

export function isReactiveBinding(value: any): value is ReactiveBinding<any> {
  return value && typeof value === "object" && value[REACTIVE_MARKER] === true;
}

export function $reactive<const Deps extends readonly any[], V>(
  compute: (...values: DependencyValues<Deps>) => V,
  dependencies: Deps
): ReactiveBinding<V> {
  return {
    [REACTIVE_MARKER]: true,
    deps: dependencies,
    compute
  };
}

// ============================================================================
// USE_REACTIVE (OPTIMIZED DEEP STATE PROXY FACTORY WITH BATCHED CHANGELOG)
// ============================================================================

const RAW_TARGET = Symbol("RAW_TARGET");

export function useReactive<T extends Record<string, any>>(initialObj: T): ReactiveStore<T> {
  const listeners = new Set<(paths: string[]) => void>();
  const proxyCache = new WeakMap<object, Map<string, any>>();
  const isNodeDefined = typeof Node !== "undefined";

  let isPending = false;
  const changedPathsQueue = new Set<string>();

  function triggerListeners() {
    if (changedPathsQueue.size === 0) return;

    const pathsArray = Array.from(changedPathsQueue);
    changedPathsQueue.clear();

    listeners.forEach((callback) => callback(pathsArray));
  }

  function createProxy(obj: any, pathPrefix = ""): any {
    return new Proxy(obj, {
      get(target, key: string | symbol, receiver) {
        if (key === RAW_TARGET) return target;
        if (typeof key === "symbol") return Reflect.get(target, key, receiver);

        if (key === "$onChange" && pathPrefix === "") {
          return (cb: (paths: string[]) => void) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
          };
        }

        const val = Reflect.get(target, key, receiver);
        const isDomNode = isNodeDefined && val instanceof Node;

        if (val && typeof val === "object" && !isDomNode) {
          const nextPrefix = pathPrefix ? `${pathPrefix}.${key}` : key;
          let cachedByPath = proxyCache.get(val);
          if (!cachedByPath) {
            cachedByPath = new Map<string, any>();
            proxyCache.set(val, cachedByPath);
          }
          let cachedProxy = cachedByPath.get(nextPrefix);
          if (!cachedProxy) {
            cachedProxy = createProxy(val, nextPrefix);
            cachedByPath.set(nextPrefix, cachedProxy);
          }
          return cachedProxy;
        }
        return val;
      },
      set(target, key: string | symbol, value, receiver) {
        if (typeof key === "symbol") return Reflect.set(target, key, value, receiver);

        const rawValue = value && value[RAW_TARGET] ? value[RAW_TARGET] : value;
        if (Object.is(Reflect.get(target, key, receiver), rawValue)) return true;
        if (!Reflect.set(target, key, rawValue, receiver)) return false;

        const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        changedPathsQueue.add(currentPath);

        if (!isPending) {
          isPending = true;
          queueMicrotask(() => {
            isPending = false;
            triggerListeners();
          });
        }
        return true;
      }
    });
  }

  return createProxy({ ...initialObj }) as ReactiveStore<T>;
}

// ============================================================================
// USE_REACTIVE_EFFECT (MUTATION DETECTOR & DEEP TRACKER)
// ============================================================================

function getDeepValue(obj: any, segments: string[]): any {
  let current = obj;
  const len = segments.length;
  for (let i = 0; i < len; i++) {
    if (current == null) return undefined;
    current = current[segments[i]];
  }
  return current;
}

function isReactiveTuple(dep: any): dep is [store: ReactiveStore<any>, path: string] {
  return (
    Array.isArray(dep) &&
    dep.length === 2 &&
    typeof dep[0] === "object" &&
    dep[0] !== null &&
    typeof dep[0].$onChange === "function" &&
    typeof dep[1] === "string"
  );
}

export function getReactiveValue<V>(prop: ReactiveProp<V>): V {
  if (isReactiveTuple(prop)) {
    const [store, path] = prop;
    return getDeepValue(store, path.split(".")) as V;
  }
  return prop as V;
}

// OVERLOAD 1: Single Reactive Store Dependency Tuple
export function useReactiveEffect<T extends Record<string, any>, P extends Path<T>>(
  callback: (value: PathValue<T, P>) => void,
  dependency: readonly [ReactiveStore<T>, P]
): void;

// OVERLOAD 2: Multi ReactiveProps Tuple
export function useReactiveEffect<const Deps extends readonly any[]>(
  callback: (...values: DependencyValues<Deps>) => void,
  dependencies: Deps
): void;

// CORE IMPLEMENTATION
export function useReactiveEffect(
  callback: (...values: any[]) => void,
  depsOrDep: readonly any[]
): void {
  const isMulti = Array.isArray(depsOrDep) && !isReactiveTuple(depsOrDep);
  const dependencies: readonly any[] = isMulti ? depsOrDep : [depsOrDep];

  const getAllCurrentValues = () => {
    const values = dependencies.map((dep) => getReactiveValue(dep));
    return values;
  };

  const unsubscribes: (() => void)[] = [];

  useMount(() => {
    callback(...getAllCurrentValues());

    dependencies.forEach((dep) => {
      if (!isReactiveTuple(dep)) return;

      const [reactiveObj, targetPath] = dep;
      const unsubscribe = reactiveObj.$onChange((changedPaths: string[]) => {
        const hasMatchingChange = changedPaths.some((changedPath) => {
          const isExactMatch = changedPath === targetPath;
          const isParentOverwritten =
            targetPath.length > changedPath.length && targetPath.startsWith(changedPath + ".");
          const isChildMutated =
            changedPath.length > targetPath.length && changedPath.startsWith(targetPath + ".");

          return isExactMatch || isParentOverwritten || isChildMutated;
        });

        if (hasMatchingChange) {
          callback(...getAllCurrentValues());
        }
      });

      unsubscribes.push(unsubscribe);
    });
  });

  useUnmount(() => {
    unsubscribes.forEach((unsub) => unsub());
  });
}
