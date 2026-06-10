import { type JSXChild, appendChild } from "@gajebodev/jsx-core";

export interface ErrorBoundaryProps {
  children: JSXChild;
  fallback: (error: Error) => JSXChild;
}

export function ErrorBoundary(props: ErrorBoundaryProps): Node {
  const anchor = document.createComment("error-boundary");
  const fragment = document.createDocumentFragment();
  fragment.appendChild(anchor);

  let currentNodes: Node[] = [];
  let isInitialRender = true;

  const clearCurrentNodes = () => {
    for (const node of currentNodes) node.parentNode?.removeChild(node);
    currentNodes = [];
  };

  const appendContent = (content: JSXChild, targetContainer: Node | DocumentFragment, useInsertBefore: boolean) => {
    if (content === undefined || content === null || typeof content === "boolean")
      return;

    const tempContainer = document.createDocumentFragment();
    appendChild(tempContainer, content);

    currentNodes = Array.from(tempContainer.childNodes);

    if (useInsertBefore) {
      targetContainer.insertBefore(tempContainer, anchor);
    } else {
      targetContainer.appendChild(tempContainer);
    }
  };

  try {
    appendContent(props.children, fragment, false);
    isInitialRender = false;
  } catch (err) {
    clearCurrentNodes();
    const error = err instanceof Error ? err : new Error(String(err));
    // Choose the container depending on whether we crashed during initial render or later
    const container = isInitialRender ? fragment : anchor.parentNode;
    if (container) {
      appendContent(props.fallback(error), container, !isInitialRender);
    }
  }

  return fragment;
}
