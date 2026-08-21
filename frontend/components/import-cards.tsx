"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileText, LoaderCircle, Plus, Trash2, Upload } from "lucide-react";
import { api, apiErrorMessage, IMPORT_MAX_CARDS, IMPORT_MAX_SOURCE_BYTES } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import type { ImportPreview, ImportPreviewItem, ImportResult } from "@/lib/types";

interface ImportCardsProps {
  deckId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: ImportResult) => Promise<void> | void;
}

export function ImportCards({ deckId, open, onOpenChange, onImported }: ImportCardsProps) {
  const { t, language } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [parseBusy, setParseBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);

  const summary = preview
    ? {
        total: preview.items.length,
        valid: preview.items.filter((item) => item.errors.length === 0).length,
        duplicate: preview.items.filter((item) => item.duplicate).length,
        invalid: preview.items.filter((item) => item.errors.length > 0).length,
      }
    : null;

  const canImport =
    !!preview &&
    !!summary &&
    summary.valid > 0 &&
    summary.invalid === 0 &&
    preview.items.length <= IMPORT_MAX_CARDS &&
    !importBusy;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      setError(t("jsonFileOnly"));
      return;
    }
    if (file.size > IMPORT_MAX_SOURCE_BYTES) {
      setError(t("sourceTooLarge"));
      return;
    }

    setFileBusy(true);
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (new TextEncoder().encode(text).length > IMPORT_MAX_SOURCE_BYTES) {
        setError(t("sourceTooLarge"));
        setFileBusy(false);
        return;
      }
      setSource(text);
      setPreview(null);
      setFileBusy(false);
    };
    reader.onerror = () => {
      setError(t("fileReadFailed"));
      setFileBusy(false);
    };
    reader.readAsText(file);
  };

  const handleParse = async () => {
    if (!source.trim()) {
      setError(t("sourceRequired"));
      return;
    }
    if (new TextEncoder().encode(source).length > IMPORT_MAX_SOURCE_BYTES) {
      setError(t("sourceTooLarge"));
      return;
    }

    setError("");
    setParseBusy(true);
    try {
      const parsed = await api<ImportPreview>(`/api/decks/${deckId}/cards/parse`, {
        method: "POST",
        body: JSON.stringify({ source }),
      });
      setPreview(parsed);
    } catch (err) {
      setError(apiErrorMessage(err, language, t("parseFailed")));
    } finally {
      setParseBusy(false);
    }
  };

  const updateRow = (row: number, changes: Partial<Pick<ImportPreviewItem, "front" | "back">>) => {
    setPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => {
          if (item.row !== row) return item;
          const front = changes.front ?? item.front;
          const back = changes.back ?? item.back;
          const errors: string[] = [];
          if (item.errors.includes("back_invalid") && changes.back === undefined) {
            errors.push("back_invalid");
          }
          if (!front.trim()) {
            errors.push("front_required");
          }
          return { ...item, front, back, errors, duplicate: false };
        }),
      };
    });
  };

  const deleteRow = (row: number) => {
    setPreview((current) => {
      if (!current) return current;
      return { ...current, items: current.items.filter((item) => item.row !== row) };
    });
  };

  const addRow = () => {
    if (!preview) return;
    if (preview.items.length >= IMPORT_MAX_CARDS) {
      setError(t("tooManyCards"));
      return;
    }
    const nextRow = preview.items.reduce((max, item) => Math.max(max, item.row), 0) + 1;
    setPreview({
      ...preview,
      items: [
        ...preview.items,
        {
          row: nextRow,
          front: "",
          back: "",
          duplicate: false,
          errors: ["front_required"],
        },
      ],
    });
    setError("");
  };

  const handleImport = async () => {
    if (!preview) return;
    const rows = preview.items.map(({ front, back }) => ({ front, back }));
    if (rows.length > IMPORT_MAX_CARDS) {
      setError(t("tooManyCards"));
      return;
    }
    if (rows.some((row) => !row.front.trim())) {
      setError(t("noValidRows"));
      return;
    }

    setError("");
    setImportBusy(true);
    try {
      const result = await api<ImportResult>(`/api/decks/${deckId}/cards/import`, {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      await onImported(result);
    } catch (err) {
      setError(apiErrorMessage(err, language, t("importFailed")));
    } finally {
      setImportBusy(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("importCards")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="import-source">{t("importSource")}</FieldLabel>
            <Textarea
              id="import-source"
              className="min-h-36 max-h-56 resize-y font-mono md:max-h-72"
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setError("");
              }}
              placeholder='[{"front":"...","back":"..."}]'
              aria-label={t("importSource")}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void handleParse()} disabled={parseBusy || fileBusy || !source.trim()}>
              {parseBusy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <FileText data-icon="inline-start" />}
              {t("parse")}
            </Button>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={parseBusy || fileBusy}>
              {fileBusy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}
              {t("uploadJson")}
            </Button>
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          {preview && summary ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">
                  {summary.valid} {t("validRows")}
                </Badge>
                <Badge variant="warning">
                  {summary.duplicate} {t("duplicateRows")}
                </Badge>
                <Badge variant="destructive">
                  {summary.invalid} {t("invalidRows")}
                </Badge>
              </div>

              <div className="max-h-[45vh] min-h-0 overflow-y-auto rounded-lg border bg-panel-strong p-3">
                <div className="flex flex-col gap-3">
                  {preview.items.map((item, index) => {
                    const frontInvalid = item.errors.includes("front_required");
                    const backInvalid = item.errors.includes("back_invalid");
                    return (
                      <div key={item.row} className="rounded-lg border bg-background p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                              {index + 1}
                            </Badge>
                            {item.duplicate ? <Badge variant="warning">{t("duplicate")}</Badge> : null}
                            {frontInvalid ? <Badge variant="destructive">{t("frontRequired")}</Badge> : null}
                            {backInvalid ? <Badge variant="destructive">{t("backInvalid")}</Badge> : null}
                            {item.errors.some((code) => code !== "front_required" && code !== "back_invalid") ? (
                              <Badge variant="destructive">{t("invalidImportJson")}</Badge>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("deleteRow")}
                            title={t("deleteRow")}
                            onClick={() => deleteRow(item.row)}
                          >
                            <Trash2 />
                          </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field data-invalid={frontInvalid}>
                            <FieldLabel htmlFor={`import-front-${item.row}`}>{t("front")}</FieldLabel>
                            <Textarea
                              id={`import-front-${item.row}`}
                              className="min-h-28 max-h-52 resize-y"
                              value={item.front}
                              onChange={(event) => updateRow(item.row, { front: event.target.value })}
                              aria-invalid={frontInvalid}
                            />
                            {frontInvalid ? <FieldError>{t("frontRequired")}</FieldError> : null}
                          </Field>
                          <Field data-invalid={backInvalid}>
                            <FieldLabel htmlFor={`import-back-${item.row}`}>{t("backSide")}</FieldLabel>
                            <Textarea
                              id={`import-back-${item.row}`}
                              className="min-h-28 max-h-52 resize-y"
                              value={item.back}
                              onChange={(event) => updateRow(item.row, { back: event.target.value })}
                              aria-invalid={backInvalid}
                            />
                            {backInvalid ? <FieldError>{t("backInvalid")}</FieldError> : null}
                          </Field>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {preview ? (
          <DialogFooter className="border-t">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={addRow} disabled={importBusy || preview.items.length >= IMPORT_MAX_CARDS}>
                <Plus data-icon="inline-start" />
                {t("addRow")}
              </Button>
              <Button type="button" onClick={() => void handleImport()} disabled={!canImport}>
                {importBusy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}
                {t("importRows")}
              </Button>
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
