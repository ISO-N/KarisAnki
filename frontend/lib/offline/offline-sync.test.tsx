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
import { saveStoredSession } from "./session-store";
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

beforeEach(() => {
  mocks.api.mockReset();
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

    await waitFor(() => expect(result.current.syncStatus).toBe("pending"));
    expect(result.current.pendingCount).toBe(1);
    expect(await listPendingOutboxForSession(key)).toHaveLength(1);
    expect(mocks.api).toHaveBeenCalledWith("/api/answer/batch", expect.anything());
  });

});
