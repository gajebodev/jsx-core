import { JSXChild } from "./jsx-runtime";
import { useReactiveEffect, ReactiveStore, Path } from "./reactive";

interface ShowProps<T extends Record<string, any>, P extends Path<T>> {
  when: [ReactiveStore<T>, P];
  fallback?: JSXChild;
  children: JSXChild;
}

export function Show<T extends Record<string, any>, P extends Path<T>>({
  when,
  fallback,
  children
}: ShowProps<T, P>): Node {
  const anchor = document.createComment("show-boundary");
  const fragment = document.createDocumentFragment();
  fragment.appendChild(anchor);

  let currentNodes: Node[] = [];

  const clearCurrentNodes = () => {
    const len = currentNodes.length;
    for (let i = 0; i < len; i++) {
      currentNodes[i].parentNode?.removeChild(currentNodes[i]);
    }
    currentNodes = [];
  };

  const appendContent = (content: JSXChild) => {
    if (content == null || typeof content === "boolean") return;

    const tempContainer = document.createDocumentFragment();
    if (Array.isArray(content)) {
      const len = content.length;
      for (let i = 0; i < len; i++) {
        const nested = content[i];
        if (nested instanceof Node) tempContainer.appendChild(nested);
        else tempContainer.appendChild(document.createTextNode(String(nested)));
      }
    } else if (content instanceof Node) {
      tempContainer.appendChild(content);
    } else {
      tempContainer.appendChild(document.createTextNode(String(content)));
    }

    currentNodes = Array.from(tempContainer.childNodes);
    anchor.parentNode?.insertBefore(tempContainer, anchor);
  };

  useReactiveEffect((conditionMet) => {
    if (!anchor.parentNode) return;

    clearCurrentNodes();

    if (conditionMet) {
      appendContent(children);
    } else if (fallback !== undefined) {
      appendContent(fallback);
    }
  }, when);

  return fragment;
}
