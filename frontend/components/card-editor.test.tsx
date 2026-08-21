// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardEditor } from "./card-editor";
import { ImportCards } from "./import-cards";
import { IMPORT_MAX_SOURCE_BYTES } from "../lib/api";
import { makeCard } from "../test/factories";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  onSaved: vi.fn(),
  onOpenChange: vi.fn(),
  onImported: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: mocks.api,
  apiErrorMessage: (error: unknown, _language: string, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  IMPORT_MAX_SOURCE_BYTES: 2 * 1024 * 1024,
  IMPORT_MAX_CARDS: 5000,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    language: "EN",
    t: (key: string) => key,
  }),
}));

beforeEach(() => {
  mocks.api.mockReset();
  mocks.onSaved.mockReset();
  mocks.onOpenChange.mockReset();
  mocks.onImported.mockReset();
});

describe("CardEditor", () => {
  it("rejects an empty front and saves a valid card", async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue(makeCard(1, { front: "Question", back: "Answer" }));

    render(
      <CardEditor deckId={1} open onOpenChange={mocks.onOpenChange} onSaved={mocks.onSaved} />,
    );

    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();

    await user.type(screen.getByLabelText("front"), "Question");
    await user.type(screen.getByLabelText("backSide"), "Answer");
    await user.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(
        "/api/decks/1/cards",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ front: "Question", back: "Answer" }),
        }),
      ),
    );
    expect(mocks.onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ front: "Question", back: "Answer" }),
    );
  });
});

describe("ImportCards", () => {
  const validPreview = {
    items: [{ row: 1, front: "A", back: "B", duplicate: false, errors: [] as string[] }],
    total: 1,
    validCount: 1,
    duplicateCount: 0,
    invalidCount: 0,
  };

  function renderImport() {
    return render(
      <ImportCards
        deckId={1}
        open
        onOpenChange={mocks.onOpenChange}
        onImported={mocks.onImported}
      />,
    );
  }

  it("parses, edits, adds and deletes preview rows", async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue(validPreview);
    renderImport();

    fireEvent.change(screen.getByLabelText("importSource"), {
      target: { value: '[{"front":"A","back":"B"}]' },
    });
    await user.click(screen.getByRole("button", { name: "parse" }));

    const front = await screen.findByDisplayValue("A");
    await user.clear(front);
    await user.type(front, "Updated");
    expect(screen.getByDisplayValue("Updated")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "addRow" }));
    expect(screen.getAllByRole("button", { name: "deleteRow" })).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "deleteRow" })[1]);
    expect(screen.getAllByRole("button", { name: "deleteRow" })).toHaveLength(1);
  });

  it("keeps the import action disabled while a row has no front", async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue({
      items: [{ row: 1, front: "", back: "B", duplicate: false, errors: ["front_required"] }],
      total: 1,
      validCount: 0,
      duplicateCount: 0,
      invalidCount: 1,
    });
    renderImport();

    fireEvent.change(screen.getByLabelText("importSource"), {
      target: { value: '[{"front":"","back":"B"}]' },
    });
    await user.click(screen.getByRole("button", { name: "parse" }));

    expect(await screen.findByRole("button", { name: "importRows" })).toBeDisabled();
  });

  it("rejects files over the shared source size limit", () => {
    renderImport();
    const file = new File(["{}"], "large.json", { type: "application/json" });
    Object.defineProperty(file, "size", { value: IMPORT_MAX_SOURCE_BYTES + 1 });

    fireEvent.change(document.querySelector("input[type='file']")!, { target: { files: [file] } });

    expect(screen.getByRole("alert")).toHaveTextContent("sourceTooLarge");
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("reports the import result through onImported", async () => {
    const user = userEvent.setup();
    mocks.api
      .mockResolvedValueOnce(validPreview)
      .mockResolvedValueOnce({ created: 1, skippedDuplicates: 0 });

    renderImport();
    fireEvent.change(screen.getByLabelText("importSource"), {
      target: { value: '[{"front":"A","back":"B"}]' },
    });
    await user.click(screen.getByRole("button", { name: "parse" }));
    await user.click(await screen.findByRole("button", { name: "importRows" }));

    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(
        "/api/decks/1/cards/import",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ rows: [{ front: "A", back: "B" }] }),
        }),
      ),
    );
    expect(mocks.onImported).toHaveBeenCalledWith({ created: 1, skippedDuplicates: 0 });
  });
});
