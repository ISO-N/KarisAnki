// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DecksPage from "../app/decks/page";
import DeckDetailPage from "../app/decks/[id]/page";
import { makeCard, makeDeck } from "../test/factories";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  useApiData: vi.fn(),
  useAuth: vi.fn(),
  refresh: vi.fn(),
  params: { id: "1" },
  data: null as unknown,
  loading: false,
  error: "",
  lastOptions: null as { path: string; query?: Record<string, unknown> } | null,
}));

vi.mock("@/lib/api", () => ({
  api: mocks.api,
  apiErrorMessage: (error: unknown, _language: string, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  clientTimezone: () => "UTC",
}));

vi.mock("@/lib/use-api-data", () => ({
  useApiData: (options: { path: string; query?: Record<string, unknown> }) => {
    mocks.lastOptions = options;
    return {
      data: mocks.data,
      loading: mocks.loading,
      error: mocks.error,
      refresh: mocks.refresh,
    };
  },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: 1 } }),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    language: "EN",
    t: (key: string) => key,
    setLanguage: vi.fn(),
  }),
}));

vi.mock("@/components/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => mocks.params,
  usePathname: () => "/decks",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

function setupUseApiData() {
  mocks.useApiData.mockImplementation((options: { path: string; query?: Record<string, unknown> }) => {
    mocks.lastOptions = options;
    return {
      data: mocks.data,
      loading: mocks.loading,
      error: mocks.error,
      refresh: mocks.refresh,
    };
  });
}

beforeEach(() => {
  mocks.api.mockReset();
  mocks.refresh.mockReset();
  mocks.data = [];
  mocks.loading = false;
  mocks.error = "";
  mocks.lastOptions = null;
  setupUseApiData();
});

describe("DecksPage", () => {
  it("creates a deck through the create dialog", async () => {
    const user = userEvent.setup();
    mocks.data = [makeDeck(1)];
    mocks.api.mockResolvedValue(makeDeck(2, "Created"));

    render(<DecksPage />);

    await user.click(screen.getAllByRole("button", { name: "createDeck" })[0]);
    await user.type(screen.getByLabelText("deckName"), "Created");
    await user.click(screen.getAllByRole("button", { name: "createDeck" }).at(-1)!);

    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(
        "/api/decks",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Created" }) }),
      ),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("renames a deck through the rename dialog", async () => {
    const user = userEvent.setup();
    mocks.data = [makeDeck(1, "Alpha")];
    mocks.api.mockResolvedValue(makeDeck(1, "Beta"));

    render(<DecksPage />);

    await user.click(screen.getByRole("button", { name: "renameDeck" }));
    const input = screen.getByDisplayValue("Alpha");
    await user.clear(input);
    await user.type(input, "Beta");
    await user.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(
        "/api/decks/1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Beta" }) }),
      ),
    );
  });

  it("resets and deletes decks through confirm dialogs", async () => {
    const user = userEvent.setup();
    mocks.data = [makeDeck(1)];

    render(<DecksPage />);

    await user.click(screen.getByRole("button", { name: "resetDeck" }));
    await user.click(screen.getByRole("button", { name: "confirm" }));
    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(
        "/api/decks/1/reset?timezone=UTC",
        expect.objectContaining({ method: "POST" }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "deleteDeck" }));
    await user.click(screen.getByRole("button", { name: "confirm" }));
    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(
        "/api/decks/1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("renders empty and error states", async () => {
    const { unmount } = render(<DecksPage />);
    expect(screen.getByText("emptyDecks")).toBeInTheDocument();
    unmount();

    mocks.error = "offline";
    render(<DecksPage />);
    expect(screen.getByText("offline")).toBeInTheDocument();
  });
});

describe("DeckDetailPage", () => {
  it("updates the deck detail query for search and pagination", async () => {
    const user = userEvent.setup();
    mocks.data = {
      deck: makeDeck(1),
      cards: { items: [makeCard(1)], total: 120, page: 0, pageSize: 50 },
    };

    render(<DeckDetailPage />);

    const search = screen.getByLabelText("searchCards");
    await user.type(search, "front");
    expect(mocks.lastOptions?.query).toMatchObject({ q: "front" });

    await user.click(screen.getByRole("button", { name: "nextPage" }));
    expect(mocks.lastOptions?.query).toMatchObject({ page: 1 });
  });

  it("filters cards by status", async () => {
    const user = userEvent.setup();
    mocks.data = {
      deck: makeDeck(1),
      cards: { items: [makeCard(1)], total: 1, page: 0, pageSize: 50 },
    };

    render(<DeckDetailPage />);

    await user.click(screen.getByLabelText("allStatus"));
    await user.click(await screen.findByRole("option", { name: "statusNew" }));

    expect(mocks.lastOptions?.query).toMatchObject({ status: "new" });
  });

  it("renders empty search results and errors", async () => {
    mocks.data = {
      deck: makeDeck(1),
      cards: { items: [], total: 0, page: 0, pageSize: 50 },
    };

    const { unmount } = render(<DeckDetailPage />);
    expect(screen.getAllByText("emptyCards").length).toBeGreaterThan(0);
    unmount();

    mocks.error = "boom";
    render(<DeckDetailPage />);
    expect(screen.getAllByText("boom").length).toBeGreaterThan(0);
  });
});
