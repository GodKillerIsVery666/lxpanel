import { useMemo, useState } from "react";
import type { ReactNode, UIEvent } from "react";
import { readTableColumnPreference, saveTableColumnPreference } from "../utils/preferences.js";

export interface VirtualColumn<Row> {
  id: string;
  header: string;
  cell: (row: Row, rowIndex: number) => ReactNode;
  sortValue?: (row: Row) => string | number | boolean | null | undefined;
  className?: string;
}

type SortDirection = "asc" | "desc";

interface VirtualTableProps<Row> {
  tableId: string;
  rows: Row[];
  columns: Array<VirtualColumn<Row>>;
  getRowKey: (row: Row) => string;
  rowHeight?: number;
  height?: number;
  empty?: ReactNode;
}

export function VirtualTable<Row>({ tableId, rows, columns, getRowKey, rowHeight = 48, height = 420, empty }: VirtualTableProps<Row>): JSX.Element {
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => readTableColumnPreference(tableId, columnIds));
  const [sortState, setSortState] = useState<{ columnId: string; direction: SortDirection } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const visibleColumns = columns.filter((column) => visibleColumnIds.includes(column.id));
  const sortedRows = useMemo(() => {
    if (!sortState) {
      return rows;
    }
    const sortColumn = columns.find((column) => column.id === sortState.columnId && column.sortValue);
    if (!sortColumn?.sortValue) {
      return rows;
    }
    const directionMultiplier = sortState.direction === "asc" ? 1 : -1;
    return [...rows].sort((rowA, rowB) => compareSortValue(sortColumn.sortValue?.(rowA), sortColumn.sortValue?.(rowB)) * directionMultiplier);
  }, [columns, rows, sortState]);
  const overscan = 6;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
  const endIndex = Math.min(sortedRows.length, startIndex + visibleCount);
  const visibleRows = sortedRows.slice(startIndex, endIndex);
  const topSpacerHeight = startIndex * rowHeight;
  const bottomSpacerHeight = Math.max(0, sortedRows.length - endIndex) * rowHeight;

  function toggleColumn(columnId: string): void {
    setVisibleColumnIds((current) => {
      const nextColumns = current.includes(columnId) ? current.filter((item) => item !== columnId) : [...current, columnId];
      const safeColumns = nextColumns.length > 0 ? nextColumns.filter((item) => columnIds.includes(item)) : [columnId];
      saveTableColumnPreference(tableId, safeColumns);
      return safeColumns;
    });
  }

  function handleScroll(event: UIEvent<HTMLDivElement>): void {
    setScrollTop(event.currentTarget.scrollTop);
  }

  function toggleSort(column: VirtualColumn<Row>): void {
    if (!column.sortValue) {
      return;
    }
    setSortState((current) => current?.columnId === column.id ? { columnId: column.id, direction: current.direction === "asc" ? "desc" : "asc" } : { columnId: column.id, direction: "asc" });
    setScrollTop(0);
  }

  return (
    <div className="virtual-table-wrap">
      <div className="column-toolbar" aria-label="列配置">
        {columns.map((column) => <label key={column.id}><input type="checkbox" checked={visibleColumnIds.includes(column.id)} onChange={() => toggleColumn(column.id)} /> {column.header}</label>)}
      </div>
      {sortedRows.length === 0 ? empty ?? null : (
        <div className="virtual-table-scroll" style={{ maxHeight: height }} onScroll={handleScroll}>
          <table className="virtual-table">
            <thead><tr>{visibleColumns.map((column) => <th key={column.id}>{column.sortValue ? <button type="button" className="sort-header" onClick={() => toggleSort(column)}>{column.header}<span>{sortState?.columnId === column.id ? (sortState.direction === "asc" ? "↑" : "↓") : "↕"}</span></button> : column.header}</th>)}</tr></thead>
            <tbody>
              {topSpacerHeight > 0 ? <tr aria-hidden="true"><td colSpan={visibleColumns.length} style={{ height: topSpacerHeight, padding: 0 }} /></tr> : null}
              {visibleRows.map((row, offset) => <tr key={getRowKey(row)}>{visibleColumns.map((column) => <td key={column.id} className={column.className}>{column.cell(row, startIndex + offset)}</td>)}</tr>)}
              {bottomSpacerHeight > 0 ? <tr aria-hidden="true"><td colSpan={visibleColumns.length} style={{ height: bottomSpacerHeight, padding: 0 }} /></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function compareSortValue(valueA: string | number | boolean | null | undefined, valueB: string | number | boolean | null | undefined): number {
  if (valueA == null && valueB == null) {
    return 0;
  }
  if (valueA == null) {
    return 1;
  }
  if (valueB == null) {
    return -1;
  }
  if (typeof valueA === "number" && typeof valueB === "number") {
    return valueA - valueB;
  }
  return String(valueA).localeCompare(String(valueB), undefined, { numeric: true, sensitivity: "base" });
}