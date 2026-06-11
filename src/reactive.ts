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
  $onChange: (cb: (path: string, newValue: any) => void) => () => void;
};

export type ReactiveProp<V, T extends Record<string, any>> = V | [ReactiveStore<T>, Path<T>];

export type ReactiveEffectDependency<T extends Record<string, any> = any> = [
  store: ReactiveStore<T>,
  path: Path<T>
];

export type DependencyValues<Deps extends ReactiveEffectDependency[]> = {
  [K in keyof Deps]: Deps[K] extends ReactiveEffectDependency<infer T>
  ? Deps[K] extends Path<T>
  ? PathValue<T, Deps[K]>
  : any
  : any;
};

// ============================================================================
// USE_REACTIVE (OPTIMIZED DEEP STATE PROXY FACTORY)
// ============================================================================

const RAW_TARGET = Symbol("RAW_TARGET");

export function useReactive<T extends Record<string, any>>(
  initialObj: T
): ReactiveStore<T> {
  const listeners = new Set<(path: string, newValue: any) => void>();

  // Maps target objects to a nested Map of pathPrefix -> Proxy
  const proxyCache = new WeakMap<object, Map<string, any>>();
  const isNodeDefined = typeof Node !== "undefined";

  function createProxy(obj: any, pathPrefix = ""): any {
    return new Proxy(obj, {
      get(target, key: string | symbol, receiver) {
        // Expose the raw target to unwrap nested proxies during cross-assignments
        if (key === RAW_TARGET) return target;

        if (typeof key === "symbol") {
          return Reflect.get(target, key, receiver);
        }

        if (key === "$onChange" && pathPrefix === "") {
          return (cb: (path: string, newValue: any) => void) => {
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
        if (typeof key === "symbol") {
          return Reflect.set(target, key, value, receiver);
        }

        // Unwrap incoming values to enforce flat data architectures
        const rawValue = (value && value[RAW_TARGET]) ? value[RAW_TARGET] : value;

        if (Object.is(Reflect.get(target, key, receiver), rawValue)) return true;
        if (!Reflect.set(target, key, rawValue, receiver)) return false;

        const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        listeners.forEach((callback) => callback(currentPath, rawValue));
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

// OVERLOAD 1: Single Tuple Mode
export function useReactiveEffect<T extends Record<string, any>, P extends Path<T>>(
  callback: (newValue: PathValue<T, P>) => void,
  dependency: [ReactiveStore<T>, P]
): void;

// OVERLOAD 2: Multi Tuple Array Mode
export function useReactiveEffect<Deps extends ReactiveEffectDependency[]>(
  callback: (newValues: DependencyValues<Deps>) => void,
  dependencies: [...Deps]
): void;

// CORE IMPLEMENTATION
export function useReactiveEffect(callback: (arg: any) => void, depsOrDep: any): void {
  // Normalize checking whether a single tuple or an array of tuples was passed
  const isMulti = Array.isArray(depsOrDep) && Array.isArray(depsOrDep[0]);
  const dependencies: ReactiveEffectDependency[] = isMulti ? depsOrDep : [depsOrDep];

  const getAllCurrentValues = () => {
    const values = dependencies.map(([store, path]) => getDeepValue(store, path.split(".")));
    return isMulti ? values : values[0];
  };

  const unsubscribes: (() => void)[] = [];

  useMount(() => {
    // Initial evaluation
    callback(getAllCurrentValues());

    // Setup active listeners for each dependency slot
    dependencies.forEach(([reactiveObj, targetPath]) => {
      const unsubscribe = reactiveObj.$onChange((changedPath: string) => {
        const isExactMatch = changedPath === targetPath;

        const isParentOverwritten =
          targetPath.length > changedPath.length &&
          targetPath.startsWith(changedPath + ".");

        const isChildMutated =
          changedPath.length > targetPath.length &&
          changedPath.startsWith(targetPath + ".");

        if (isExactMatch || isParentOverwritten || isChildMutated) {
          callback(getAllCurrentValues());
        }
      });

      unsubscribes.push(unsubscribe);
    });
  });

  useUnmount(() => {
    unsubscribes.forEach((unsub) => unsub());
  });
}
