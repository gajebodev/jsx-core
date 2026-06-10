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

  const appendContent = (renderFn: () => JSXChild, targetContainer: Node | DocumentFragment, useInsertBefore: boolean) => {
    // Evaluate the function lazily on demand to generate fresh elements and lifecycles
    const content = renderFn();
    if (content === undefined || content === null || typeof content === "boolean")
      return;

    const tempContainer = document.createDocumentFragment();
    appendChild(tempContainer, content);

    // Keep an exact, isolated array map of the live DOM sub-tree 
    currentNodes = Array.from(tempContainer.childNodes);

    if (useInsertBefore) {
      targetContainer.insertBefore(tempContainer, anchor);
    } else {
      targetContainer.appendChild(tempContainer);
    }
  };

  useReactiveEffect((conditionMet) => {
    if (isInitialRender) {
      //Initial phase: append content straight to the root fragment 
      if (conditionMet) {
        appendContent(render, fragment, false);
      } else if (fallback !== undefined) {
        appendContent(fallback, fragment, false);
      }
      isInitialRender = false;
      return;
    }

    // Live runtime update phase: clear live elements and insert using the parent anchor
    if (!anchor.parentNode) return;
    clearCurrentNodes();

    if (conditionMet) {
      appendContent(render, anchor.parentNode, true);
    } else if (fallback !== undefined) {
      appendContent(fallback, anchor.parentNode, true);
    }
  }, when);

  return fragment;
}
