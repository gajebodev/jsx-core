import { Fragment, jsx, type ElementType } from "./jsx-runtime";

export { Fragment };

export function jsxDEV(
  type: unknown,
  props: unknown,
  key?: unknown,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown
): Node {
  return jsx(type as ElementType, (props ?? {}) as Record<string, unknown>, key);
}
