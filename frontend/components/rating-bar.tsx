"use client";

import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnswerResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RatingBarProps {
  familiarLabel: string;
  blurryLabel: string;
  forgotLabel: string;
  submittingLabel?: string;
  submitting: boolean;
  selected?: AnswerResult | null;
  onSelect: (result: AnswerResult) => void;
}

const options = [
  { value: "FAMILIAR", labelKey: "familiar", icon: CheckCircle2 },
  { value: "BLURRY", labelKey: "blurry", icon: CircleAlert },
  { value: "FORGOT", labelKey: "forgot", icon: XCircle },
] as const;

const toneClasses = {
  FAMILIAR: "bg-success-soft text-success hover:bg-success/20 data-[pressed=true]:bg-success data-[pressed=true]:text-success-foreground data-[pressed=true]:ring-1 data-[pressed=true]:ring-success",
  BLURRY: "bg-warning-soft text-warning hover:bg-warning/20 data-[pressed=true]:bg-warning data-[pressed=true]:text-white data-[pressed=true]:ring-1 data-[pressed=true]:ring-warning",
  FORGOT: "bg-danger-soft text-danger hover:bg-danger/20 data-[pressed=true]:bg-danger data-[pressed=true]:text-danger-foreground data-[pressed=true]:ring-1 data-[pressed=true]:ring-danger",
};

export function RatingBar({
  familiarLabel,
  blurryLabel,
  forgotLabel,
  submittingLabel = "Submitting",
  submitting,
  selected,
  onSelect,
}: RatingBarProps) {
  const labels = {
    FAMILIAR: familiarLabel,
    BLURRY: blurryLabel,
    FORGOT: forgotLabel,
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label={submittingLabel}>
      {options.map((option, index) => {
        const Icon = option.icon;
        const active = selected === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            size="lg"
            disabled={submitting}
            aria-pressed={active}
            data-pressed={active}
            onClick={() => onSelect(option.value)}
            className={cn("h-14 min-w-0 px-2 text-sm transition-all duration-150 sm:text-base", toneClasses[option.value])}
          >
            <Icon data-icon="inline-start" aria-hidden="true" />
            <span className="truncate">
              {index + 1} · {labels[option.value]}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
