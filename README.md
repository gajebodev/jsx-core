# @gajebodev/jsx-core

A lightweight, high-performance **Direct-to-DOM, Single-Execution Structural Runtime** for building Single Page Applications.

Unlike traditional Virtual DOM frameworks (like React), components in this architecture behave as structural setup factories that **execute exactly once**. Fine-grained reactivity maps mutations straight to live DOM nodes in $O(1)$ constant time using native JavaScript Proxies and an active `MutationObserver` background lifecycle engine.

> ⚠️ **Note on Scope**: This library is an independent, lightweight project designed for educational use, micro-frontends, or ultra-minimal web applications. It is **not** intended to replace production-grade ecosystems like ReactJS or SolidJS.

## Features

- 🚀 **Single-Execution Components**: Functions evaluate exactly once on setup. No re-rendering overhead.
- 🧬 **Mutation-Driven Lifecycles**: `useMount` and `useUnmount` connect natively to browser insertions/removals via a background `MutationObserver`.
- 🔄 **Deep Proxy Reactivity**: Track nested properties and index alterations cleanly using an optimized, cached `useReactive` proxy framework.
- 🎛️ **Streamlined State Controllers**: Handle controlled/uncontrolled patterns elegantly with `useReactiveValue`.
- 🦥 **Declarative Structural Views**: Dynamic conditional branches (`<Show>`) and array index managers (`<For>`) prevent DOM tree flickering.

## Installation

```bash
npm install @gajebodev/jsx-core
```

Configure your compilation pipeline by modifying your **`tsconfig.json`** to delegate element generation directly to this custom automatic transform:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@gajebodev/jsx-core"
  }
}
```

## Core Ecosystem Guides

### 1. Component Lifecycles (`useMount` / `useUnmount`)

Because elements are inserted dynamically without framework reconciliation passes, lifecycles hook straight into real DOM tree status modifications:

```tsx
import { useMount, useUnmount } from "@gajebodev/jsx-core";

export function ProfileBadge() {
  useMount(() => {
    console.log("Component node added to the live DOM tree");
  });

  useUnmount(() => {
    console.log("Component node scrubbed from document layout");
  });

  return <section class="badge">Profile Ready</section>;
}
```

### 2. Fine-Grained Reactive Proxies (`useReactive` / `useReactiveEffect`)

Manage deep-state data tracking using paths. Bind changes to specific element references to alter text or attributes without re-running the component function:

```tsx
import { useReactive, useReactiveEffect } from "@gajebodev/jsx-core";

export function Counter() {
  // 1. Initialize a tracked proxy map
  const state = useReactive({
    metrics: { count: 0 }
  });

  const textRef = { current: null as HTMLElement | null };

  // 2. Explicit side-effect target updates point to a specific string path
  useReactiveEffect(
    (nextCount) => {
      if (textRef.current) {
        textRef.current.textContent = `Value: ${nextCount}`;
      }
    },
    [state, "metrics.count"]
  );

  return (
    <div class="card">
      <span ref={textRef}>Loading...</span>
      <button onClick={() => state.metrics.count++}>+</button>
    </div>
  );
}
```

### 3. Controllable State Strategist (`useReactiveValue`)

Abstract component wrapper APIs cleanly, allowing components to run under parent controlled states or fall back to internal tracking proxies seamlessly:

```tsx
import { useReactiveValue, useReactiveEffect } from "@gajebodev/jsx-core";

interface ToggleProps {
  value?: boolean;
}

export function ToggleSwitch(props: ToggleProps) {
  // Streamlined options interface handles fallback configuration
  const [state, setState] = useReactiveValue(props, {
    defaultValue: false,
    onChange: (newValue) => console.log("State shifted to:", newValue)
  });

  const btnRef = { current: null as HTMLButtonElement | null };

  useReactiveEffect(
    (isChecked) => {
      if (btnRef.current) {
        btnRef.current.textContent = isChecked ? "ACTIVE" : "DISABLED";
      }
    },
    [state, "value"]
  );

  return (
    <button ref={btnRef} onClick={() => setState((prev) => !prev)}>
      Processing...
    </button>
  );
}
```

### 4. Publisher Micro-Stores (`createStore` / `$text`)

For global pub/sub variables or declarative micro-stores, leverage high-performance structural publishers paired with inline child evaluation text nodes:

```tsx
import { createStore, \$text } from "@gajebodev/jsx-core";

// Create a globally accessible subscription-based warehouse store
export const configStore = createStore({
  theme: "dark",
  user: "Guest"
});

export function Sidebar() {
  return (
    <aside class="panel">
      {/* Declarative Text Node Binder updates natively, skipping component reruns */}
      <h3>Welcome, {\$text(configStore, (s) => s.user)}</h3>

      <button onClick={() => configStore.setState({ user: "Admin" })}>
        Elevate Permissions
      </button>
    </aside>
  );
}
```

### 5. Conditional Structural Layouts (`<Show>`)

Toggle entire structural DOM trees layout branches on or off using active template containers:

```tsx
import { useReactive } from "@gajebodev/jsx-core";
import { Show } from "@gajebodev/jsx-core/show";

export function AdminGuard() {
  const session = useReactive({ user: { isAuthorized: false } });

  return (
    <main class="viewport">
      <button
        onClick={() => (session.user.isAuthorized = !session.user.isAuthorized)}
      >
        Toggle Authorization
      </button>

      {/* Conditionally attaches or detaches nodes from the live DOM tree */}
      <Show
        when={[session, "user.isAuthorized"]}
        fallback={
          <p class="error">⛔ Access Denied. Authorization Required.</p>
        }
      >
        <div class="secure-panel">
          <h2>🔒 Administrative Dashboard</h2>
        </div>
      </Show>
    </main>
  );
}
```

### 6. High-Performance Structural Loops (`<For>`)

Render large array structures efficiently. The loop manager monitors structural size modifications, appending or slicing trailing wrappers, while cell changes map directly to internal row elements via text child paths:

```tsx
import { useReactive, useReactiveEffect } from "@gajebodev/jsx-core";
import { For } from "@gajebodev/jsx-core/for";

function TodoRow({ store, itemPath }: { store: any; itemPath: string }) {
  const spanRef = { current: null as HTMLSpanElement | null };

  // Localized path binding makes row field shifts execute in fast constant time
  useReactiveEffect(
    (textValue) => {
      if (spanRef.current) spanRef.current.textContent = String(textValue);
    },
    [store, `${itemPath}.text`]
  );

  return (
    <li class="row">
      <span ref={spanRef}>Loading...</span>
    </li>
  );
}

export function TodoApp() {
  const store = useReactive({
    todos: [{ id: 1, text: "Configure package bundler paths" }]
  });

  return (
    <div class="box">
      <button
        onClick={() => store.todos.push({ id: Date.now(), text: "New Task" })}
      >
        Add Task
      </button>

      <ul>
        <For each={[store, "todos"]}>
          {(itemPath) => <TodoRow store={store} itemPath={itemPath} />}
        </For>
      </ul>
    </div>
  );
}
```

## Additional Framework Utilities

### Client-Side App Routing

```typescript
import { createRouter } from '@gajebodev/jsx-core';

const router = createRouter([
  {
    path: '/dashboard',
    component: () => import('./pages/dashboard'),
  },
  {
    path: '/item/:id',
    component: () => import('./pages/item'),
    loader: ({ params }) => fetch(`/api/items/${params.id}`),
  }
], {
  notFound: () => <div class="err-404">Layout Location Missing</div>
});

router.mount(document.getElementById('root')!);
```

### Atomic Conditional Classes (`cx`)

```typescript
import { cx } from "@gajebodev/jsx-core";

const alertStyles = cx(
  "alert-toast",
  isUrgent && "theme-danger",
  hasTransitioned && "motion-fade"
);
```

## License

[MIT](https://github.com/gajebodev/jsx-core/blob/main/LICENSE.md)
