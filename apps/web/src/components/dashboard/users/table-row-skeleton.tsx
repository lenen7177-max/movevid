import { Skeleton } from "@repo/ui/skeleton";
import { TableCell, TableRow } from "@repo/ui/table";

export function TableRowSkeleton({ columns }: { columns: number }) {
  return (
    <TableRow className="h-14">
      {Array.from({ length: columns }).map((_, index) => {
        if (index === 0) {
          // Name column
          return (
            <TableCell key={index} className="py-3">
              <Skeleton className="h-4 w-24" />
            </TableCell>
          );
        }
        if (index === 1) {
          // Email column
          return (
            <TableCell key={index} className="py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4" />
                <Skeleton className="h-4 w-32" />
              </div>
            </TableCell>
          );
        }
        if (index === 2) {
          // Status column
          return (
            <TableCell key={index} className="py-3">
              <Skeleton className="h-6 w-20" />
            </TableCell>
          );
        }
        // Actions column
        return (
          <TableCell key={index} className="py-3">
            <Skeleton className="size-8" />
          </TableCell>
        );
      })}
    </TableRow>
  );
}
