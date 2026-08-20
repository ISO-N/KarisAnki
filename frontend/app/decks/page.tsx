"use client";

/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount is an external data sync */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Layers, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { api, apiErrorMessage, clientTimezone } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { useI18n } from "@/lib/i18n";
import type { Deck } from "@/lib/types";

export default function DecksPage() {
  const { t, language } = useI18n();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Deck[]>(`/api/decks?timezone=${encodeURIComponent(clientTimezone())}`);
      setDecks(data);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    load();
  }, [load]);

  const createDeck = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api<Deck>("/api/decks", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setCreating(false);
    }
  };

  const renameDeck = async (deck: Deck) => {
    const next = window.prompt(t("deckName"), deck.name);
    if (!next?.trim() || next.trim() === deck.name) return;
    try {
      await api<Deck>(`/api/decks/${deck.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: next.trim() }),
      });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    }
  };

  const deleteDeck = async (deck: Deck) => {
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      await api<void>(`/api/decks/${deck.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    }
  };

  const resetDeck = async (deck: Deck) => {
    if (!window.confirm(t("confirmReset"))) return;
    try {
      await api<void>(`/api/decks/${deck.id}/reset?timezone=${encodeURIComponent(clientTimezone())}`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    }
  };

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{t("decks")}</h1>
            <p className="mt-1 text-sm text-muted">{decks.length} {t("cards")}</p>
          </div>
          <div className="flex w-full max-w-md gap-2">
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && createDeck()}
              placeholder={t("deckName")}
            />
            <button className="btn btn-primary shrink-0" onClick={createDeck} disabled={creating || !name.trim()}>
              <Plus size={17} /> {t("createDeck")}
            </button>
          </div>
        </div>

        {error && <div className="rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">{error}</div>}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="card h-36 animate-pulse" />
            ))}
          </div>
        ) : decks.length === 0 ? (
          <div className="empty">{t("emptyDecks")}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <div key={deck.id} className="card flex flex-col gap-4 p-4">
                <Link href={`/decks/${deck.id}`} className="group flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <Layers size={18} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold group-hover:text-accent">{deck.name}</h2>
                      <p className="text-xs text-muted">{t("cards")}</p>
                    </div>
                  </div>
                </Link>
                <div className="flex flex-wrap gap-2">
                  <span className="badge badge-accent">{t("newCards")} {deck.newCount}</span>
                  <span className="badge badge-warning">{t("relearn")} {deck.relearnCount}</span>
                  <span className="badge badge-success">{t("due")} {deck.dueCount}</span>
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <Link href={`/decks/${deck.id}/learn`} className="btn btn-primary flex-1">
                    <BookOpen size={16} /> {t("startLearn")}
                  </Link>
                  <button
                    className="icon-btn"
                    title={t("renameDeck")}
                    aria-label={t("renameDeck")}
                    onClick={() => renameDeck(deck)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    title={t("resetDeck")}
                    aria-label={t("resetDeck")}
                    onClick={() => resetDeck(deck)}
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    className="icon-btn text-danger"
                    title={t("deleteDeck")}
                    aria-label={t("deleteDeck")}
                    onClick={() => deleteDeck(deck)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
