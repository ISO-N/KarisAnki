"use client";

import { useState, type FormEvent } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import { Eye, LoaderCircle, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import type { Card as StudyCard } from "@/lib/types";
import { MarkdownContent } from "@/components/markdown-content";

interface CardEditorProps {
  deckId: number;
  card?: StudyCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (card: StudyCard) => void;
}

export function CardEditor({ deckId, card, open, onOpenChange, onSaved }: CardEditorProps) {
  const { t, language } = useI18n();
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [frontError, setFrontError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!front.trim()) {
      setFrontError(t("error"));
      return;
    }
    setFrontError("");
    setBusy(true);
    try {
      const saved = card
        ? await api<StudyCard>(`/api/cards/${card.id}`, {
            method: "PUT",
            body: JSON.stringify({ front, back }),
          })
        : await api<StudyCard>(`/api/decks/${deckId}/cards`, {
            method: "POST",
            body: JSON.stringify({ front, back }),
          });
      onSaved(saved);
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{card ? `${t("edit")} ${t("cards")}` : t("createCard")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <div className="grid gap-5 lg:grid-cols-2">
              <Field data-invalid={!!frontError}>
                <FieldLabel htmlFor="card-front">{t("front")}</FieldLabel>
                <Textarea
                  id="card-front"
                  className="min-h-40 max-h-56 resize-y md:max-h-72"
                  value={front}
                  onChange={(event) => setFront(event.target.value)}
                  aria-invalid={!!frontError}
                  required
                />
                {frontError ? <FieldError>{frontError}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="card-back">{t("backSide")}</FieldLabel>
                <Textarea
                  id="card-back"
                  className="min-h-40 max-h-56 resize-y md:max-h-72"
                  value={back}
                  onChange={(event) => setBack(event.target.value)}
                />
              </Field>
            </div>

            {preview ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border bg-panel-strong p-4">
                  <MarkdownContent content={front} />
                </div>
                <div className="rounded-lg border bg-panel-strong p-4">
                  <MarkdownContent content={back} />
                </div>
              </div>
            ) : null}

            <FieldDescription>{t("markdownHint")}</FieldDescription>

            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertTitle>{t("error")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPreview((value) => !value)}>
                <Eye data-icon="inline-start" />
                {t("preview")}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={busy || !front.trim()}>
                {busy ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {t("save")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
