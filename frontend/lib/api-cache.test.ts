import { describe, expect, it } from "vitest";
import {
  apiCacheKey,
  entryMatchesScope,
  invalidateApiCache,
  listApiCacheEntries,
  writeApiCache,
  type ApiCacheEntry,
} from "./api-cache";

function entry(overrides: Partial<ApiCacheEntry> = {}): ApiCacheEntry {
  return {
    key: "1:GET:/api/decks",
    userId: 1,
    method: "GET",
    pathname: "/api/decks",
    query: {},
    data: {},
    storedAt: Date.now(),
    ...overrides,
  };
}

describe("apiCacheKey", () => {
  it("scopes by user, method, path and query", () => {
    expect(apiCacheKey(7, "GET", "/api/decks", { timezone: "UTC", page: 0 })).toBe(
      "7:GET:/api/decks:page=0&timezone=UTC",
    );
  });

  it("normalizes omitted query values", () => {
    expect(apiCacheKey(7, "GET", "/api/decks", { q: undefined, status: "" })).toBe(
      "7:GET:/api/decks",
    );
  });
});

describe("IndexedDB invalidation", () => {
  it("removes all cache entries for a user when user scoped invalidation runs", async () => {
    const userPath = "/api/auth/me";
    const decksPath = "/api/decks";
    await writeApiCache(apiCacheKey(1, "GET", userPath), 1, "GET", userPath, { user: 1 });
    await writeApiCache(apiCacheKey(1, "GET", decksPath), 1, "GET", decksPath, [1]);
    await writeApiCache(apiCacheKey(2, "GET", decksPath), 2, "GET", decksPath, [2]);

    await invalidateApiCache({ type: "user", userId: 1 });

    const entries = await listApiCacheEntries();
    expect(entries.map((entry) => entry.userId)).toEqual([2]);
    expect(entries[0].pathname).toBe(decksPath);
  });

  it("invalidates deck-scoped overviews, cards, sessions, stats and deck list", async () => {
    const paths = [
      "/api/decks/5",
      "/api/decks/5/cards",
      "/api/decks/5/session",
      "/api/statistics",
      "/api/decks",
    ];
    for (const path of paths) {
      await writeApiCache(apiCacheKey(1, "GET", path), 1, "GET", path, { path });
    }
    await writeApiCache(apiCacheKey(1, "GET", "/api/decks/6"), 1, "GET", "/api/decks/6", { other: true });

    await invalidateApiCache({ type: "deck", userId: 1, deckId: 5 });

    const remaining = (await listApiCacheEntries())
      .filter((entry) => entry.userId === 1)
      .map((entry) => entry.pathname)
      .sort();
    expect(remaining).toEqual(["/api/decks/6", "/api/statistics"].sort());
  });
});

describe("entryMatchesScope", () => {
  it("clears all user entries for user scoped invalidation", () => {
    const userEntry = entry({ userId: 1, pathname: "/api/auth/me" });
    const otherUser = entry({ userId: 2, pathname: "/api/decks" });
    expect(entryMatchesScope(userEntry, { type: "user", userId: 1 })).toBe(true);
    expect(entryMatchesScope(otherUser, { type: "user", userId: 1 })).toBe(false);
  });

  it("invalidates deck overview, cards, sessions, stats and deck list", () => {
    const overview = entry({ pathname: "/api/decks/5" });
    const cards = entry({ pathname: "/api/decks/5/cards", query: { page: "1" } });
    const session = entry({ pathname: "/api/decks/5/session", query: { type: "REVIEW" } });
    const stats = entry({ pathname: "/api/statistics", query: { deckId: "5" } });
    const allStats = entry({ pathname: "/api/statistics" });
    const deckList = entry({ pathname: "/api/decks" });
    const otherDeck = entry({ pathname: "/api/decks/6" });

    const scope = { type: "deck" as const, userId: 1, deckId: 5 };
    expect(entryMatchesScope(overview, scope)).toBe(true);
    expect(entryMatchesScope(cards, scope)).toBe(true);
    expect(entryMatchesScope(session, scope)).toBe(true);
    expect(entryMatchesScope(stats, scope)).toBe(true);
    expect(entryMatchesScope(allStats, scope)).toBe(false);
    expect(entryMatchesScope(deckList, scope)).toBe(true);
    expect(entryMatchesScope(otherDeck, scope)).toBe(false);
  });

  it("supports stats and session scoped invalidation", () => {
    const statsAll = entry({ pathname: "/api/statistics" });
    const statsDeck = entry({ pathname: "/api/statistics", query: { deckId: "9" } });
    const session = entry({ pathname: "/api/decks/3/session", query: { type: "LEARN" } });
    const reviewSession = entry({ pathname: "/api/decks/3/session", query: { type: "REVIEW" } });

    expect(entryMatchesScope(statsAll, { type: "stats", userId: 1 })).toBe(true);
    expect(entryMatchesScope(statsDeck, { type: "stats", userId: 1, deckId: 9 })).toBe(true);
    expect(entryMatchesScope(statsAll, { type: "stats", userId: 1, deckId: 9 })).toBe(false);
    expect(entryMatchesScope(session, { type: "session", userId: 1, deckId: 3, queueType: "LEARN" })).toBe(true);
    expect(entryMatchesScope(reviewSession, { type: "session", userId: 1, deckId: 3, queueType: "LEARN" })).toBe(false);
  });
});
