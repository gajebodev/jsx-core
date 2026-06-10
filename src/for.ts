import { type JSXChild, appendChild } from "./jsx-runtime";
import { useReactiveEffect, ReactiveStore, Path } from "./reactive";

interface ForProps<T extends Record<string, any>, P extends Path<T>> {
  each: [ReactiveStore<T>, P];
  render: (itemPath: string, index: number) => JSXChild;
}

export function For<T extends Record<string, any>, P extends Path<T>>({
  each,
  render
}: ForProps<T, P>): Node {
  const anchor = document.createComment("for-boundary");
  const fragment = document.createDocumentFragment();
  fragment.appendChild(anchor);

  let renderedNodes: Node[][] = [];
  let isInitialRender = true;
  const [, targetPath] = each;

  useReactiveEffect((currentArray: any) => {
    const list = Array.isArray(currentArray) ? currentArray : [];
    const listLen = list.length;
    const renderedLen = renderedNodes.length;

    const parentContainer = isInitialRender ? fragment : anchor.parentNode;
    if (!parentContainer) return;

    const nextNodes: Node[][] = [];

    // Update Existing Nodes & Build New Ones Safely
    for (let i = 0; i < listLen; i++) {
      if (i < renderedLen) {
        nextNodes.push(renderedNodes[i]);
      } else {
        const rowPath = `${targetPath}.${i}`;
        const rowChild = render(rowPath, i);

        const tempContainer = document.createDocumentFragment();
        appendChild(tempContainer, rowChild);

        // Keep the nodes isolated together as an item group
        const itemNodes = Array.from(tempContainer.childNodes);
        nextNodes.push(itemNodes);

        if (isInitialRender) {
          parentContainer.appendChild(tempContainer);
        } else {
          parentContainer.insertBefore(tempContainer, anchor);
        }
      }
    }

    // Clean Up Excess Trailing Items (Array Shrank Pass)
    if (!isInitialRender && renderedLen > listLen) {
      for (let i = listLen; i < renderedLen; i++) {
        // Loop through and delete EVERY node belonging to this specific index group
        const itemNodesToRemove = renderedNodes[i];
        for (const nodeToRemove of itemNodesToRemove) {
          nodeToRemove.parentNode?.removeChild(nodeToRemove);
        }
      }
    }

    // Keep internal tracking structures synced cleanly
    renderedNodes = nextNodes;
    isInitialRender = false;
  }, each);

  return fragment;
}
