"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ title, description, onRetry, retryLabel = "Retry" }: ErrorStateProps) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw data-icon="inline-start" />
          {retryLabel}
        </Button>
      ) : null}
    </Alert>
  );
}
