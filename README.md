# @gajebodev/jsx-core

A lightweight, framework-agnostic library for building Single Page Applications.

No React or Vue dependencies required.

## Features

- **Component System**: Simple hooks-based component creation with `useState` and `createComponent`
- **Router**: Lightweight client-side router with lazy loading and route parameters
- **Store**: Simple reactive store pattern with subscriptions
- **JSX Runtime**: Custom JSX runtime for element creation
- **Utilities**: Class name utility (`cx`) for conditional styling

## Installation

```bash
npm install @gajebodev/jsx-core
```

Use the runtime by setting `jsxImportSource` to `@gajebodev/jsx-core` in tsconfig.json.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@gajebodev/jsx-core"
  }
}
```

## Usage

### Components

```typescript
import { createComponent, useState } from '@gajebodev/jsx-core';

const Counter = createComponent(({ rerender }) => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
});
```

### Router

```typescript
import { createRouter } from '@gajebodev/jsx-core';

const router = createRouter(
  [
    {
      path: '/home',
      component: () => import('./pages/home'),
    },
    {
      path: '/user/:id',
      component: () => import('./pages/user'),
      loader: ({ params }) => fetch(`/api/user/${params.id}`),
    },
  ],
  {
    notFound: () => <div>Not Found</div>,
  }
);

router.mount(document.getElementById('outlet')!);
```

### Store

```typescript
import { createStore, bindStoreText } from "@gajebodev/jsx-core";

const appStore = createStore({
  count: 0,
  name: "App",
});

// Subscribe to changes
const unsubscribe = appStore.subscribe((state) => {
  console.log("Store updated:", state);
});

// Update state
appStore.setState({ count: 1 });
appStore.setState((prev) => ({ count: prev.count + 1 }));

// Bind to DOM
bindStoreText(appStore, (state) => `Count: ${state.count}`, element);
```

### Class Names

```typescript
import { cx } from "@gajebodev/jsx-core";

const buttonClass = cx(
  "btn",
  isPrimary && "btn-primary",
  isDisabled && "btn-disabled",
);
```

## License

[MIT](https://github.com/gajebodev/jsx-core/blob/main/LICENSE.md)
