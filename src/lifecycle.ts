type LifecycleCleanup = () => void;
type LifecycleMountCallback = () => void | LifecycleCleanup;
type LifecycleUnmountCallback = () => void;

interface LifecycleCollector {
  mountCallbacks: LifecycleMountCallback[];
  unmountCallbacks: LifecycleUnmountCallback[];
}

interface LifecycleEntry {
  mounted: boolean;
  unmounted: boolean;
  mountCallbacks: LifecycleMountCallback[];
  unmountCallbacks: LifecycleUnmountCallback[];
}

// Extend native Node interface to hold a safe internal reference
interface TrackedNode extends Node {
  __lifecycle_entry__?: LifecycleEntry;
}

let activeLifecycleCollector: LifecycleCollector | null = null;
let lifecycleObserver: MutationObserver | null = null;

function fireMount(entry: LifecycleEntry) {
  if (entry.mounted || entry.unmounted) return;
  entry.mounted = true;
  for (const callback of entry.mountCallbacks) {
    const cleanup = callback();
    if (typeof cleanup === "function") {
      entry.unmountCallbacks.push(cleanup);
    }
  }
}

function fireUnmount(entry: LifecycleEntry) {
  if (entry.unmounted) return;
  entry.unmounted = true;
  for (const callback of entry.unmountCallbacks) {
    callback();
  }
}

// Recursively processes nodes and checks for attached lifecycle targets
function processDomChanges(nodes: NodeList, isConnecting: boolean) {
  for (const node of Array.from(nodes)) {
    const tracked = node as TrackedNode;

    if (tracked.__lifecycle_entry__) {
      if (isConnecting) {
        fireMount(tracked.__lifecycle_entry__);
      } else {
        fireUnmount(tracked.__lifecycle_entry__);
        delete tracked.__lifecycle_entry__; // GC cleanup
      }
    }

    // Traverses nested DOM trees for deep additions/removals
    if (node.childNodes.length > 0) {
      processDomChanges(node.childNodes, isConnecting);
    }
  }
}

function ensureLifecycleObserver() {
  if (
    lifecycleObserver ||
    typeof document === "undefined" ||
    typeof MutationObserver === "undefined"
  )
    return;
  const root = document.documentElement;
  if (!root) return;

  lifecycleObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.removedNodes.length > 0) {
        processDomChanges(mutation.removedNodes, false);
      }
      if (mutation.addedNodes.length > 0) {
        processDomChanges(mutation.addedNodes, true);
      }
    }
  });

  lifecycleObserver.observe(root, { childList: true, subtree: true });
}

function registerLifecycle(node: Node, collector: LifecycleCollector) {
  if (
    collector.mountCallbacks.length === 0 &&
    collector.unmountCallbacks.length === 0
  )
    return;

  const entry: LifecycleEntry = {
    mounted: false,
    unmounted: false,
    mountCallbacks: [...collector.mountCallbacks],
    unmountCallbacks: [...collector.unmountCallbacks]
  };

  // If it's a DocumentFragment, assign the entry to all its direct child nodes
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    for (const child of Array.from(node.childNodes)) {
      (child as TrackedNode).__lifecycle_entry__ = entry;
    }
  } else {
    (node as TrackedNode).__lifecycle_entry__ = entry;
  }

  ensureLifecycleObserver();

  // Microtask check: if elements are inserted synchronously into the live document, mount immediately
  queueMicrotask(() => {
    if (node.isConnected) {
      fireMount(entry);
    } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      // For fragments, verify if their child elements have transitioned safely into the connected DOM
      for (const child of Array.from(node.childNodes)) {
        if (child.isConnected) {
          fireMount(entry);
          break;
        }
      }
    }
  });
}

export function useMount(callback: LifecycleMountCallback) {
  if (!activeLifecycleCollector)
    throw new Error("useMount must run inside a function component");
  activeLifecycleCollector.mountCallbacks.push(callback);
}

export function useUnmount(callback: LifecycleUnmountCallback) {
  if (!activeLifecycleCollector)
    throw new Error("useUnmount must run inside a function component");
  activeLifecycleCollector.unmountCallbacks.push(callback);
}

export function __renderWithLifecycle(render: () => Node) {
  const previousCollector = activeLifecycleCollector;
  const collector: LifecycleCollector = {
    mountCallbacks: [],
    unmountCallbacks: []
  };

  activeLifecycleCollector = collector;
  let node: Node;

  try {
    node = render();
  } finally {
    activeLifecycleCollector = previousCollector;
  }

  registerLifecycle(node, collector);
  return node;
}
