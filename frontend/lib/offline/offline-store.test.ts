import { describe, expect, it } from "vitest";
import type { StudySession } from "@/lib/types";
import {
  clearConflictedOutboxForSession,
  clearOutboxForSession,
  countConflictedOutboxForSession,
  countPendingOutbox,
  createOutboxEntry,
  listPendingOutbox,
  listPendingOutboxChunks,
  markOutboxAccepted,
  markOutboxConflicted,
} from "./outbox";
import { openDatabase, requestResult, transactionDone } from "./idb";
import { clearStoredSession, listStoredSessions, loadStoredSession, saveStoredSession } from "./session-store";
import { fromStoredSession, sessionKey, toStoredSession } from "./types";
import { makeCard } from "../../test/factories";

describe("offline outbox persistence", () => {
  it("persists pending entries, batches them, accepts and clears them", async () => {
    const key = sessionKey(9001, "LEARN");
    const first = await createOutboxEntry({
      sessionKey: key,
      cardId: 1,
      result: "FAMILIAR",
      queueType: "LEARN",
      timezone: "UTC",
      stateVersion: 1,
    });
    const second = await createOutboxEntry({
      sessionKey: key,
      cardId: 2,
      result: "BLURRY",
      queueType: "LEARN",
      timezone: "UTC",
      stateVersion: 1,
    });

    expect(await countPendingOutbox(key)).toBe(2);
    expect((await listPendingOutboxChunks(1)).flat().map((entry) => entry.clientAnswerId)).toEqual([
      first.clientAnswerId,
      second.clientAnswerId,
    ]);

    await markOutboxAccepted(first.clientAnswerId);
    expect(await countPendingOutbox(key)).toBe(1);

    await markOutboxConflicted(second.clientAnswerId);
    expect(await countConflictedOutboxForSession(key)).toBe(1);
    expect(await countPendingOutbox(key)).toBe(0);

    await clearConflictedOutboxForSession(key);
    expect(await countConflictedOutboxForSession(key)).toBe(0);
  });

  it("clears all entries for a session", async () => {
    const key = sessionKey(9002, "REVIEW");
    await createOutboxEntry({
      sessionKey: key,
      cardId: 1,
      result: "FAMILIAR",
      queueType: "REVIEW",
      timezone: "UTC",
      stateVersion: 1,
    });
    await createOutboxEntry({
      sessionKey: key,
      cardId: 2,
      result: "FORGOT",
      queueType: "REVIEW",
      timezone: "UTC",
      stateVersion: 1,
    });

    await clearOutboxForSession(key);
    expect(await listPendingOutbox()).toHaveLength(0);
  });
});

describe("offline session snapshot restore", () => {
  it("returns an empty list when no sessions are stored", async () => {
    const db = await openDatabase();
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");
    const existing = (await requestResult(store.getAll())) as Array<{ key: string }>;
    for (const entry of existing) store.delete(entry.key);
    await transactionDone(transaction);

    expect(await listStoredSessions()).toEqual([]);
  });

  it("filters malformed stored sessions from the list", async () => {
    const key = sessionKey(9101, "LEARN");
    await saveStoredSession(toStoredSession({
      deckId: 9101,
      type: "LEARN",
      timezone: "UTC",
      order: [1],
      cards: [makeCard(1, { deckId: 9101 })],
      total: 1,
    }));

    const db = await openDatabase();
    const transaction = db.transaction("sessions", "readwrite");
    transaction.objectStore("sessions").put({
      key: "broken",
      deckId: "invalid",
      type: "LEARN",
      timezone: "UTC",
      order: [],
      cards: [],
      total: 1,
      completedCount: 0,
    });
    await transactionDone(transaction);

    const sessions = await listStoredSessions();
    expect(sessions.some((session) => session.key === key)).toBe(true);
    expect(sessions.some((session) => session.key === "broken")).toBe(false);

    await clearStoredSession(key);
  });

  it("round-trips a study session snapshot", async () => {
    const key = sessionKey(9003, "LEARN");
    const session: StudySession = {
      deckId: 9003,
      type: "LEARN",
      timezone: "UTC",
      order: [1, 2],
      cards: [
        {
          id: 1,
          deckId: 9003,
          front: "A",
          back: "B",
          position: 1,
          status: "new",
          stage: -1,
          relearnMode: "NONE",
          relearnCorrectCount: 0,
          dueDate: null,
          stateVersion: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      total: 2,
    };

    await saveStoredSession(toStoredSession(session));
    const restored = await loadStoredSession(key);

    expect(restored?.key).toBe(key);
    expect(restored?.order).toEqual([1, 2]);
    expect(restored?.cards[0].front).toBe("A");

    await clearStoredSession(key);
    expect(await loadStoredSession(key)).toBeNull();
  });

  it("rejects malformed stored snapshots", () => {
    expect(fromStoredSession(null)).toBeNull();
    expect(fromStoredSession({ key: "x" })).toBeNull();
    expect(
      fromStoredSession({
        key: "1:LEARN",
        deckId: 1,
        type: "LEARN",
        timezone: "UTC",
        order: [1],
        cards: [],
        total: 1,
        completedCount: 0,
        lastClientAnswerIds: {},
      }),
    ).not.toBeNull();
  });
});
