import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
}

const tones = {
  default: "text-muted-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function MetricCard({ icon: Icon, label, value, tone = "default", className }: MetricCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <CardContent className="flex flex-col gap-2 p-0">
        <div className={cn("flex items-center gap-2 text-sm font-medium", tones[tone])}>
          <Icon className="size-4" aria-hidden="true" />
          <span>{label}</span>
        </div>
        <div className="font-mono text-3xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
