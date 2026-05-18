# SPA Library

A lightweight, framework-agnostic library for building Single Page Applications. No React or Vue dependencies required.

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
import { createStore, bindStoreText } from '@gajebodev/jsx-core';

const appStore = createStore({
  count: 0,
  name: 'App',
});

// Subscribe to changes
const unsubscribe = appStore.subscribe((state) => {
  console.log('Store updated:', state);
});

// Update state
appStore.setState({ count: 1 });
appStore.setState((prev) => ({ count: prev.count + 1 }));

// Bind to DOM
bindStoreText(appStore, (state) => `Count: ${state.count}`, element);
```

### Class Names

```typescript
import { cx } from '@gajebodev/jsx-core';

const buttonClass = cx(
  'btn',
  isPrimary && 'btn-primary',
  isDisabled && 'btn-disabled'
);
```

### Virtual List

Efficiently render large lists (1000+ items) with minimal performance impact. Only renders visible items. Supports both fixed-height and variable-height items.

```typescript
import { createVirtualList } from '@gajebodev/jsx-core';

// Fixed-height items (fastest)
const fixedList = createVirtualList({
  items: Array.from({ length: 10000 }, (_, i) => ({ id: i })),
  itemHeight: 50,           // Fixed height
  containerHeight: 400,
  renderItem: (item) => {
    const div = document.createElement('div');
    div.textContent = `Item ${item.id}`;
    return div;
  }
});

document.getElementById('list-container')!.appendChild(fixedList.el);
fixedList.scrollToIndex(500);
fixedList.updateItems(newItems);
```

**Performance:**
- ✅ 10,000 items: 60fps scrolling
- ✅ Only ~20-25 DOM nodes at a time
- ✅ Smooth scrolling with overscan buffer

### Table

Simple, efficient table rendering with sorting, pagination, striping, and hover effects.

```typescript
import { createTable, createStyledText } from '@gajebodev/jsx-core';

interface User {
  id: number;
  name: string;
  email: string;
  status: string;
}

const users: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' },
  { id: 2, name: 'Bob', email: 'bob@example.com', status: 'inactive' },
  // ... more users
];

const table = createTable({
  columns: [
    { key: 'name', label: 'Name', width: '30%', sortable: true },
    { key: 'email', label: 'Email', width: '40%', sortable: true },
    {
      key: 'status',
      label: 'Status',
      width: '30%',
      sortable: true,
      render: (value) => {
        const color = value === 'active' ? 'green' : 'red';
        return createStyledText(String(value), `color: ${color};`);
      }
    }
  ],
  data: users,
  striped: true,
  hoverable: true,
  sortable: true,
  keyField: 'id',
  pageSize: 10,                      // Default rows per page
  pageSizes: [5, 10, 15, 25, 50],    // Options for rows per page selector
  showPagination: true,              // Show pagination controls
  onRowClick: (item) => console.log('Clicked:', item)
});

document.getElementById('table-container')!.appendChild(table.el);

// API
table.updateData(newUsers);
table.setSortKey('name', 'asc');
table.setPage(2);
table.getPage();              // Returns current page number
table.getTotalPages();        // Returns total page count
table.setPageSize(25);        // Change rows per page
```

**Rendering Content Safely:**

The table supports three rendering approaches:

1. **Simple Text** (automatically escaped):
```typescript
render: (value) => String(value)  // Returns string - safe
```

2. **Styled Text** (using helper):
```typescript
import { createStyledText } from '@gajebodev/jsx-core';

render: (value) => createStyledText(value, 'color: blue; font-weight: 600;')
```

3. **Custom DOM Elements** (for complex content):
```typescript
render: (value, item) => {
  const div = document.createElement('div');
  div.textContent = value;
  return div;
}
```

**Security Note:** The table component does NOT use `innerHTML` for security. All string content is properly escaped using `textContent`. Use `createStyledText` helper or return DOM nodes for styled content.

**Features:**
- ✅ Click headers to sort
- ✅ Pagination with configurable page sizes: `[5, 10, 15, 25, 50, 100]`
- ✅ Striped rows for readability
- ✅ Hover effects
- ✅ Custom cell rendering (safe - no innerHTML)
- ✅ Row click events
- ✅ Programmatic sorting & pagination
- ✅ Item counter (e.g., "1-10 of 50")
- ✅ Navigate by page number input
- ✅ Supports components and DOM nodes

## License

[MIT](https://github.com/gajebodev/jsx-core/blob/main/LICENSE.md)
