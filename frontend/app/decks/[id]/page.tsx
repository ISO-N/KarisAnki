"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount is an external data sync */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { api, apiErrorMessage, clientTimezone } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CardEditor } from "@/components/card-editor";
import { ImportCards } from "@/components/import-cards";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { MarkdownContent } from "@/components/markdown-content";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Card as StudyCard, CardList, Deck, ImportResult } from "@/lib/types";

type CardPendingAction =
  | { type: "delete"; card: StudyCard }
  | { type: "reset"; card: StudyCard }
  | null;

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const deckId = Number(id);
  const { t, language } = useI18n();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<CardList>({ items: [], total: 0, page: 0, pageSize: 50 });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StudyCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingCardAction, setPendingCardAction] = useState<CardPendingAction>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const statusQuery = status === "all" ? "" : status;

  const load = useCallback(async (requestedPage = 0, requestedQuery = "", requestedStatus = "") => {
    try {
      const [decks, cardData] = await Promise.all([
        api<Deck[]>(`/api/decks?timezone=${encodeURIComponent(clientTimezone())}`),
        api<CardList>(
          `/api/decks/${deckId}/cards?page=${requestedPage}&q=${encodeURIComponent(requestedQuery)}&status=${encodeURIComponent(requestedStatus)}`,
        ),
      ]);
      const found = decks.find((item) => item.id === deckId);
      setDeck(found ?? null);
      setCards(cardData);
      setError("");
      if (!found) setMessage(t("error"));
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setLoading(false);
    }
  }, [deckId, language, t]);

  useEffect(() => {
    load();
  }, [load]);

  const search = () => {
    setPage(0);
    void load(0, query, statusQuery);
  };

  const changeStatus = (value: string) => {
    setStatus(value);
    setPage(0);
    void load(0, query, value === "all" ? "" : value);
  };

  const goToPage = (next: number) => {
    setPage(next);
    void load(next, query, statusQuery);
  };

  const handleImported = async (result: ImportResult) => {
    setImportResult(result);
    setImportOpen(false);
    await load(page, query, statusQuery);
  };

  const runPendingCardAction = async () => {
    if (!pendingCardAction || pendingBusy) return;
    const { card } = pendingCardAction;
    setPendingBusy(true);
    try {
      if (pendingCardAction.type === "delete") {
        await api<void>(`/api/cards/${card.id}`, { method: "DELETE" });
        setMessage(t("cardDeleted"));
      } else {
        await api<void>(`/api/cards/${card.id}/reset`, { method: "POST" });
        setMessage(t("cardReset"));
      }
      setPendingCardAction(null);
      await load(page, query, statusQuery);
    } catch (err) {
      setError(apiErrorMessage(err, language, t("error")));
    } finally {
      setPendingBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(cards.total / cards.pageSize));

  return (
    <RequireAuth>
      <div className="flex flex-col gap-5">
        <PageHeader
          title={deck?.name ?? t("loading")}
          description={`${cards.total} ${t("cards")}`}
          actions={
            <>
              <Link href={`/decks/${deckId}/learn`} className={cn(buttonVariants(), "min-h-11")}>
                <BookOpen data-icon="inline-start" />
                {t("startLearn")}
              </Link>
              <Link href={`/decks/${deckId}/review`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>
                <BookOpen data-icon="inline-start" />
                {t("startReview")}
              </Link>
              <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
                <Plus data-icon="inline-start" />
                {t("createCard")}
              </Button>
              <Button onClick={() => { setImportResult(null); setImportOpen(true); }}>
                <Upload data-icon="inline-start" />
                {t("importCards")}
              </Button>
            </>
          }
        />

        <Link href="/decks" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit px-2 min-h-11")}>
          <ChevronLeft data-icon="inline-start" />
          {t("back")}
        </Link>

        {message ? (
          <Alert role="status">
            <AlertTitle>{message}</AlertTitle>
          </Alert>
        ) : null}

        {importResult ? (
          <Alert role="status">
            <AlertTitle>{t("importCompleted")}</AlertTitle>
            <AlertDescription>
              {t("importCreated")} {importResult.created} / {t("importSkipped")} {importResult.skippedDuplicates}
            </AlertDescription>
          </Alert>
        ) : null}

        {error && !loading ? <ErrorState title={t("error")} description={error} onRetry={() => load(page, query, statusQuery)} retryLabel={t("retry")} /> : null}

        <CardEditor
          key={editing?.id ?? "new"}
          deckId={deckId}
          card={editing}
          open={editorOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEditorOpen(false);
              setEditing(null);
            }
          }}
          onSaved={async () => {
            setMessage(editing ? t("cardUpdated") : t("cardCreated"));
            setEditorOpen(false);
            setEditing(null);
            await load(page, query, statusQuery);
          }}
        />

        {importOpen ? (
          <ImportCards deckId={deckId} open onOpenChange={setImportOpen} onImported={handleImported} />
        ) : null}

        <Card className="p-4">
          <CardContent className="flex flex-col gap-3 p-0 sm:flex-row sm:items-center">
            <div className="flex flex-1 gap-2">
              <InputGroup className="flex-1">
                <InputGroupInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && search()}
                  placeholder={t("searchCards")}
                  aria-label={t("searchCards")}
                />
                <InputGroupAddon align="inline-end">
                  <Search aria-hidden="true" />
                </InputGroupAddon>
              </InputGroup>
              <Button variant="outline" onClick={search}>
                <Search data-icon="inline-start" />
                <span className="hidden sm:inline">{t("search")}</span>
              </Button>
            </div>
            <Select value={status} onValueChange={(value) => changeStatus(String(value))} items={{ all: t("allStatus"), new: t("statusNew"), review: t("statusReview"), relearn: t("statusRelearn"), graduated: t("statusGraduated") }}>
              <SelectTrigger className="sm:w-44" aria-label={t("allStatus")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatus")}</SelectItem>
                <SelectItem value="new">{t("statusNew")}</SelectItem>
                <SelectItem value="review">{t("statusReview")}</SelectItem>
                <SelectItem value="relearn">{t("statusRelearn")}</SelectItem>
                <SelectItem value="graduated">{t("statusGraduated")}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : error && cards.items.length === 0 ? (
          <ErrorState title={t("error")} description={error} onRetry={() => load(page, query, statusQuery)} retryLabel={t("retry")} />
        ) : cards.items.length === 0 ? (
          <EmptyState
            title={query || status !== "all" ? t("noResults") : t("emptyCards")}
            description={query || status !== "all" ? t("noResultsHint") : t("emptyCards")}
          >
            <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Plus data-icon="inline-start" />
              {t("createCard")}
            </Button>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {cards.items.map((card) => (
              <Card key={card.id} className="p-4">
                <CardContent className="flex flex-col gap-3 p-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">{t("front")}</div>
                        <MarkdownContent content={card.front} />
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">{t("backSide")}</div>
                        <MarkdownContent content={card.back} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={
                          card.status === "new"
                            ? "primary"
                            : card.status === "relearn"
                              ? "warning"
                              : card.status === "review"
                                ? "success"
                                : "outline"
                        }
                      >
                        {card.status === "new"
                          ? t("statusNew")
                          : card.status === "review"
                            ? t("statusReview")
                            : card.status === "relearn"
                              ? t("statusRelearn")
                              : t("statusGraduated")}
                      </Badge>
                      <Badge variant="outline">
                        {t("stage")} {card.stage}
                      </Badge>
                      {card.dueDate ? (
                        <Badge variant="outline">
                          {t("dueDate")} {card.dueDate}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <CardAction className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={t("edit")}
                      title={t("edit")}
                      onClick={() => { setEditing(card); setEditorOpen(true); }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={t("reset")}
                      title={t("reset")}
                      onClick={() => setPendingCardAction({ type: "reset", card })}
                    >
                      <RotateCcw />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      aria-label={t("delete")}
                      title={t("delete")}
                      onClick={() => setPendingCardAction({ type: "delete", card })}
                    >
                      <Trash2 />
                    </Button>
                  </CardAction>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {cards.total > cards.pageSize ? (
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" disabled={page === 0} onClick={() => goToPage(Math.max(0, page - 1))}>
              <ChevronLeft data-icon="inline-start" />
              {t("previousPage")}
            </Button>
            <span className="font-mono text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" disabled={page >= totalPages - 1} onClick={() => goToPage(page + 1)}>
              {t("nextPage")}
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        ) : null}
      </div>

      <AlertDialog
        open={!!pendingCardAction}
        onOpenChange={(open) => {
          if (!open) setPendingCardAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingCardAction?.type === "delete" ? t("confirmDeleteCardTitle") : t("confirmResetCardTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCardAction?.type === "delete"
                ? t("confirmDeleteCardDescription")
                : t("confirmResetCardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingCardAction(null)}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingCardAction?.type === "delete" ? "destructive" : "default"}
              onClick={runPendingCardAction}
              disabled={pendingBusy}
            >
              {pendingBusy ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : pendingCardAction?.type === "delete" ? (
                <Trash2 data-icon="inline-start" />
              ) : (
                <RotateCcw data-icon="inline-start" />
              )}
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RequireAuth>
  );
}
