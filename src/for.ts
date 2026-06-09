import { useReactiveEffect, ReactiveStore, Path } from "./reactive";

interface ForProps<T extends Record<string, any>, P extends Path<T>> {
  each: [ReactiveStore<T>, P];
  children: (itemPath: string, index: number) => Node;
}

export function For<T extends Record<string, any>, P extends Path<T>>({
  each,
  children
}: ForProps<T, P>): Node {
  const anchor = document.createComment("for-boundary");
  const fragment = document.createDocumentFragment();
  fragment.appendChild(anchor);

  let renderedNodes: Node[] = [];

  const [, targetPath] = each;

  useReactiveEffect((currentArray: any) => {
    if (!anchor.parentNode) return;

    const list = Array.isArray(currentArray) ? currentArray : [];
    const nextNodes: Node[] = [];
    const listLen = list.length;
    const renderedLen = renderedNodes.length;

    for (let i = 0; i < listLen; i++) {
      if (i < renderedLen) {
        nextNodes.push(renderedNodes[i]);
      } else {
        const rowPath = `${targetPath}.${i}`;
        const rowNode = children(rowPath, i);

        nextNodes.push(rowNode);
        anchor.parentNode.insertBefore(rowNode, anchor);
      }
    }

    if (renderedLen > listLen) {
      for (let i = listLen; i < renderedLen; i++) {
        renderedNodes[i].parentNode?.removeChild(renderedNodes[i]);
      }
    }

    renderedNodes = nextNodes;
  }, each);

  return fragment;
}
