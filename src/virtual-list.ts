/**
 * Virtual List - Efficiently renders large lists by only rendering visible items
 * Perfect for lists with 1000+ items without performance degradation
 * 
 * Supports both fixed-height and variable-height items
 */

export interface VirtualListProps<T> {
  items: T[];
  containerHeight: number;
  renderItem: (item: T, index: number) => Node;
  overscan?: number; // Extra items to render outside viewport (default: 3)
  itemHeight?: number; // For fixed height items - if not provided, measures dynamically
}

interface VirtualListState {
  scrollTop: number;
  containerHeight: number;
  itemHeights: Map<number, number>; // Cache of measured item heights
}

export function createVirtualList<T>(props: VirtualListProps<T>) {
  const overscan = props.overscan ?? 3;
  const isFixedHeight = props.itemHeight !== undefined;
  const state: VirtualListState = {
    scrollTop: 0,
    containerHeight: props.containerHeight,
    itemHeights: new Map()
  };

  const container = document.createElement("div");
  container.style.height = `${props.containerHeight}px`;
  container.style.overflow = "auto";
  container.style.position = "relative";

  const content = document.createElement("div");
  content.style.position = "relative";

  const visibleItems = new Map<number, Node>();

  const getItemHeight = (index: number): number => {
    if (isFixedHeight) {
      return props.itemHeight!;
    }
    return state.itemHeights.get(index) ?? 50; // Default estimate
  };

  const measureItemHeight = (index: number, node: Node): number => {
    const height = (node as HTMLElement).offsetHeight || 50;
    state.itemHeights.set(index, height);
    return height;
  };

  const getTotalHeight = (): number => {
    if (isFixedHeight) {
      return props.items.length * props.itemHeight!;
    }
    let total = 0;
    for (let i = 0; i < props.items.length; i++) {
      total += getItemHeight(i);
    }
    return total;
  };

  const getOffsetForIndex = (index: number): number => {
    if (isFixedHeight) {
      return index * props.itemHeight!;
    }
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i);
    }
    return offset;
  };

  const calculateVisibleRange = () => {
    const scrollTop = state.scrollTop;
    const containerHeight = state.containerHeight;
    let accumulatedHeight = 0;
    let startIndex = 0;
    let endIndex = 0;

    // Find start index
    for (let i = 0; i < props.items.length; i++) {
      const itemHeight = getItemHeight(i);
      if (accumulatedHeight + itemHeight > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
      accumulatedHeight += itemHeight;
    }

    // Find end index
    accumulatedHeight = getOffsetForIndex(startIndex);
    for (let i = startIndex; i < props.items.length; i++) {
      accumulatedHeight += getItemHeight(i);
      endIndex = i;
      if (accumulatedHeight > scrollTop + containerHeight) {
        endIndex = Math.min(props.items.length - 1, i + overscan);
        break;
      }
    }

    return { startIndex, endIndex: endIndex + 1 };
  };

  const renderVisibleItems = () => {
    const { startIndex, endIndex } = calculateVisibleRange();

    // Remove items outside viewport
    for (const [index, node] of visibleItems) {
      if (index < startIndex || index >= endIndex) {
        (node as any).parentNode?.removeChild(node);
        visibleItems.delete(index);
      }
    }

    // Add new visible items
    for (let i = startIndex; i < endIndex; i++) {
      if (!visibleItems.has(i)) {
        const itemContainer = document.createElement("div");
        itemContainer.style.position = "absolute";
        itemContainer.style.top = `${getOffsetForIndex(i)}px`;
        itemContainer.style.width = "100%";

        const itemNode = props.renderItem(props.items[i], i);
        itemContainer.appendChild(itemNode);
        content.appendChild(itemContainer);

        // Measure height if dynamic
        if (!isFixedHeight) {
          requestAnimationFrame(() => {
            const height = measureItemHeight(i, itemNode);
            itemContainer.style.height = `${height}px`;
            updateTotalHeight();
          });
        } else {
          itemContainer.style.height = `${props.itemHeight}px`;
        }

        visibleItems.set(i, itemContainer);
      }
    }
  };

  const updateTotalHeight = () => {
    content.style.height = `${getTotalHeight()}px`;
  };

  const onScroll = () => {
    state.scrollTop = container.scrollTop;
    renderVisibleItems();
  };

  container.appendChild(content);
  container.addEventListener("scroll", onScroll);

  updateTotalHeight();
  renderVisibleItems();

  return {
    el: container,
    updateItems(newItems: T[]) {
      props.items = newItems;
      if (!isFixedHeight) {
        state.itemHeights.clear();
      }
      visibleItems.forEach((node) => {
        (node as any).parentNode?.removeChild(node);
      });
      visibleItems.clear();
      updateTotalHeight();
      renderVisibleItems();
    },
    scrollToIndex(index: number) {
      const offset = getOffsetForIndex(index);
      container.scrollTop = Math.max(0, offset - state.containerHeight / 2);
      renderVisibleItems();
    },
    scrollToTop() {
      container.scrollTop = 0;
    },
    destroy() {
      container.removeEventListener("scroll", onScroll);
      visibleItems.forEach((node) => {
        (node as any).parentNode?.removeChild(node);
      });
      visibleItems.clear();
      content.parentNode?.removeChild(content);
    }
  };
}
