import React from "react";

import { cn } from "../../lib/utils";

export const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-900",
      className,
    )}
    {...props}
  />
));

Input.displayName = "Input";
