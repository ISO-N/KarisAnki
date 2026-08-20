"use client";

import { useState, type FormEvent } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import { Eye, Save, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Card } from "@/lib/types";
import { MarkdownContent } from "@/components/markdown-content";

interface CardEditorProps {
  deckId: number;
  card?: Card | null;
  onSaved: (card: Card) => void;
  onCancel?: () => void;
}

export function CardEditor({ deckId, card, onSaved, onCancel }: CardEditorProps) {
  const { t, language } = useI18n();
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const saved = card
        ? await api<Card>(`/api/cards/${card.id}`, {
            method: "PUT",
            body: JSON.stringify({ front, back }),
          })
        : await api<Card>(`/api/decks/${deckId}/cards`, {
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
    <form onSubmit={submit} className="card space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">{card ? `${t("edit")} ${t("cards")}` : t("createCard")}</h2>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setPreview((value) => !value)}>
            <Eye size={16} /> {t("preview")}
          </button>
          {onCancel && (
            <button type="button" className="icon-btn" onClick={onCancel} aria-label={t("cancel")}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{t("front")}</span>
          <textarea
            className="textarea"
            value={front}
            onChange={(event) => setFront(event.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{t("backSide")}</span>
          <textarea
            className="textarea"
            value={back}
            onChange={(event) => setBack(event.target.value)}
          />
        </label>
      </div>

      {preview && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-panel-strong p-4">
            <MarkdownContent content={front} />
          </div>
          <div className="rounded-lg border border-line bg-panel-strong p-4">
            <MarkdownContent content={back} />
          </div>
        </div>
      )}

      <p className="text-xs text-muted">{t("markdownHint")}</p>
      {error && <div className="rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">{error}</div>}

      <div className="flex justify-end gap-2">
        <button className="btn btn-primary" type="submit" disabled={busy || !front.trim()}>
          <Save size={16} /> {t("save")}
        </button>
      </div>
    </form>
  );
}
