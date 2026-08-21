"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, apiErrorMessage, clientTimezone } from "@/lib/api";
import { invalidateApiCache } from "@/lib/api-cache";
import { useAuth } from "@/lib/auth-context";
import { useApiData } from "@/lib/use-api-data";
import {
  BookOpen,
  CalendarClock,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { useI18n } from "@/lib/i18n";
import type { Deck } from "@/lib/types";

type PendingAction =
  | { type: "delete"; deck: Deck }
  | { type: "reset"; deck: Deck }
  | null;

export default function DecksPage() {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const { data: deckData, loading, error, refresh } = useApiData<Deck[]>({
    path: `/api/decks?timezone=${encodeURIComponent(clientTimezone())}`,
    auth: "required",
  });
  const decks = deckData ?? [];
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Deck | null>(null);
  const [renameName, setRenameName] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pendingBusy, setPendingBusy] = useState(false);

  const load = useCallback(() => {
    refresh();
  }, [refresh]);

  const invalidateDeckList = useCallback(async () => {
    if (!user) return;
    await invalidateApiCache({ type: "deck-list", userId: user.id });
  }, [user]);

  const invalidateDeckData = useCallback(async (deckId: number) => {
    if (!user) return;
    await invalidateApiCache({ type: "deck", userId: user.id, deckId });
    await invalidateApiCache({ type: "stats", userId: user.id });
  }, [user]);
  const createDeck = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || creating) return;
    setMessage("");
    setCreating(true);
    try {
      await api<Deck>("/api/decks", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      setName("");
      setCreateOpen(false);
      setMessage(t("deckCreated"));
      await invalidateDeckList();
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err, language, t("error")));
    } finally {
      setCreating(false);
    }
  };

  const renameDeck = async (event: FormEvent) => {
    event.preventDefault();
    if (!renameTarget || !renameName.trim()) return;
    setMessage("");
    try {
      await api<Deck>(`/api/decks/${renameTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: renameName.trim() }),
      });
      setRenameTarget(null);
      setMessage(t("deckRenamed"));
      await invalidateDeckData(renameTarget.id);
      await invalidateDeckList();
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err, language, t("error")));
    }
  };

  const runPendingAction = async () => {
    if (!pendingAction || pendingBusy) return;
    const { deck } = pendingAction;
    setPendingBusy(true);
    setMessage("");
    try {
      if (pendingAction.type === "delete") {
        await api<void>(`/api/decks/${deck.id}`, { method: "DELETE" });
        setMessage(t("deckDeleted"));
      } else {
        await api<void>(`/api/decks/${deck.id}/reset?timezone=${encodeURIComponent(clientTimezone())}`, {
          method: "POST",
        });
        setMessage(t("deckReset"));
      }
      setPendingAction(null);
      await invalidateDeckData(deck.id);
      await invalidateDeckList();
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err, language, t("error")));
    } finally {
      setPendingBusy(false);
    }
  };

  const totalCards = decks.reduce((sum, deck) => sum + deck.newCount + deck.relearnCount + deck.dueCount, 0);

  return (
    <RequireAuth>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("decks")}
          description={`${decks.length} ${t("decks")} · ${totalCards} ${t("due")}`}
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              {t("createDeck")}
            </Button>
          }
        />

        {message ? (
          <Alert role="status">
            <AlertTitle>{message}</AlertTitle>
          </Alert>
        ) : null}

        {error || actionError && !loading ? <ErrorState title={t("error")} description={error || actionError} onRetry={() => { setActionError(""); load(); }} retryLabel={t("retry")} /> : null}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-44" />
            ))}
          </div>
        ) : decks.length === 0 && !error && !actionError ? (
          <EmptyState
            title={t("emptyDecks")}
            description={t("dashboardEmptyHint")}
          >
            <Button onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              {t("createDeck")}
            </Button>
            <Link href="/statistics" className={buttonVariants({ variant: "outline" })}>
              {t("statistics")}
            </Link>
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <Card key={deck.id} className="relative p-4 transition-colors focus-within:border-primary/50">
                <Link
                  href={`/decks/${deck.id}`}
                  aria-label={`${deck.name} ${t("openDeck")}`}
                  className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <div className="pointer-events-none relative z-10">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Layers className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="truncate">{deck.name}</CardTitle>
                        <CardDescription>{t("cards")}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Badge variant="primary">
                      <Layers data-icon="inline-start" aria-hidden="true" />
                      {t("newCards")} {deck.newCount}
                    </Badge>
                    <Badge variant="warning">
                      <RefreshCcw data-icon="inline-start" aria-hidden="true" />
                      {t("relearn")} {deck.relearnCount}
                    </Badge>
                    <Badge variant="success">
                      <CalendarClock data-icon="inline-start" aria-hidden="true" />
                      {t("due")} {deck.dueCount}
                    </Badge>
                  </CardContent>
                  <CardAction className="pointer-events-none mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/decks/${deck.id}/learn`}
                      className={cn(buttonVariants({ size: "sm" }), "pointer-events-auto relative z-20 min-h-11 flex-1")}
                    >
                      <BookOpen data-icon="inline-start" />
                      {t("startLearn")}
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="pointer-events-auto relative z-20"
                      aria-label={t("renameDeck")}
                      title={t("renameDeck")}
                      onClick={() => {
                        setRenameTarget(deck);
                        setRenameName(deck.name);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="pointer-events-auto relative z-20"
                      aria-label={t("resetDeck")}
                      title={t("resetDeck")}
                      onClick={() => setPendingAction({ type: "reset", deck })}
                    >
                      <RotateCcw />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      className="pointer-events-auto relative z-20"
                      aria-label={t("deleteDeck")}
                      title={t("deleteDeck")}
                      onClick={() => setPendingAction({ type: "delete", deck })}
                    >
                      <Trash2 />
                    </Button>
                  </CardAction>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createDeckTitle")}</DialogTitle>
            <DialogDescription>{t("createDeckDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={createDeck}>
            <Field>
              <FieldLabel htmlFor="create-deck" className="sr-only">
                {t("deckName")}
              </FieldLabel>
              <Input
                id="create-deck"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("deckName")}
                aria-label={t("deckName")}
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setName(""); }}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                {t("createDeck")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmRenameTitle")}</DialogTitle>
            <DialogDescription>{t("renameDeckName")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={renameDeck}>
            <Field>
              <FieldLabel htmlFor="rename-deck" className="sr-only">
                {t("renameDeckName")}
              </FieldLabel>
              <Input
                id="rename-deck"
                value={renameName}
                onChange={(event) => setRenameName(event.target.value)}
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={!renameName.trim()}>
                <Save />
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "delete" ? t("confirmDeleteTitle") : t("confirmResetTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "delete"
                ? t("confirmDeleteDeckDescription")
                : t("confirmResetDeckDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingAction(null)}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingAction?.type === "delete" ? "destructive" : "default"}
              onClick={runPendingAction}
              disabled={pendingBusy}
            >
              {pendingBusy ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RequireAuth>
  );
}
