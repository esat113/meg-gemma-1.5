import { AlertTriangle } from "lucide-react";

import { cn } from "../../lib/utils";

export function Alert({ className, children, variant = "default" }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-md border px-4 py-3 text-sm",
        variant === "destructive"
          ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
          : "border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
