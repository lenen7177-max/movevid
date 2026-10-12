# @repo/ui

Shared React UI primitives (shadcn/ui on Base UI) and design tokens for the web app.

Import components through package subpaths:

```tsx
import { Button } from "@repo/ui/button";
```

Design tokens (colors, radius, fonts) live in `src/styles/theme.css`. Change `--primary`
and `--ring` there to rebrand; `.dark` holds the dark theme, which is the default.

Add and customize shadcn components from this directory so the package stays the single
source of truth:

```bash
cd packages/ui
pnpm dlx shadcn@latest add dialog
```
