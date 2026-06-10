import { type JSXChild, appendChild } from "./jsx-runtime";
import { useReactiveEffect, ReactiveStore, Path, PathValue } from "./reactive";

interface ForProps<T extends Record<string, any>, P extends Path<T>> {
  each: [ReactiveStore<T>, P];
  key: (item: PathValue<T, P>[number]) => unknown;
  render: (itemPath: string, index: number) => JSXChild;
}

interface KeyedItemEntry {
  key: unknown;
  nodes: Node[];
}

export function For<T extends Record<string, any>, P extends Path<T>>({
  each,
  key: keyExtractor,
  render
}: ForProps<T, P>): Node {
  const anchor = document.createComment("for-boundary");
  const fragment = document.createDocumentFragment();
  fragment.appendChild(anchor);

  let renderedItems: KeyedItemEntry[] = [];
  let isInitialRender = true;
  const [, targetPath] = each;

  useReactiveEffect((currentArray: any) => {
    const list = Array.isArray(currentArray) ? currentArray : [];
    const listLen = list.length;

    const parentContainer = isInitialRender ? fragment : anchor.parentNode;
    if (!parentContainer) return;

    // Create maps to track and recycle previous items by key
    const oldItemMap = new Map<unknown, KeyedItemEntry>();
    for (const item of renderedItems) {
      oldItemMap.set(item.key, item);
    }

    const nextItems: KeyedItemEntry[] = [];
    let insertBeforeTarget: Node | null = anchor.nextSibling;

    // First Pass: Match keys, re-index paths, and move/insert DOM elements
    for (let i = 0; i < listLen; i++) {
      const itemData = list[i];
      const currentKey = keyExtractor(itemData);
      const existingItem = oldItemMap.get(currentKey);

      if (existingItem) {
        // MATCH FOUND: Recycle the existing DOM nodes
        nextItems.push(existingItem);
        oldItemMap.delete(currentKey); // Remove from deletion pool

        // Move the nodes to the correct position if they shifted orders
        for (const node of existingItem.nodes) {
          if (node.nextSibling !== insertBeforeTarget) {
            parentContainer.insertBefore(node, insertBeforeTarget);
          }
        }

        if (existingItem.nodes.length > 0) {
          insertBeforeTarget = existingItem.nodes[existingItem.nodes.length - 1].nextSibling;
        }
      } else {
        // NEW ENTRY: Build fresh nodes using the current index path namespace
        const rowPath = `${targetPath}.${i}`;
        const rowChild = render(rowPath, i);

        const tempContainer = document.createDocumentFragment();
        appendChild(tempContainer, rowChild);

        const itemNodes = Array.from(tempContainer.childNodes);
        nextItems.push({ key: currentKey, nodes: itemNodes });

        parentContainer.insertBefore(tempContainer, insertBeforeTarget);

        if (itemNodes.length > 0) {
          insertBeforeTarget = itemNodes[itemNodes.length - 1].nextSibling;
        }
      }
    }

    // Second Pass: Evict any remaining dead items that left the array
    if (!isInitialRender) {
      oldItemMap.forEach((deadItem) => {
        for (const nodeToRemove of deadItem.nodes) {
          nodeToRemove.parentNode?.removeChild(nodeToRemove);
        }
      });
    }

    // Keep internal tracking structures synced cleanly
    renderedItems = nextItems;
    isInitialRender = false;
  }, each);

  return fragment;
}
