import { __renderWithLifecycle } from "./lifecycle";

type Primitive = string | number | boolean | null | undefined;
export type JSXChild = Node | Primitive | JSXChild[];

type Props = {
  children?: JSXChild;
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
      [elemName: string]: Record<string, unknown>;
    }
    interface Element extends Node { }
  }
}

export function appendChild(parent: Node, child: JSXChild): void {
  if (child === null || child === undefined || typeof child === "boolean")
    return;
  if (Array.isArray(child)) {
    for (const nested of child) appendChild(parent, nested);
    return;
  }
  if (child instanceof Node) {
    parent.appendChild(child);
    return;
  }
  parent.appendChild(document.createTextNode(String(child)));
}

const DOM_PROP_MAP: Record<string, string> = {
  class: "className",
  classname: "className",
  htmlfor: "htmlFor",
  readonly: "readOnly",
  autofocus: "autoFocus",
  autocomplete: "autoComplete",
  maxlength: "maxLength",
  minlength: "minLength",
  tabindex: "tabIndex"
};

const LIVE_PROPERTIES = new Set([
  "value",
  "checked",
  "disabled",
  "muted",
  "selected",
  "readOnly",
  "autoFocus",
  "autoComplete",
  "maxLength",
  "minLength",
  "tabIndex"
]);

function setProp(el: HTMLElement, key: string, value: unknown): void {
  // Normalize casing mismatches
  const lookupKey = key.toLowerCase();
  const normalizedKey = Object.prototype.hasOwnProperty.call(DOM_PROP_MAP, lookupKey)
    ? DOM_PROP_MAP[lookupKey]
    : key;

  // Inline Styles
  if (normalizedKey === "style") {
    if (typeof value === "string") {
      el.setAttribute("style", value);
    } else if (value && typeof value === "object") {
      Object.assign(el.style, value as StyleObject);
    } else {
      el.removeAttribute("style");
    }
    return;
  }

  // Datasets (Object syntax style: dataset={{ id: 1 }})
  if (normalizedKey === "dataset" && value && typeof value === "object") {
    for (const [dKey, dVal] of Object.entries(
      value as Record<string, DatasetValue>
    )) {
      if (dVal === null || dVal === undefined) delete el.dataset[dKey];
      else el.dataset[dKey] = String(dVal);
    }
    return;
  }

  // Element References
  if (normalizedKey === "ref") {
    if (typeof value === "function") (value as RefCallback)(el);
    else if (value && typeof value === "object" && "current" in value) {
      (value as RefObject).current = el;
    }
    return;
  }

  // Safe Event Handlers (Direct property replacement prevents event stacking leaks)
  if (normalizedKey.startsWith("on") && normalizedKey.length > 2) {
    const eventName = normalizedKey.slice(2).toLowerCase();
    (el as any)[`on${eventName}`] = typeof value === "function" ? value : null;
    return;
  }

  const attrName =
    normalizedKey === "className"
      ? "class"
      : normalizedKey === "htmlFor"
        ? "for"
        : normalizedKey;

  // Clean Falsy State Clearing (Wipes attributes from DOM when missing or false)
  if (value === false || value === null || value === undefined || value === "") {
    if (LIVE_PROPERTIES.has(normalizedKey) && normalizedKey in el) {
      (el as any)[normalizedKey] = normalizedKey === "value" ? "" : false;
    }
    el.removeAttribute(attrName);
    return;
  }

  // Live JavaScript DOM Properties vs HTML Attributes
  if (LIVE_PROPERTIES.has(normalizedKey) && normalizedKey in el) {
    (el as any)[normalizedKey] = value === true ? true : value;
    return;
  }

  // Attribute Safe Guard Fallback (Handles data-*, aria-*, and custom keys)
  el.setAttribute(attrName, value === true ? "" : String(value));
}

// All SVG elements lowercased to match compiled outputs
const SVG_ELEMENTS = new Set([
  "svg",
  "path",
  "circle",
  "ellipse",
  "line",
  "rect",
  "polygon",
  "polyline",
  "g",
  "text",
  "tspan",
  "defs",
  "use",
  "symbol",
  "marker",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
  "image",
  "foreignobject"
]);

function createNode(type: ElementType, props: Props, key?: unknown): Node {
  // If it's a functional component, inject key back to props so the developer can access it
  if (typeof type === "function") {
    if (key !== undefined) {
      props = { ...props, key };
    }
    return __renderWithLifecycle(() => type(props));
  }

  if (type === Fragment) {
    const fragment = document.createDocumentFragment();
    if (props.children !== undefined) {
      appendChild(fragment, props.children);
    }
    return fragment;
  }

  let el: Element;
  const tagType = typeof type === "string" ? type.toLowerCase() : "";

  if (SVG_ELEMENTS.has(tagType)) {
    // Standard SVG elements must keep their explicit lowercase tag format
    // Special camelCase tags must be passed accurately to createElementNS
    let svgTag = tagType;
    if (tagType === "lineargradient") svgTag = "linearGradient";
    else if (tagType === "radialgradient") svgTag = "radialGradient";
    else if (tagType === "clippath") svgTag = "clipPath";
    else if (tagType === "foreignobject") svgTag = "foreignObject";

    el = document.createElementNS("http://www.w3.org/2000/svg", svgTag);
  } else {
    el = document.createElement(type as string);
  }

  // Map incoming standard props
  for (const [propKey, value] of Object.entries(props)) {
    if (propKey === "children") continue;
    setProp(el as HTMLElement, propKey, value);
  }

  // Explicitly bind compiler-extracted keys as native element attributes
  if (key !== undefined) {
    setProp(el as HTMLElement, "key", key);
  }

  if (props.children !== undefined) {
    appendChild(el, props.children);
  }

  return el;
}

// Automatic Transform entry specifications expected by esbuild, Vite, SWC, and Babel
export function jsx(type: ElementType, props: Props, key?: unknown): Node {
  return createNode(type, props ?? {}, key);
}

export function jsxs(type: ElementType, props: Props, key?: unknown): Node {
  return createNode(type, props ?? {}, key);
}

export function jsxDEV(type: ElementType, props: Props, key?: unknown): Node {
  return createNode(type, props ?? {}, key);
}
