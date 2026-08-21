import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface SessionHeaderProps {
  backHref: string;
  backLabel: string;
  progressLabel: string;
  completed: number;
  total: number;
  statusLabel?: string;
}

export function SessionHeader({
  backHref,
  backLabel,
  progressLabel,
  completed,
  total,
  statusLabel,
}: SessionHeaderProps) {
  const current = total > 0 ? Math.min(total, completed + 1) : 0;
  const progress = total > 0 ? Math.min(100, (completed / total) * 100) : 0;

  return (
    <div className="mb-4 flex items-center gap-3">
      <Link
        href={backHref}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 px-2 min-h-11")}
      >
        <ChevronLeft data-icon="inline-start" />
        <span className="sr-only sm:not-sr-only">{backLabel}</span>
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">{statusLabel}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {current} / {total}
          </span>
        </div>
        <Progress value={progress} aria-label={progressLabel} className="mt-1.5 w-full">
          <span className="sr-only">{progressLabel}</span>
        </Progress>
      </div>
    </div>
  );
}
