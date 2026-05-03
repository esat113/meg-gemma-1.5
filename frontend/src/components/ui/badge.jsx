import { cn } from "../../lib/utils";

export function Badge({ className, variant = "default", ...props }) {
  const classes =
    variant === "destructive"
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100"
      : "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-100";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", classes, className)} {...props} />;
}
