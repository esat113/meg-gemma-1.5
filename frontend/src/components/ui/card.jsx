import { cn } from "../../lib/utils";

export function Card({ className, ...props }) {
  return <section className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-soft", className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("border-b border-border px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("px-5 py-5", className)} {...props} />;
}
