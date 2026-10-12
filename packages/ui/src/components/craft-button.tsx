import * as React from "react";

import type { VariantProps } from "class-variance-authority";

import { Button, type buttonVariants } from "./button";

import { cn } from "../lib/cn";

const CraftButtonContext = React.createContext<{
  size?: VariantProps<typeof buttonVariants>["size"];
}>({});

interface CraftButtonProps extends React.ComponentProps<typeof Button> {
  size?: VariantProps<typeof buttonVariants>["size"];
  children?: React.ReactNode;
}

interface CraftButtonLabelProps {
  children: React.ReactNode;
  className?: string;
}

interface CraftButtonIconProps {
  children: React.ReactNode;
  className?: string;
}

function CraftButtonLabel({ children, className }: CraftButtonLabelProps) {
  return (
    <span
      className={cn(
        "group-hover:text-foreground relative z-2 transition-colors duration-500",
        className,
      )}
    >
      {children}
    </span>
  );
}

function CraftButtonIcon({ children, className }: CraftButtonIconProps) {
  const { size } = React.useContext(CraftButtonContext);
  const iconSize = size === "lg" ? "size-6" : size === "sm" ? "size-4" : "size-5";

  return (
    <span className={cn("relative z-1", iconSize, className)}>
      <span
        className={cn(
          "bg-background absolute inset-0 -z-1 rounded-full transition-transform duration-500 group-hover:scale-[15]",
          iconSize,
        )}
      />
      <span
        className={cn(
          "bg-background text-primary group-hover:bg-primary group-hover:text-background relative z-2 flex items-center justify-center rounded-full transition-all duration-500",
          iconSize,
        )}
      >
        {children}
      </span>
    </span>
  );
}

function CraftButton(props: CraftButtonProps) {
  const { children, size, className, ...rest } = props;

  return (
    <CraftButtonContext.Provider value={{ size }}>
      <Button
        size={size}
        className={cn(
          "group hover:bg-background dark:hover:border-primary/30 relative cursor-pointer overflow-hidden rounded-full duration-500 hover:shadow-md dark:border dark:border-transparent",
          className,
        )}
        {...rest}
      >
        {children}
      </Button>
    </CraftButtonContext.Provider>
  );
}

export {
  CraftButton,
  CraftButtonLabel,
  CraftButtonIcon,
  type CraftButtonProps,
  type CraftButtonLabelProps,
  type CraftButtonIconProps,
};
