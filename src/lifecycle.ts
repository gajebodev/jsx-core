type LifecycleCleanup = () => void;
type LifecycleMountCallback = () => void | LifecycleCleanup;
type LifecycleUnmountCallback = () => void;

interface LifecycleCollector {
  mountCallbacks: LifecycleMountCallback[];
  unmountCallbacks: LifecycleUnmountCallback[];
}

interface LifecycleEntry {
  targets: Set<Node>;
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
    const entry = tracked.__lifecycle_entry__;
    if (entry) {
      if (isConnecting) {
        fireMount(entry);
      } else {
        entry.targets.delete(node);
        delete tracked.__lifecycle_entry__; // GC cleanup

        const stillConnected = Array.from(entry.targets).some((t) => t.isConnected);
        if (!stillConnected) fireUnmount(entry);
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
  if (collector.mountCallbacks.length === 0 && collector.unmountCallbacks.length === 0)
    return;

  const targets =
    node.nodeType === Node.DOCUMENT_FRAGMENT_NODE
      ? new Set(Array.from(node.childNodes))
      : new Set([node]);

  const entry: LifecycleEntry = {
    targets,
    mounted: false,
    unmounted: false,
    mountCallbacks: [...collector.mountCallbacks],
    unmountCallbacks: [...collector.unmountCallbacks]
  };

  for (const target of targets) {
    (target as TrackedNode).__lifecycle_entry__ = entry;
  }

  ensureLifecycleObserver();

  // Microtask check: if elements are inserted synchronously into the live document, mount immediately
  queueMicrotask(() => {
    if (node.isConnected) {
      fireMount(entry);
      return;
    }

    for (const target of entry.targets) {
      if (target.isConnected) {
        fireMount(entry);
        break;
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
