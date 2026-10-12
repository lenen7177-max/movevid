import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import {
  CustomDrawer,
  CustomDrawerContent,
  CustomDrawerHeader,
  CustomDrawerTrigger,
  CustomDrawerBody,
  useCustomDrawer,
} from "@repo/ui/mobile-drawer";
import { cn } from "@/lib/utils";

// Wrapper component for links that close the drawer when clicked
function DrawerLink({
  children,
  to,
  params,
  className,
  ...props
}: {
  children: React.ReactNode;
  to: string;
  params?: any;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, "to" | "params" | "className">) {
  const { setIsOpen } = useCustomDrawer();

  return (
    <Link to={to} params={params} className={className} onClick={() => setIsOpen(false)} {...props}>
      {children}
    </Link>
  );
}

// Reusable category link component
function CategoryLink({
  to,
  params,
  isSelected,
  children,
  count,
  className,
  ...props
}: {
  to: string;
  params?: any;
  isSelected: boolean;
  children: React.ReactNode;
  count: number;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, "to" | "params" | "className">) {
  return (
    <Link
      to={to}
      params={params}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
        isSelected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      <span className="rounded-md border border-current/30 px-1.5 py-0.5 text-xs">{count}</span>
    </Link>
  );
}

interface CategoryItem {
  slug: string;
  name: string;
  count: number;
}

interface BlogCategoryFilterProps {
  categories: CategoryItem[];
  selectedCategorySlug?: string;
  allLabel: string;
  selectCategoryLabel: string;
}

export function BlogCategoryFilter({
  categories,
  selectedCategorySlug,
  allLabel,
  selectCategoryLabel,
}: BlogCategoryFilterProps) {
  const totalCount = categories.reduce((sum, item) => sum + item.count, 0);
  const selectedCategory = categories.find((item) => item.slug === selectedCategorySlug);
  const mobileLabel = selectedCategory?.name ?? allLabel;

  return (
    <div className="space-y-3">
      <div className="hidden flex-wrap gap-2 md:flex">
        <CategoryLink to="/blog" isSelected={!selectedCategorySlug} count={totalCount}>
          {allLabel}
        </CategoryLink>
        {categories.map((category) => (
          <CategoryLink
            key={category.slug}
            to="/blog/category/$slug"
            params={{ slug: category.slug }}
            isSelected={selectedCategorySlug === category.slug}
            count={category.count}
          >
            {category.name}
          </CategoryLink>
        ))}
      </div>
      <div className="md:hidden">
        <CustomDrawer>
          <CustomDrawerTrigger className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-2 text-sm">
            <span>{mobileLabel}</span>
            <ChevronDown className="size-4" />
          </CustomDrawerTrigger>
          <CustomDrawerContent>
            <CustomDrawerHeader>
              <h3 className="font-semibold">{selectCategoryLabel}</h3>
            </CustomDrawerHeader>
            <CustomDrawerBody>
              <div className="space-y-2">
                <DrawerLink
                  to="/blog"
                  className="block rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {allLabel} ({totalCount})
                </DrawerLink>
                {categories.map((category) => (
                  <DrawerLink
                    key={category.slug}
                    to="/blog/category/$slug"
                    params={{ slug: category.slug }}
                    className={cn(
                      "block rounded-lg border border-border px-3 py-2 text-sm",
                      selectedCategorySlug === category.slug ? "border-primary text-primary" : "",
                    )}
                  >
                    {category.name} ({category.count})
                  </DrawerLink>
                ))}
              </div>
            </CustomDrawerBody>
          </CustomDrawerContent>
        </CustomDrawer>
      </div>
    </div>
  );
}
