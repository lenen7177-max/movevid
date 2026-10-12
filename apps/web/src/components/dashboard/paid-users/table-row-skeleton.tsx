import { Skeleton } from "@repo/ui/skeleton";
import { TableCell, TableRow } from "@repo/ui/table";

export function TableRowSkeleton({ columns }: { columns: number }) {
  return (
    <TableRow className="h-16">
      {Array.from({ length: columns }).map((_, index) => (
        <TableCell key={index} className="py-3">
          <Skeleton className={index === 0 ? "h-9 w-40" : "h-5 w-24"} />
        </TableCell>
      ))}
    </TableRow>
  );
}
