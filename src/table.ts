/**
 * Table Component - Simple, efficient table rendering
 * Supports sorting, column customization, and large datasets
 * Does NOT use innerHTML for security - all content is properly escaped
 */

/**
 * Create a styled text element safely without using innerHTML
 * Useful for render functions that need styled text without security risks
 * @param text - The text content
 * @param style - CSS style string
 * @returns HTML element with text content
 */
export function createStyledText(text: string | number, style: string = ""): HTMLElement {
  const span = document.createElement("span");
  span.textContent = String(text);
  if (style) span.style.cssText = style;
  return span;
}

export interface Column<T> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (value: any, item: T, index: number) => Node | string;
  sortable?: boolean;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  rowHeight?: string;
  striped?: boolean;
  hoverable?: boolean;
  sortable?: boolean;
  onRowClick?: (item: T, index: number) => void;
  pageSize?: number;
  pageSizes?: number[];
  showPagination?: boolean;
  onPageChange?: (page: number, pageSize: number) => void;
}

type SortDirection = "asc" | "desc" | null;

export function createTable<T>(props: TableProps<T>) {
  let sortKey: keyof T | null = null;
  let sortDirection: SortDirection = null;
  let currentPage = 1;
  let pageSize = props.pageSize ?? 10;
  const pageSizes = props.pageSizes ?? [5, 10, 15, 25, 50, 100];

  // Create container for table + pagination
  const container = document.createElement("div");

  const table = document.createElement("table");
  table.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
  `;

  // Create header
  const thead = document.createElement("thead");
  thead.style.cssText = `
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
  `;

  const headerRow = document.createElement("tr");
  props.columns.forEach((col) => {
    const th = document.createElement("th");
    th.style.cssText = `
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid #ddd;
      ${col.width ? `width: ${col.width};` : ""}
      user-select: none;
    `;

    if (props.sortable && col.sortable !== false) {
      th.style.cursor = "pointer";
      th.textContent = col.label;
      
      const indicator = document.createElement("span");
      indicator.textContent = " ⬍";
      indicator.style.cssText = "font-size: 0.8em; color: #999;";
      th.appendChild(indicator);

      th.addEventListener("click", () => {
        sortTable(col.key);
        renderBody();
      });
    } else {
      th.textContent = col.label;
    }

    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create body
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  const sortTable = (key: keyof T) => {
    if (sortKey === key) {
      // Toggle direction
      sortDirection = sortDirection === "asc" ? "desc" : sortDirection === "desc" ? null : "asc";
      if (sortDirection === null) {
        sortKey = null;
      }
    } else {
      sortKey = key;
      sortDirection = "asc";
    }
  };

  const getSortedData = (): T[] => {
    if (!sortKey || !sortDirection) {
      return [...props.data];
    }

    return [...props.data].sort((a, b) => {
      const aVal = a[sortKey!];
      const bVal = b[sortKey!];

      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  const getPagedData = (): T[] => {
    const sortedData = getSortedData();
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  };

  const getTotalPages = (): number => {
    const sortedData = getSortedData();
    return Math.ceil(sortedData.length / pageSize);
  };

  const renderBody = () => {
    tbody.innerHTML = "";
    const pagedData = getPagedData();
    const startIndex = (currentPage - 1) * pageSize;

    pagedData.forEach((item, pageIndex) => {
      const globalIndex = startIndex + pageIndex;
      const tr = document.createElement("tr");
      const bgColor = props.striped ? (pageIndex % 2 === 0 ? "#fff" : "#fafafa") : "#fff";
      tr.style.cssText = `
        background: ${bgColor};
        border-bottom: 1px solid #eee;
        ${props.rowHeight ? `height: ${props.rowHeight};` : ""}
      `;

      if (props.hoverable) {
        tr.style.cursor = "pointer";
        tr.addEventListener("mouseenter", () => {
          tr.style.background = "#f0f0f0";
        });
        tr.addEventListener("mouseleave", () => {
          tr.style.background = bgColor;
        });
      }

      if (props.onRowClick) {
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => props.onRowClick!(item, globalIndex));
      }

      props.columns.forEach((col) => {
        const td = document.createElement("td");
        td.style.cssText = `
          padding: 12px;
          border-bottom: 1px solid #eee;
          ${col.width ? `width: ${col.width};` : ""}
        `;

        const value = item[col.key];
        if (col.render) {
          const rendered = col.render(value, item, globalIndex);
          if (typeof rendered === "string") {
            // Safely set text content - never use innerHTML
            td.textContent = rendered;
          } else {
            // Rendered is a Node/Component
            td.appendChild(rendered);
          }
        } else {
          td.textContent = String(value ?? "");
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    // Update pagination controls
    if (props.showPagination !== false) {
      updatePaginationUI();
    }
  };

  // Create pagination controls
  const paginationContainer = document.createElement("div");
  paginationContainer.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    padding: 12px 0;
    border-top: 1px solid #eee;
    font-size: 13px;
  `;

  const pageInfoDiv = document.createElement("div");
  const pageSizeDiv = document.createElement("div");
  pageSizeDiv.style.cssText = "display: flex; align-items: center; gap: 8px;";

  let prevBtn: HTMLButtonElement | null = null;
  let nextBtn: HTMLButtonElement | null = null;
  let pageInput: HTMLInputElement | null = null;
  let pageLabel: HTMLElement | null = null;

  if (props.showPagination !== false) {
    // Page info
    paginationContainer.appendChild(pageInfoDiv);

    // Page size selector
    const pageSizeLabel = document.createElement("label");
    pageSizeLabel.textContent = "Rows per page: ";
    pageSizeLabel.style.cssText = "display: flex; align-items: center; gap: 8px; cursor: pointer;";

    const pageSizeSelect = document.createElement("select");
    pageSizeSelect.style.cssText = `
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
    `;

    pageSizes.forEach((size) => {
      const option = document.createElement("option");
      option.value = String(size);
      option.textContent = String(size);
      option.selected = size === pageSize;
      pageSizeSelect.appendChild(option);
    });

    pageSizeSelect.addEventListener("change", (e) => {
      pageSize = parseInt((e.target as HTMLSelectElement).value, 10);
      currentPage = 1;
      renderBody();
      props.onPageChange?.(currentPage, pageSize);
    });

    pageSizeLabel.appendChild(pageSizeSelect);
    pageSizeDiv.appendChild(pageSizeLabel);

    // Navigation buttons
    const navDiv = document.createElement("div");
    navDiv.style.cssText = "display: flex; gap: 4px;";

    const createNavBtn = (label: string, onClick: () => void) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.style.cssText = `
        padding: 4px 12px;
        border: 1px solid #ddd;
        background: #fff;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      `;
      btn.addEventListener("click", onClick);
      btn.addEventListener("mouseenter", () => {
        btn.style.background = "#f5f5f5";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "#fff";
      });
      return btn;
    };

    prevBtn = createNavBtn("← Prev", () => {
      if (currentPage > 1) {
        currentPage--;
        renderBody();
        props.onPageChange?.(currentPage, pageSize);
      }
    });

    nextBtn = createNavBtn("Next →", () => {
      if (currentPage < getTotalPages()) {
        currentPage++;
        renderBody();
        props.onPageChange?.(currentPage, pageSize);
      }
    });

    pageInput = document.createElement("input");
    pageInput.type = "number";
    pageInput.min = "1";
    pageInput.style.cssText = `
      width: 50px;
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
      text-align: center;
    `;
    pageInput.addEventListener("change", () => {
      if (!pageInput) return;
      const page = parseInt(pageInput.value, 10);
      const totalPages = getTotalPages();
      if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderBody();
        props.onPageChange?.(currentPage, pageSize);
      } else {
        pageInput.value = String(currentPage);
      }
    });

    pageLabel = document.createElement("span");

    navDiv.appendChild(prevBtn);
    navDiv.appendChild(pageInput);
    navDiv.appendChild(pageLabel);
    navDiv.appendChild(nextBtn);

    pageSizeDiv.appendChild(navDiv);
    paginationContainer.appendChild(pageSizeDiv);
  }

  const updatePaginationUI = () => {
    if (props.showPagination === false || !prevBtn || !nextBtn || !pageInput || !pageLabel) {
      return;
    }
    const totalPages = getTotalPages();
    const totalItems = getSortedData().length;
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);
    pageInfoDiv.textContent = `${startItem}-${endItem} of ${totalItems}`;
    pageInput.value = String(currentPage);
    pageInput.max = String(totalPages);
    pageLabel.textContent = `of ${totalPages}`;
    prevBtn.style.opacity = currentPage <= 1 ? "0.5" : "1";
    prevBtn.style.cursor = currentPage <= 1 ? "not-allowed" : "pointer";
    nextBtn.style.opacity = currentPage >= totalPages ? "0.5" : "1";
    nextBtn.style.cursor = currentPage >= totalPages ? "not-allowed" : "pointer";
  };

  container.appendChild(table);
  if (props.showPagination !== false) {
    container.appendChild(paginationContainer);
  }

  renderBody();

  return {
    el: container,
    updateData(newData: T[]) {
      props.data = newData;
      currentPage = 1;
      renderBody();
    },
    setSortKey(key: keyof T | null, direction: SortDirection = null) {
      sortKey = key;
      sortDirection = direction;
      currentPage = 1;
      renderBody();
    },
    getSortState() {
      return { key: sortKey, direction: sortDirection };
    },
    setPage(page: number) {
      const totalPages = getTotalPages();
      if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderBody();
      }
    },
    getPage() {
      return currentPage;
    },
    getTotalPages() {
      return getTotalPages();
    },
    setPageSize(size: number) {
      if (pageSizes.includes(size)) {
        pageSize = size;
        currentPage = 1;
        renderBody();
      }
    }
  };
}
