import { type JSXChild, appendChild } from "./jsx-runtime";
import { useReactiveEffect, ReactiveStore, Path } from "./reactive";

interface ShowProps<T extends Record<string, any>, P extends Path<T>> {
  when: [ReactiveStore<T>, P];
  render: () => JSXChild;
  fallback?: () => JSXChild;
}

export function Show<T extends Record<string, any>, P extends Path<T>>({
  when,
  render,
  fallback
}: ShowProps<T, P>): Node {
  const anchor = document.createComment("show-boundary");
  const fragment = document.createDocumentFragment();
  fragment.appendChild(anchor);

  let currentNodes: Node[] = [];
  let isInitialRender = true;

  const clearCurrentNodes = () => {
    for (const node of currentNodes) node.parentNode?.removeChild(node);
    currentNodes = [];
  };

  const appendContent = (renderFn: () => JSXChild, targetContainer: Node | DocumentFragment) => {
    const content = renderFn();
    if (content === undefined || content === null || typeof content === "boolean")
      return;

    const tempContainer = document.createDocumentFragment();
    appendChild(tempContainer, content);
    currentNodes = Array.from(tempContainer.childNodes);
    targetContainer.insertBefore(tempContainer, anchor.nextSibling);
  };

  useReactiveEffect((conditionMet) => {
    if (isInitialRender) {
      //Initial phase: append content straight to the root fragment 
      if (conditionMet) {
        appendContent(render, fragment);
      } else if (fallback !== undefined) {
        appendContent(fallback, fragment);
      }
      isInitialRender = false;
      return;
    }

    // Runtime update phase: clear live elements and insert using the parent anchor
    if (!anchor.parentNode) return;
    clearCurrentNodes();

    if (conditionMet) {
      appendContent(render, anchor.parentNode);
    } else if (fallback !== undefined) {
      appendContent(fallback, anchor.parentNode);
    }
  }, when);

  return fragment;
}
