type Params = Record<string, string>;

export interface RouteContext<TData = unknown> {
  params: Params;
  path: string;
  data: TData;
}

export interface RouteConfig<TData = unknown> {
  path: string;
  name?: string;
  loader?: (ctx: { params: Params; path: string }) => Promise<TData> | TData;
  component: () => Promise<{
    default: (ctx: RouteContext<TData>) => Node | Promise<Node>;
  }>;
}

interface RouterOptions {
  notFound: () => Node;
  onRouteChange?: (state: { loading: boolean; path: string; name?: string }) => void;
}

function parseParams(template: string, actual: string): Params | null {
  const templateParts = template.split("/").filter(Boolean);
  const actualParts = actual.split("/").filter(Boolean);

  if (templateParts.length !== actualParts.length) {
    return null;
  }

  const params: Params = {};

  for (let i = 0; i < templateParts.length; i += 1) {
    const t = templateParts[i];
    const a = actualParts[i];

    if (t.startsWith(":")) {
      params[t.slice(1)] = decodeURIComponent(a);
      continue;
    }

    if (t !== a) {
      return null;
    }
  }

  return params;
}

export function createRouter(routes: RouteConfig<any>[], options: RouterOptions) {
  let outlet: HTMLElement | null = null;

  const findRoute = (path: string) => {
    for (const route of routes) {
      const params = parseParams(route.path, path);
      if (params) {
        return { route, params };
      }
    }

    return null;
  };

  const renderRoute = async () => {
    if (!outlet) return;

    const path = window.location.pathname;
    const matched = findRoute(path);

    if (!matched) {
      outlet.replaceChildren(options.notFound());
      return;
    }

    const { route, params } = matched;

    options.onRouteChange?.({ loading: true, path: route.path, name: route.name });

    const data = route.loader ? await route.loader({ params, path }) : undefined;
    const module = await route.component();
    const view = await module.default({ params, path, data });

    outlet.replaceChildren(view);

    options.onRouteChange?.({ loading: false, path: route.path, name: route.name });
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest<HTMLAnchorElement>("a[data-link]");

    if (!anchor || !anchor.href) {
      return;
    }

    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) {
      return;
    }

    event.preventDefault();
    if (url.pathname !== window.location.pathname) {
      history.pushState({}, "", url.pathname);
      void renderRoute();
    }
  };

  const onPop = () => {
    void renderRoute();
  };

  return {
    mount(target: HTMLElement) {
      outlet = target;
      document.addEventListener("click", onClick);
      window.addEventListener("popstate", onPop);
      void renderRoute();
    },
    navigate(path: string) {
      history.pushState({}, "", path);
      void renderRoute();
    },
    refresh() {
      void renderRoute();
    },
    routes
  };
}
