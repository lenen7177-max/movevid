import { z } from "zod";

import { dataTableConfig } from "@/configs/data/data-table";
import type { ExtendedColumnFilter, ExtendedColumnSort } from "@/types/data-table";

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

export type SortingStateParser<TData> = {
  parse: (value: string | null | undefined) => ExtendedColumnSort<TData>[] | null;
  serialize: (value: ExtendedColumnSort<TData>[]) => string;
};

export const getSortingStateParser = <TData>(
  columnIds?: string[] | Set<string>,
): SortingStateParser<TData> => {
  const validKeys = columnIds ? (columnIds instanceof Set ? columnIds : new Set(columnIds)) : null;

  return {
    parse: (value) => {
      if (!value) return null;
      try {
        const parsed = JSON.parse(value);
        const result = z.array(sortingItemSchema).safeParse(parsed);

        if (!result.success) return null;

        if (validKeys && result.data.some((item) => !validKeys.has(item.id))) {
          return null;
        }

        return result.data as ExtendedColumnSort<TData>[];
      } catch {
        return null;
      }
    },
    serialize: (value) => JSON.stringify(value),
  };
};

/**
 * Parse sort string to sorting state array
 * Format: "field:direction,field2:direction2" (e.g., "createdAt:desc,name:asc")
 * Direction defaults to "asc" if not specified
 */
export function parseSortString<TData>(
  value: string | null | undefined,
  validColumnIds?: string[] | Set<string>,
): ExtendedColumnSort<TData>[] | null {
  if (!value || value.trim() === "") return null;

  const validKeys = validColumnIds
    ? validColumnIds instanceof Set
      ? validColumnIds
      : new Set(validColumnIds)
    : null;

  const parts = value.split(",").filter(Boolean);
  const result: ExtendedColumnSort<TData>[] = [];

  for (const part of parts) {
    const [id, direction] = part.split(":").map((s) => s.trim());
    if (!id) continue;

    if (validKeys && !validKeys.has(id)) continue;

    result.push({
      id: id as ExtendedColumnSort<TData>["id"],
      desc: direction === "desc",
    });
  }

  return result.length > 0 ? result : null;
}

/**
 * Serialize sorting state array to sort string
 * Format: "field:direction,field2:direction2" (e.g., "createdAt:desc,name:asc")
 */
export function serializeSortString<TData>(value: ExtendedColumnSort<TData>[]): string {
  if (!value || value.length === 0) return "";

  return value.map((item) => `${String(item.id)}:${item.desc ? "desc" : "asc"}`).join(",");
}

const filterItemSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
  variant: z.enum(dataTableConfig.filterVariants),
  operator: z.enum(dataTableConfig.operators),
  filterId: z.string(),
});

export type FilterItemSchema = z.infer<typeof filterItemSchema>;

export type FiltersStateParser<TData> = {
  parse: (value: string | null | undefined) => ExtendedColumnFilter<TData>[] | null;
  serialize: (value: ExtendedColumnFilter<TData>[]) => string;
};

export const getFiltersStateParser = <TData>(
  columnIds?: string[] | Set<string>,
): FiltersStateParser<TData> => {
  const validKeys = columnIds ? (columnIds instanceof Set ? columnIds : new Set(columnIds)) : null;

  return {
    parse: (value) => {
      if (!value) return null;
      try {
        const parsed = JSON.parse(value);
        const result = z.array(filterItemSchema).safeParse(parsed);

        if (!result.success) return null;

        if (validKeys && result.data.some((item) => !validKeys.has(item.id))) {
          return null;
        }

        return result.data as ExtendedColumnFilter<TData>[];
      } catch {
        return null;
      }
    },
    serialize: (value) => JSON.stringify(value),
  };
};
