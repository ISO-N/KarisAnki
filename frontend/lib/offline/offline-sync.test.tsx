// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiCacheKey, listApiCacheEntries, writeApiCache } from "../api-cache";
import { useOfflineSession } from "./session-sync";
import {
  countConflictedOutboxForSession,
  createOutboxEntry,
  listPendingOutboxForSession,
} from "./outbox";
import { loadStoredSession, saveStoredSession } from "./session-store";
import { resetSyncEngineForTest, subscribeSyncEngine } from "./sync-engine";
import { sessionKey, toStoredSession } from "./types";
import { makeCard } from "../../test/factories";

const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.code = code;
      this.status = status;
    }
  }

  return {
    api: vi.fn(),
    MockApiError,
    online: true,
    user: { id: 1 },
    t: vi.fn((key: string) => key),
  };
});

vi.mock("@/lib/api", () => ({
  api: mocks.api,
  ApiError: mocks.MockApiError,
  apiErrorMessage: (error: unknown, _language: string, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  clientTimezone: () => "UTC",
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    language: "EN",
    t: mocks.t,
  }),
}));

vi.mock("@/lib/network", () => ({
  useNetworkStatus: () => mocks.online,
  isOnline: () => true,
}));

let sequence = 9100;

async function seedOfflineSession(deckId: number) {
  const key = sessionKey(deckId, "LEARN");
  const session = {
    deckId,
    type: "LEARN" as const,
    timezone: "UTC",
    order: [1],
    cards: [makeCard(1, { deckId, status: "new" })],
    total: 1,
  };
  await saveStoredSession(toStoredSession(session));
  const entry = await createOutboxEntry({
    sessionKey: key,
    cardId: 1,
    result: "FAMILIAR",
    queueType: "LEARN",
    timezone: "UTC",
    stateVersion: 1,
  });
  return { key, clientAnswerId: entry.clientAnswerId };
}

async function seedRelearnSession(deckId: number) {
  const key = sessionKey(deckId, "LEARN");
  const session = {
    deckId,
    type: "LEARN" as const,
    timezone: "UTC",
    order: [1],
    cards: [makeCard(1, { deckId, status: "relearn", relearnMode: "BLURRY", relearnCorrectCount: 0 })],
    total: 1,
  };
  await saveStoredSession(toStoredSession(session));
  const entry = await createOutboxEntry({
    sessionKey: key,
    cardId: 1,
    result: "FAMILIAR",
    queueType: "LEARN",
    timezone: "UTC",
    stateVersion: 1,
    reinserted: true,
  });
  return { key, clientAnswerId: entry.clientAnswerId };
}

beforeEach(() => {
  mocks.api.mockReset();
  resetSyncEngineForTest();
  mocks.t.mockClear();
  mocks.online = true;
});

describe("offline session sync", () => {
  it("restores a local session and syncs accepted answers in a batch", async () => {
    const deckId = sequence++;
    const { key, clientAnswerId } = await seedOfflineSession(deckId);
    mocks.api.mockResolvedValue({
      results: [
        {
          cardId: 1,
          clientAnswerId,
          accepted: true,
          code: "accepted",
          nextCardId: null,
          completed: true,
          requiresConfirmation: false,
        },
      ],
    });

    const { result } = renderHook(() => useOfflineSession(deckId, "LEARN"));
    await waitFor(() => expect(result.current.phase).toBe("resume"));

    await result.current.resume();

    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(
        "/api/answer/batch",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(result.current.error).toBe(""));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(await listPendingOutboxForSession(key)).toHaveLength(0);
  });

  it("keeps accepted relearn chain available after outbox removal", async () => {
    const deckId = sequence++;
    const { key, clientAnswerId } = await seedRelearnSession(deckId);
    mocks.api
      .mockResolvedValueOnce({
        results: [
          {
            cardId: 1,
            clientAnswerId,
            accepted: true,
            code: "accepted",
            nextCardId: 1,
            completed: false,
            requiresConfirmation: false,
          },
        ],
      })
      .mockImplementation(async (_path: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        return {
          results: body.items.map((item: { clientAnswerId: string }) => ({
            cardId: 1,
            clientAnswerId: item.clientAnswerId,
            accepted: false,
            code: "internal_error",
            nextCardId: null,
            completed: false,
            requiresConfirmation: false,
          })),
        };
      });

    const { result } = renderHook(() => useOfflineSession(deckId, "LEARN"));
    await waitFor(() => expect(result.current.phase).toBe("resume"));

    let submitAfterAccept: Promise<void> | undefined;
    let resolveSyncSettled: (() => void) | undefined;
    const syncSettled = new Promise<void>((resolve) => {
      resolveSyncSettled = resolve;
    });
    const unsubscribe = subscribeSyncEngine((event) => {
      if (event.key !== key) return;
      if (event.status === "error" || event.status === "conflict" || event.status === "pending"
        || event.status === "synced" || event.status === "offline") {
        resolveSyncSettled?.();
      }
      if (event.acceptedAnswer?.clientAnswerId === clientAnswerId) {
        submitAfterAccept = result.current.submit("FAMILIAR");
      }
    });

    try {
      await result.current.resume();

      await waitFor(() => expect(submitAfterAccept).toBeDefined());
      await submitAfterAccept!;
      await syncSettled;

      const pending = await listPendingOutboxForSession(key);
      expect(pending.some((entry) => entry.clientAnswerId !== clientAnswerId
        && entry.previousClientAnswerId === clientAnswerId)).toBe(true);
      expect(result.current.session?.lastClientAnswerIds[String(1)]).toBe(clientAnswerId);
      expect(result.current.session?.order).toEqual([1]);
      expect(result.current.session?.cards[0]?.status).toBe("relearn");
    } finally {
      unsubscribe();
    }
  });

  it("invalidates deck and statistics caches after accepted answers", async () => {
    const deckId = sequence++;
    const { clientAnswerId } = await seedOfflineSession(deckId);
    const deckPath = `/api/decks/${deckId}`;
    await writeApiCache(apiCacheKey(1, "GET", deckPath), 1, "GET", deckPath, { deck: true });
    await writeApiCache(
      apiCacheKey(1, "GET", "/api/statistics"),
      1,
      "GET",
      "/api/statistics",
      { stats: true },
    );
    mocks.api.mockResolvedValue({
      results: [
        {
          cardId: 1,
          clientAnswerId,
          accepted: true,
          code: "accepted",
          nextCardId: null,
          completed: true,
          requiresConfirmation: false,
        },
      ],
    });

    const { result } = renderHook(() => useOfflineSession(deckId, "LEARN"));
    await waitFor(() => expect(result.current.phase).toBe("resume"));
    await result.current.resume();
    await waitFor(() => expect(result.current.phase).toBe("done"));

    const remaining = await listApiCacheEntries();
    expect(remaining.some((entry) => entry.pathname === deckPath)).toBe(false);
    expect(remaining.some((entry) => entry.pathname === "/api/statistics")).toBe(false);
  });

  it("marks conflicting batch entries and exposes the conflict phase", async () => {
    const deckId = sequence++;
    const { key, clientAnswerId } = await seedOfflineSession(deckId);
    mocks.api.mockResolvedValue({
      results: [
        {
          cardId: 1,
          clientAnswerId,
          accepted: false,
          code: "queue_refresh",
          nextCardId: null,
          completed: false,
          requiresConfirmation: false,
        },
      ],
    });

    const { result } = renderHook(() => useOfflineSession(deckId, "LEARN"));
    await waitFor(() => expect(result.current.phase).toBe("resume"));
    await result.current.resume();

    await waitFor(() => expect(result.current.phase).toBe("conflict"));
    expect(await countConflictedOutboxForSession(key)).toBe(1);
  });

  it("retains pending answers when a batch sync fails", async () => {
    const deckId = sequence++;
    const { key } = await seedOfflineSession(deckId);
    mocks.api.mockRejectedValue(new TypeError("offline"));

    const { result } = renderHook(() => useOfflineSession(deckId, "LEARN"));
    await waitFor(() => expect(result.current.phase).toBe("resume"));
    await result.current.resume();

    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith("/api/answer/batch", expect.anything()),
    );
    await waitFor(() => expect(result.current.syncStatus).toBe("pending"));
    expect(result.current.pendingCount).toBe(1);
    expect(await listPendingOutboxForSession(key)).toHaveLength(1);
  });

  it("preserves accepted chain when refreshing with pending outbox", async () => {
    const deckId = sequence++;
    const key = sessionKey(deckId, "LEARN");
    const session = {
      deckId,
      type: "LEARN" as const,
      timezone: "UTC",
      order: [1],
      cards: [makeCard(1, { deckId, status: "relearn", relearnMode: "BLURRY", relearnCorrectCount: 0 })],
      total: 1,
    };
    const stored = toStoredSession(session);
    stored.lastClientAnswerIds = { "1": "accepted-1" };
    await saveStoredSession(stored);
    await createOutboxEntry({
      sessionKey: key,
      cardId: 1,
      result: "FAMILIAR",
      queueType: "LEARN",
      timezone: "UTC",
      stateVersion: 1,
      previousClientAnswerId: "accepted-1",
      reinserted: true,
    });
    mocks.api.mockImplementation(async (path: string) => {
      if (path.startsWith(`/api/decks/${deckId}/session`)) return { ...session };
      throw new Error(`Unexpected request: ${path}`);
    });

    const { result } = renderHook(() => useOfflineSession(deckId, "LEARN"));
    await waitFor(() => expect(result.current.phase).toBe("resume"));

    await result.current.refresh();

    const restored = await loadStoredSession(key);
    expect(restored?.lastClientAnswerIds["1"]).toBe("accepted-1");
    await waitFor(() => expect(result.current.session?.lastClientAnswerIds["1"]).toBe("accepted-1"));
  });

});
