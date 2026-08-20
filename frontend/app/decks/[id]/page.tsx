"use client";

/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount is an external data sync */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { api, apiErrorMessage, clientTimezone } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { CardEditor } from "@/components/card-editor";
import { MarkdownContent } from "@/components/markdown-content";
import { useI18n } from "@/lib/i18n";
import type { Card, CardList, Deck } from "@/lib/types";

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const deckId = Number(id);
  const { t, language } = useI18n();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<CardList>({ items: [], total: 0, page: 0, pageSize: 50 });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (requestedPage = page, requestedQuery = query, requestedStatus = status) => {
    try {
      const [decks, cardData] = await Promise.all([
        api<Deck[]>(`/api/decks?timezone=${encodeURIComponent(clientTimezone())}`),
        api<CardList>(
          `/api/decks/${deckId}/cards?page=${requestedPage}&q=${encodeURIComponent(requestedQuery)}&status=${encodeURIComponent(requestedStatus)}`,
        ),
      ]);
      const found = decks.find((item) => item.id === deckId);
      if (!found) {
        setError(t("error"));
      }
      setDeck(found ?? null);
      setCards(cardData);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setLoading(false);
    }
  }, [deckId, language, page, query, status, t]);

  useEffect(() => {
    load();
  }, [load]);

  const search = () => {
    if (page === 0) {
      void load(0, query, status);
    } else {
      setPage(0);
    }
  };

  const changeStatus = (value: string) => {
    setStatus(value);
    if (page === 0) {
      void load(0, query, value);
    } else {
      setPage(0);
    }
  };

  const deleteCard = async (card: Card) => {
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      await api<void>(`/api/cards/${card.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    }
  };

  const resetCard = async (card: Card) => {
    if (!window.confirm(t("confirmReset"))) return;
    try {
      await api<void>(`/api/cards/${card.id}/reset`, { method: "POST" });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    }
  };

  const totalPages = Math.max(1, Math.ceil(cards.total / cards.pageSize));

  return (
    <RequireAuth>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/decks" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-foreground">
              <ChevronLeft size={16} /> {t("back")}
            </Link>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{deck?.name ?? t("loading")}</h1>
            <p className="mt-1 text-sm text-muted">{cards.total} {t("cards")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/decks/${deckId}/learn`} className="btn btn-primary">
              <BookOpen size={16} /> {t("startLearn")}
            </Link>
            <Link href={`/decks/${deckId}/review`} className="btn btn-secondary">
              <BookOpen size={16} /> {t("startReview")}
            </Link>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Plus size={16} /> {t("createCard")}
            </button>
          </div>
        </div>

        {error && <div className="rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">{error}</div>}

        {editorOpen && (
          <CardEditor
            key={editing?.id ?? "new"}
            deckId={deckId}
            card={editing}
            onSaved={async () => {
              setEditorOpen(false);
              setEditing(null);
              await load();
            }}
            onCancel={() => {
              setEditorOpen(false);
              setEditing(null);
            }}
          />
        )}

        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" size={16} />
              <input
                className="input pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && search()}
                placeholder={t("searchCards")}
              />
            </div>
            <button className="btn btn-secondary" onClick={search}>
              <Search size={16} />
            </button>
          </div>
          <select className="select sm:w-44" value={status} onChange={(event) => changeStatus(event.target.value)}>
            <option value="">{t("allStatus")}</option>
            <option value="new">{t("statusNew")}</option>
            <option value="review">{t("statusReview")}</option>
            <option value="relearn">{t("statusRelearn")}</option>
            <option value="graduated">{t("statusGraduated")}</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="card h-24 animate-pulse" />
            ))}
          </div>
        ) : cards.items.length === 0 ? (
          <div className="empty">{t("emptyCards")}</div>
        ) : (
          <div className="space-y-3">
            {cards.items.map((card) => (
              <div key={card.id} className="card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{t("front")}</div>
                        <MarkdownContent content={card.front} />
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{t("backSide")}</div>
                        <MarkdownContent content={card.back} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`badge ${card.status === "new" ? "badge-accent" : card.status === "relearn" ? "badge-warning" : card.status === "review" ? "badge-success" : "badge"}`}>
                        {card.status === "new" ? t("statusNew") : card.status === "review" ? t("statusReview") : card.status === "relearn" ? t("statusRelearn") : t("statusGraduated")}
                      </span>
                      <span className="badge">{t("stage")} {card.stage}</span>
                      {card.dueDate && <span className="badge">{t("dueDate")} {card.dueDate}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      className="icon-btn"
                      title={t("edit")}
                      aria-label={t("edit")}
                      onClick={() => { setEditing(card); setEditorOpen(true); }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      title={t("reset")}
                      aria-label={t("reset")}
                      onClick={() => resetCard(card)}
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      className="icon-btn text-danger"
                      title={t("delete")}
                      aria-label={t("delete")}
                      onClick={() => deleteCard(card)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {cards.total > cards.pageSize && (
          <div className="flex items-center justify-between gap-3">
            <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
              <ChevronLeft size={16} /> {t("back")}
            </button>
            <span className="text-sm text-muted">{page + 1} / {totalPages}</span>
            <button className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage((value) => value + 1)}>
              {t("cards")} <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
