import React from "react";

import { cn } from "../../lib/utils";

export const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-28 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-900",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
