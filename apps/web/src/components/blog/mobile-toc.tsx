import { List } from "lucide-react";
import {
  CustomDrawer,
  CustomDrawerTrigger,
  CustomDrawerContent,
  CustomDrawerHeader,
  CustomDrawerBody,
} from "@repo/ui/mobile-drawer";
import { TableOfContents } from "./table-of-contents";

interface MobileTocProps {
  title: string;
  refreshKey?: string;
}

export function MobileToc({ title, refreshKey }: MobileTocProps) {
  return (
    <CustomDrawer>
      <CustomDrawerTrigger className="fixed right-6 bottom-6 z-50 rounded-full bg-primary p-3 text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 lg:hidden">
        <List className="size-5" />
      </CustomDrawerTrigger>
      <CustomDrawerContent className="lg:hidden">
        <CustomDrawerHeader>
          <h3 className="font-semibold">{title}</h3>
        </CustomDrawerHeader>
        <CustomDrawerBody>
          <TableOfContents title={title} refreshKey={refreshKey} />
        </CustomDrawerBody>
      </CustomDrawerContent>
    </CustomDrawer>
  );
}
