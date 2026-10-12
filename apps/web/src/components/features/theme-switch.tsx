import { Check, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ThemeSwitchProps = {
  onActionComplete?: () => void;
};

const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export function ThemeSwitch({ onActionComplete }: ThemeSwitchProps = {}) {
  const { theme, setTheme } = useTheme();

  const selectTheme = (nextTheme: (typeof themeOptions)[number]["value"]) => {
    setTheme(nextTheme);
    if (!onActionComplete) return;
    window.requestAnimationFrame(onActionComplete);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={<Button className="scale-95 rounded-full" size="icon" variant="ghost" />}
      >
        <Sun className="size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {themeOptions.map(({ value, label }) => (
            <DropdownMenuItem key={value} onClick={() => selectTheme(value)}>
              {label}
              <Check className={cn("ms-auto", theme !== value && "hidden")} size={14} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
