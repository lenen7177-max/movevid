import "@tanstack/react-table";
import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string; // apply to both th and td
    tdClassName?: string;
    thClassName?: string;
  }
}
