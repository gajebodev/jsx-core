import { useMount, useUnmount } from "./lifecycle";

// ============================================================================
// ADVANCED TYPESCRIPT PATH INFERENCE HELPERS (WITH ANY SHIELD)
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

// ============================================================================
// USE_REACTIVE (OPTIMIZED DEEP STATE PROXY FACTORY)
// ============================================================================
const RAW_TARGET = Symbol("RAW_TARGET");

export function useReactive<T extends Record<string, any>>(
  initialObj: T
): ReactiveStore<T> {
  const listeners = new Set<(path: string, newValue: any) => void>();
  const proxyCache = new WeakMap<object, Map<string, any>>();

  function createProxy(obj: any, pathPrefix = ""): any {
    return new Proxy(obj, {
      get(target, key: string | symbol, receiver) {
        if (key === RAW_TARGET) return target;

        if (typeof key === "symbol")
          return Reflect.get(target, key, receiver);

        if (key === "$onChange" && pathPrefix === "") {
          return (cb: (path: string, newValue: any) => void) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
          };
        }

        const val = Reflect.get(target, key, receiver);
        if (val && typeof val === "object" && !(val instanceof Node)) {
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
        if (typeof key === "symbol")
          return Reflect.set(target, key, value, receiver);

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

export function useReactiveEffect<
  T extends Record<string, any>,
  P extends Path<T>
>(
  callback: (newValue: PathValue<T, P>) => void,
  [reactiveObj, targetPath]: [ReactiveStore<T>, P]
): void {
  const pathSegments = targetPath.split(".");

  let unsubscribe: (() => void) | null = null;

  useMount(() => {
    callback(getDeepValue(reactiveObj, pathSegments));

    unsubscribe = reactiveObj.$onChange((changedPath: string) => {
      // Case A: The exact target path changed
      if (changedPath === targetPath) {
        callback(getDeepValue(reactiveObj, pathSegments));
        return;
      }

      // Case B: A structural parent object was completely overwritten
      if (
        targetPath.length > changedPath.length &&
        targetPath.startsWith(changedPath + ".")
      ) {
        callback(getDeepValue(reactiveObj, pathSegments));
        return;
      }

      // Case C: An internal item property deep inside an array or object shifted
      if (
        changedPath.length > targetPath.length &&
        changedPath.startsWith(targetPath + ".")
      ) {
        callback(getDeepValue(reactiveObj, pathSegments));
      }
    });
  });

  useUnmount(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
}

// ============================================================================
// USE_REACTIVE_VALUE (STREAMLINED CONTROLLABLE STATE STRATEGIST)
// ============================================================================

interface StandardControllableProps<T> {
  value?: T;
  [key: string]: any;
}

interface ControllableOptions<T> {
  defaultValue?: T;
  onChange?: (newValue: T) => void;
}

export function useReactiveValue<T>(
  props: StandardControllableProps<T>,
  options: ControllableOptions<T> = {}
) {
  const isControlled = "value" in props && props.value !== undefined;
  const initialValue = isControlled ? props.value : options.defaultValue;
  const state = useReactive({ value: initialValue });

  if (isControlled && typeof (props as any).$onChange === "function") {
    useReactiveEffect(
      (newParentValue) => {
        state.value = newParentValue;
      },
      [props as any, "value"]
    );
  }

  const setState = (newValue: T | ((prev: T) => T)) => {
    const resolvedValue =
      typeof newValue === "function"
        ? (newValue as (prev: T) => T)(state.value as T)
        : newValue;

    if (!isControlled) {
      state.value = resolvedValue;
    }

    if (typeof options.onChange === "function") {
      options.onChange(resolvedValue);
    }
  };

  return [state, setState] as const;
}
