export type StatePatch<T> = T extends object ? Partial<T> | T : T;
export type StateUpdater<T> = StatePatch<T> | ((prev: T) => StatePatch<T>);

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function shallowEqualObjects(a: Record<string, unknown>, b: Record<string, unknown>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

export function resolveNextState<T>(previous: T, patch: StatePatch<T>): T {
  if (isPlainObject(previous) && isPlainObject(patch)) {
    return {
      ...(previous as Record<string, unknown>),
      ...(patch as Record<string, unknown>)
    } as T;
  }

  return patch as T;
}
