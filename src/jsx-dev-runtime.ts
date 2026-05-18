import { Fragment, jsx, type ElementType } from "./jsx-runtime";

export { Fragment };

export function jsxDEV(type: unknown, props: unknown): Node {
  return jsx(type as ElementType, (props ?? {}) as Record<string, unknown>);
}
