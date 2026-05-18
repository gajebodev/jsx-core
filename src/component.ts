type Unmount = () => void;

interface ComponentContext {
  hooks: unknown[];
  hookIndex: number;
  rerender: () => void;
}

let activeContext: ComponentContext | null = null;

export function useState<T>(initial: T | (() => T)) {
  if (!activeContext) {
    throw new Error("useState must run inside createComponent render function");
  }

  const context = activeContext;
  const i = context.hookIndex;

  if (context.hooks[i] === undefined) {
    context.hooks[i] = typeof initial === "function" ? (initial as () => T)() : initial;
  }

  const setState = (next: T | ((prev: T) => T)) => {
    const prev = context.hooks[i] as T;
    context.hooks[i] = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
    context.rerender();
  };

  context.hookIndex += 1;
  return [context.hooks[i] as T, setState] as const;
}

export function createComponent(
  render: (ctx: { rerender: () => void }) => Node,
  onUnmount?: Unmount
) {
  const context: ComponentContext = {
    hooks: [],
    hookIndex: 0,
    rerender: () => {}
  };

  const host = document.createElement("div");
  host.dataset.component = "host";

  const rerender = () => {
    context.hookIndex = 0;
    activeContext = context;
    const nextRoot = render({ rerender });
    activeContext = null;

    host.replaceChildren(nextRoot);
  };

  context.rerender = rerender;
  rerender();

  return {
    el: host,
    unmount: () => {
      onUnmount?.();
      host.replaceChildren();
    }
  };
}
