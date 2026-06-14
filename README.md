# @gajebodev/jsx-core

A lightweight, high-performance **Direct-to-DOM, Single-Execution Structural Runtime** for building Single Page Applications.

Unlike traditional Virtual DOM frameworks (like React), components in this architecture behave as structural setup factories that **execute exactly once**. Fine-grained reactivity maps mutations straight to live DOM nodes in $O(1)$ constant time using native JavaScript Proxies and an active `MutationObserver` background lifecycle engine.

> ⚠️ **Note on Scope**: This library is an independent, lightweight project designed for educational use, micro-frontends, or ultra-minimal web applications. It is **not** intended to replace production-grade ecosystems like ReactJS or SolidJS.

## Features

- 🚀 **Single-Execution Components**: Functions evaluate exactly once on setup. No re-rendering overhead.
- 🧬 **Mutation-Driven Lifecycles**: `useMount` and `useUnmount` connect natively to browser insertions/removals via a background `MutationObserver`.
- 🔄 **Deep Proxy Reactivity**: Track nested properties and index alterations cleanly using an optimized, cached `useReactive` proxy framework.
- 🧱 **Structural Control Components**: `For`, and `ErrorBoundary` provide direct-to-DOM control flow without reconciliation.
- 🧭 **Built-In Router and Store Utilities**: `createRouter`, `createStore`, and `$text` cover common SPA needs.
- 🎨 **Lightweight Utilities**: `cx` for conditional class binding, Fragment support, and ref callbacks.

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

## Public API

### Root exports

```ts
import {
  jsx,
  appendChild,
  Fragment,
  useMount,
  useUnmount,
  useReactive,
  useReactiveEffect,
  getReactiveValue,
  $reactive,
  createRouter,
  createStore,
  $text,
  cx
} from "@gajebodev/jsx-core";

// Type exports
import type {
  JSXChild,
  ElementType,
  ReactiveStore,
  ReactiveProp,
  Store,
  RouteContext,
  RouteConfig
} from "@gajebodev/jsx-core";
```

### Subpath exports

```ts
import { For } from "@gajebodev/jsx-core/for";
import { ErrorBoundary } from "@gajebodev/jsx-core/error";
import { jsx as jsxDEV } from "@gajebodev/jsx-core/jsx-dev-runtime";
```

## Core Ecosystem Guides

### Fragment Support

Use `Fragment` to group multiple elements without adding a wrapper DOM node:

```tsx
import { Fragment } from "@gajebodev/jsx-core";

export function Item() {
  return (
    <Fragment>
      <h2>Title</h2>
      <p>Description</p>
    </Fragment>

    // Short Syntax
    <>Footer</>
  );
}
```

### Ref Callbacks and Objects

Both callback refs and ref objects are supported:

```tsx
// Callback ref
const inputRef = (el: HTMLInputElement) => {
  console.log("Input mounted:", el);
};

// Ref object
const buttonRef = { current: null as HTMLButtonElement | null };

export function Form() {
  return (
    <>
      <input ref={inputRef} />
      <button ref={buttonRef}>Click me</button>
    </>
  );
}
```

### Datasets and Attributes

```tsx
<div data-testid="main" aria-label="Main content" dataset={{ userId: 123, role: "admin" }}>
  Content
</div>
```

### Component Lifecycles (`useMount` / `useUnmount`)

Because elements are inserted dynamically without framework reconciliation passes, lifecycles hook straight into real DOM tree status modifications via a background `MutationObserver`:

```tsx
import { useMount, useUnmount } from "@gajebodev/jsx-core";

export function ProfileBadge() {
  useMount(() => {
    console.log("Component node added to the live DOM tree");

    // Lifecycle cleanup is optional—return a function for unmount
    return () => {
      console.log("Cleanup on unmount");
    };
  });

  useUnmount(() => {
    console.log("Component node removed from document layout");
  });

  return <section class="badge">Profile Ready</section>;
}
```

**Key Points for Callbacks:**

- Callbacks in both `useReactiveEffect` and `$reactive` receive dependency values as **spread arguments**
- Single dependency: `callback(value)`
- Multiple dependencies: `callback(value1, value2, ...)`

**Key Points:**

- `useMount` fires once when the element is inserted into the live DOM tree
- `useMount` callback can optionally return a cleanup function that fires on unmount
- `useUnmount` fires when the element is removed from the document
- Unlike React, these are tied to actual DOM mutations, not reconciliation phases

### Fine-Grained Reactive Proxies (`useReactive` / `useReactiveEffect`)

Manage deep-state data tracking using paths. Bind changes to specific element references to alter text or attributes without re-running the component function. The callback receives **spread dependency values** as arguments:

```tsx
import { useReactive, useReactiveEffect } from "@gajebodev/jsx-core";

export function Counter() {
  // 1. Initialize a tracked proxy map
  const state = useReactive({
    metrics: { count: 0 }
  });

  const textRef = { current: null as HTMLElement | null };

  // 2. Callback receives the resolved dependency value(s) as spread arguments
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

**Key Points:**

- Callbacks receive dependency values as **spread arguments**: `(value)` for single, `(value1, value2, ...)` for multiple
- Single dependency example: `useReactiveEffect((count) => {...}, [state, "metrics.count"])`
- Multiple dependency example: `useReactiveEffect((price, tax) => {...}, [[state, "price"], [state, "tax"]])`

### Reactive Computed Bindings (`$reactive`)

Define computed values that automatically update when their dependencies change. These bindings are detected and handled **automatically** when used as JSX props or children:

```tsx
import { useReactive, $reactive } from "@gajebodev/jsx-core";

export function PriceCalculator() {
  const state = useReactive({
    price: 100,
    tax: 0.1
  });

  return (
    <div class="calculator">
      {/* Reactive computed binding as child — updates automatically */}
      <span>
        Total:{" "}
        {$reactive(
          (price, tax) => `$${(price * (1 + tax)).toFixed(2)}`,
          [
            [state, "price"],
            [state, "tax"]
          ]
        )}
      </span>

      {/* Reactive computed binding as prop — updates automatically */}
      <div
        class={$reactive(
          (price) => {
            return price > 150 ? "expensive" : "affordable";
          },
          [state, "price"]
        )}
      >
        Price tier indicator
      </div>

      <button onClick={() => (state.price += 10)}>Add $10</button>
    </div>
  );
}
```

**Key Points:**

- `$reactive` creates a computed binding that is **automatically detected and updated** in props and children
- The compute function receives unwrapped dependency values as **spread arguments**
- Pass dependencies as separate arguments: `$reactive(computeFn, [store, "path1"], [store, "path2"], ...)`
- The binding will re-compute and update the DOM whenever any dependency changes
- No manual `useReactiveEffect` wrapper needed—it's handled transparently by the runtime

### Publisher Micro-Stores (`createStore` / `$text`)

For global pub/sub variables or declarative micro-stores, leverage high-performance structural publishers paired with inline child evaluation text nodes:

```tsx
import { createStore, $text } from "@gajebodev/jsx-core";

// Create a globally accessible subscription-based warehouse store
export const configStore = createStore({
  theme: "dark",
  user: "Guest"
});

export function Sidebar() {
  return (
    <aside class="panel">
      {/* Declarative Text Node Binder updates natively, skipping component reruns */}
      <h3>Welcome, {$text(configStore, (s) => s.user)}</h3>
      <button onClick={() => configStore.setState({ user: "Admin" })}>Elevate Permissions</button>
    </aside>
  );
}
```

## Optional Framework Components

### High-Performance Structural Loops (`<For>`)

Render array structures with stable row DOM reuse for same-length updates, plus deterministic full resets when the list shape changes.

API:

```tsx
<For
  each={[store, "todos"]}
  version={optionalRefreshToken}
  render={(itemPath, index) => <Row itemPath={itemPath} index={index} />}
/>
```

Behavior summary:

- Reuses existing row DOM groups when only inner fields change.
- Fully rebuilds rows when array length changes.
- Can also fully rebuild rows when `version` changes (useful for explicit server payload replacement).

> ⚠️ **Note**: If you reorder items without changing length, bump `version` to force a rebuild (bindings are index/path-based).

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
      <button onClick={() => store.todos.push({ id: Date.now(), text: "New Task" })}>
        Add Task
      </button>

      <ul>
        <For
          each={[store, "todos"]}
          render={(itemPath) => <TodoRow store={store} itemPath={itemPath} />}
        />
      </ul>
    </div>
  );
}
```

`For` provides `(itemPath, index)` through `render`, where `itemPath` maps to the reactive row path (for example, `todos.0`, `todos.1`, ...).

### Error Isolation (`<ErrorBoundary>`)

Catch synchronous render-time errors and switch to a fallback view:

```tsx
import { ErrorBoundary } from "@gajebodev/jsx-core/error";

function CrashingWidget() {
  throw new Error("Widget failed");
}

export function Dashboard() {
  return (
    <ErrorBoundary
      render={() => <CrashingWidget />}
      fallback={(error) => <section class="error-box">Failed to render: {error.message}</section>}
    />
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
    name: 'dashboard',
    component: () => import('./pages/dashboard'),
  },
  {
    path: '/item/:id',
    name: 'item-detail',
    component: () => import('./pages/item'),
    loader: ({ params }) => fetch(`/api/items/${params.id}`),
  }
], {
  notFound: () => <div class="err-404">Layout Location Missing</div>,
  onRouteChange: ({ loading, path, name }) => {
    console.log('route state', { loading, path, name });
  }
});

// Mount router to a DOM element
router.mount(document.getElementById('root')!);

// Programmatic navigation
router.navigate('/item/123');

// Refresh current route
router.refresh();

// Mount router to a DOM element and attaches click handlers for `<a data-link>` elements and popstate listeners
router.mount(document.getElementById('root')!);
```

### Atomic Conditional Classes (`cx`)

```typescript
import { cx } from "@gajebodev/jsx-core";

const alertStyles = cx("alert-toast", isUrgent && "theme-danger", hasTransitioned && "motion-fade");
```

## License

[MIT](https://github.com/gajebodev/jsx-core/blob/main/LICENSE.md)
