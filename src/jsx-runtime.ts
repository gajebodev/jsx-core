type Primitive = string | number | boolean | null | undefined;
type Child = Node | Primitive | Child[];
export type JSXChild = Child;

type Props = {
  children?: Child;
  [key: string]: unknown;
};

type Component = (props: Props) => Node;
type StyleObject = Partial<CSSStyleDeclaration>;
type DatasetValue = string | number | boolean | null | undefined;
type RefCallback<T extends HTMLElement = HTMLElement> = (el: T) => void;
type RefObject<T extends HTMLElement = HTMLElement> = { current: T | null };

export const Fragment = Symbol("Fragment");
export type ElementType = string | typeof Fragment | Component;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: {
        children?: unknown;
        [key: string]: unknown;
      };
    }
    interface Element extends Node {}
  }
}

function appendChild(parent: Node, child: Child): void {
  if (Array.isArray(child)) {
    for (const nested of child) {
      appendChild(parent, nested);
    }
    return;
  }

  if (child === null || child === undefined || typeof child === "boolean") {
    return;
  }

  if (child instanceof Node) {
    parent.appendChild(child);
    return;
  }

  parent.appendChild(document.createTextNode(String(child)));
}

function setProp(el: HTMLElement, key: string, value: unknown): void {
  if (key === "className" || key === "class") {
    if (typeof value === "string") {
      el.className = value;
    }
    return;
  }

  if (key === "htmlFor") {
    if (value !== null && value !== undefined) {
      el.setAttribute("for", String(value));
    }
    return;
  }

  if (key === "style") {
    if (typeof value === "string") {
      el.setAttribute("style", value);
      return;
    }

    if (value && typeof value === "object") {
      Object.assign(el.style, value as StyleObject);
    }
    return;
  }

  if (key === "dataset") {
    if (value && typeof value === "object") {
      for (const [datasetKey, datasetValue] of Object.entries(value as Record<string, DatasetValue>)) {
        if (datasetValue === null || datasetValue === undefined) {
          delete el.dataset[datasetKey];
          continue;
        }
        el.dataset[datasetKey] = String(datasetValue);
      }
    }
    return;
  }

  if (key === "ref") {
    if (typeof value === "function") {
      (value as RefCallback)(el);
      return;
    }

    if (value && typeof value === "object" && "current" in value) {
      (value as RefObject).current = el;
    }
    return;
  }

  if (key.startsWith("on") && typeof value === "function") {
    const eventName = key.slice(2).toLowerCase();
    el.addEventListener(eventName, value as EventListener);
    return;
  }

  if (value === false || value === null || value === undefined) {
    return;
  }

  if (value === true) {
    el.setAttribute(key, "");
    return;
  }

  if (key in el && !key.startsWith("data-") && !key.startsWith("aria-")) {
    try {
      ((el as unknown) as Record<string, unknown>)[key] = value;
      return;
    } catch {
      // Fall through to setAttribute for read-only or incompatible properties.
    }
  }

  el.setAttribute(key, String(value));
}

function createNode(type: ElementType, props: Props): Node {
  const children = props.children;

  if (type === Fragment) {
    const fragment = document.createDocumentFragment();
    if (children !== undefined) {
      appendChild(fragment, children);
    }
    return fragment;
  }

  if (typeof type === "function") {
    return type(props);
  }

  const el = document.createElement(type);
  for (const [key, value] of Object.entries(props)) {
    if (key === "children") {
      continue;
    }
    setProp(el, key, value);
  }

  if (children !== undefined) {
    appendChild(el, children);
  }

  return el;
}

export function jsx(type: ElementType, props: Props): Node {
  return createNode(type, props ?? {});
}

export function jsxs(type: ElementType, props: Props): Node {
  return createNode(type, props ?? {});
}
