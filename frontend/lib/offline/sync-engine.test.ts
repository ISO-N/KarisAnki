import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDatabase, transactionDone } from "./idb";
import {
  countPendingOutbox,
  createOutboxEntry,
} from "./outbox";
import { loadStoredSession, saveStoredSession } from "./session-store";
import {
  resetSyncEngineForTest,
  subscribeSyncEngine,
  syncAllPending,
  syncSession,
  type SyncEngineStatus,
} from "./sync-engine";
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
  };
});

vi.mock("@/lib/api", () => ({
  api: mocks.api,
  ApiError: mocks.MockApiError,
}));

vi.mock("@/lib/network", () => ({
  isOnline: () => true,
}));

let sequence = 9300;

async function seedSession(deckId: number, order = [1]) {
  const key = sessionKey(deckId, "LEARN");
  await saveStoredSession(
    toStoredSession({
      deckId,
      type: "LEARN",
      timezone: "UTC",
      order,
      cards: order.map((cardId) => makeCard(cardId, { deckId })),
      total: order.length,
    }),
  );
  return key;
}

async function clearAllStores() {
  const db = await openDatabase();
  const transaction = db.transaction(["sessions", "outbox", "api-cache"], "readwrite");
  transaction.objectStore("sessions").clear();
  transaction.objectStore("outbox").clear();
  transaction.objectStore("api-cache").clear();
  await transactionDone(transaction);
}

function acceptedResult(clientAnswerId: string, completed: boolean) {
  return {
    cardId: 1,
    clientAnswerId,
    accepted: true,
    code: "accepted",
    nextCardId: completed ? null : null,
    completed,
    requiresConfirmation: false,
  };
}

beforeEach(() => {
  resetSyncEngineForTest();
  mocks.api.mockReset();
});

afterEach(async () => {
  await clearAllStores();
});

describe("sync engine", () => {
  it("drains entries created while a batch is in flight", async () => {
    const deckId = sequence++;
    const key = await seedSession(deckId);
    const first = await createOutboxEntry({
      sessionKey: key,
      cardId: 1,
      result: "FAMILIAR",
      queueType: "LEARN",
      timezone: "UTC",
      stateVersion: 1,
    });

    let secondId = "";
    mocks.api
      .mockImplementationOnce(async () => {
        const second = await createOutboxEntry({
          sessionKey: key,
          cardId: 1,
          result: "FAMILIAR",
          queueType: "LEARN",
          timezone: "UTC",
          stateVersion: 1,
          previousClientAnswerId: first.clientAnswerId,
        });
        secondId = second.clientAnswerId;
        return { results: [acceptedResult(first.clientAnswerId, false)] };
      })
      .mockImplementationOnce(async () => ({
        results: [acceptedResult(secondId, true)],
      }));

    const outcome = await syncSession(key, 1);

    expect(outcome).toBe("synced");
    expect(mocks.api).toHaveBeenCalledTimes(2);
    expect(await countPendingOutbox(key)).toBe(0);
    expect(await loadStoredSession(key)).toBeNull();
  });

  it("keeps the session and reports pending when the queue is complete but outbox still has entries", async () => {
    const deckId = sequence++;
    const key = await seedSession(deckId);
    const first = await createOutboxEntry({
      sessionKey: key,
      cardId: 1,
      result: "FAMILIAR",
      queueType: "LEARN",
      timezone: "UTC",
      stateVersion: 1,
    });

    const statuses: SyncEngineStatus[] = [];
    const unsubscribe = subscribeSyncEngine((event) => {
      if (event.key === key) statuses.push(event.status);
    });

    mocks.api
      .mockImplementationOnce(async () => {
        await createOutboxEntry({
          sessionKey: key,
          cardId: 1,
          result: "FAMILIAR",
          queueType: "LEARN",
          timezone: "UTC",
          stateVersion: 1,
          previousClientAnswerId: first.clientAnswerId,
        });
        return { results: [acceptedResult(first.clientAnswerId, false)] };
      })
      .mockRejectedValueOnce(new TypeError("offline"));

    const outcome = await syncSession(key, 1);
    unsubscribe();

    expect(outcome).toBe("pending");
    expect(statuses).not.toContain("synced");
    expect(await loadStoredSession(key)).not.toBeNull();
    expect(await countPendingOutbox(key)).toBe(1);
  });

  it("syncs all pending sessions from outside the study page", async () => {
    const deckId = sequence++;
    const key = await seedSession(deckId);
    const entry = await createOutboxEntry({
      sessionKey: key,
      cardId: 1,
      result: "FAMILIAR",
      queueType: "LEARN",
      timezone: "UTC",
      stateVersion: 1,
    });
    mocks.api.mockResolvedValue({ results: [acceptedResult(entry.clientAnswerId, true)] });

    const outcomes = await syncAllPending(1);

    expect(outcomes).toEqual(["synced"]);
    expect(await loadStoredSession(key)).toBeNull();
    expect(await countPendingOutbox(key)).toBe(0);
  });

  it("serializes sync calls through the shared lock", async () => {
    const deckId = sequence++;
    const key = await seedSession(deckId);
    const entry = await createOutboxEntry({
      sessionKey: key,
      cardId: 1,
      result: "FAMILIAR",
      queueType: "LEARN",
      timezone: "UTC",
      stateVersion: 1,
    });

    let release: (() => void) | undefined;
    let active = 0;
    let maxActive = 0;
    mocks.api.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      active -= 1;
      return { results: [acceptedResult(entry.clientAnswerId, true)] };
    });

    const first = syncSession(key, 1);
    const second = syncSession(key, 1);
    await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
    release?.();

    const outcomes = await Promise.all([first, second]);

    expect(maxActive).toBe(1);
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual(["synced", "synced"]);
  });
});
