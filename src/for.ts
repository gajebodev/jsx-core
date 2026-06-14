import { type JSXChild, appendChild } from "./jsx-runtime";
import { useReactiveEffect, ReactiveStore, Path } from "./reactive";
import { useUnmount } from "./lifecycle";

interface ForProps<T extends Record<string, any>, P extends Path<T>> {
  each: [ReactiveStore<T>, P];
  version?: unknown;
  render: (itemPath: string, index: number) => JSXChild;
}

export function For<T extends Record<string, any>, P extends Path<T>>({
  each,
  version,
  render
}: ForProps<T, P>): Node {
  const anchor = document.createComment("for-boundary");
  const fragment = document.createDocumentFragment();
  fragment.appendChild(anchor);

  let renderedNodes: Node[][] = [];
  let lastVersion = version;
  const [, targetPath] = each;

  const clearRenderedNodes = () => {
    for (const group of renderedNodes) {
      for (const node of group) node.parentNode?.removeChild(node);
    }
    renderedNodes = [];
  };

  useReactiveEffect((currentArray: any) => {
    if (!anchor.parentNode) return;

    const list = Array.isArray(currentArray) ? currentArray : [];
    const listLen = list.length;
    const renderedLen = renderedNodes.length;

    // Dual-Trigger Reset Condition:
    // - The list size physically changed (pagination, truncation, standard add/delete)
    // - OR the version prop shifted (explicit fresh payload replacement from the server)
    const versionShifted = version !== lastVersion;
    if (listLen !== renderedLen || versionShifted) clearRenderedNodes();

    const nextNodes: Node[][] = [];
    let insertBeforeTarget: Node | null = anchor.nextSibling;
    const currentRenderedLen = renderedNodes.length;

    for (let i = 0; i < listLen; i++) {
      if (i < currentRenderedLen) {
        // Reuse row DOM subtree for direct field modifications (like checking a box)
        nextNodes.push(renderedNodes[i]);
        const group = renderedNodes[i];
        if (group.length > 0) {
          insertBeforeTarget = group[group.length - 1].nextSibling;
        }
      } else {
        // Compile clean, index-synchronized bindings for new data rows
        const rowPath = `${targetPath}.${i}`;
        const rowChild = render(rowPath, i);

        const tempContainer = document.createDocumentFragment();
        appendChild(tempContainer, rowChild);

        const itemNodes = Array.from(tempContainer.childNodes);
        nextNodes.push(itemNodes);

        anchor.parentNode.insertBefore(tempContainer, insertBeforeTarget);

        if (itemNodes.length > 0) {
          insertBeforeTarget = itemNodes[itemNodes.length - 1].nextSibling;
        }
      }
    }

    renderedNodes = nextNodes;
    lastVersion = version;
  }, each);

  useUnmount(() => {
    clearRenderedNodes();
  });

  return fragment;
}
