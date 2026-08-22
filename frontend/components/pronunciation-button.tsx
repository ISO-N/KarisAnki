"use client";

import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canSpeakFront, speakFront, speechSynthesisAvailable } from "@/lib/pronunciation";

interface PronunciationButtonProps {
  front: string;
  label: string;
  className?: string;
}

export function PronunciationButton({ front, label, className }: PronunciationButtonProps) {
  if (!canSpeakFront(front) || !speechSynthesisAvailable()) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={label}
      title={label}
      onClick={() => speakFront(front)}
    >
      <Volume2 aria-hidden="true" />
    </Button>
  );
}
