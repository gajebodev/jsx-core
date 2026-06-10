import { type JSXChild, appendChild } from "./jsx-runtime";

export interface ErrorBoundaryProps {
  render: () => JSXChild;
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

  const appendContent = (content: JSXChild, targetContainer: Node | DocumentFragment) => {
    if (content === undefined || content === null || typeof content === "boolean")
      return;

    const tempContainer = document.createDocumentFragment();
    appendChild(tempContainer, content);
    currentNodes = Array.from(tempContainer.childNodes);
    targetContainer.insertBefore(tempContainer, anchor.nextSibling);
  };

  try {
    appendContent(props.render(), fragment);
    isInitialRender = false;
  } catch (err) {
    clearCurrentNodes();
    const error = err instanceof Error ? err : new Error(String(err));
    const container = isInitialRender ? fragment : anchor.parentNode;
    if (container) {
      appendContent(props.fallback(error), container);
    }
  }

  return fragment;
}
