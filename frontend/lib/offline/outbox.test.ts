import { describe, expect, it } from "vitest";
import { chunkOutboxEntries, sortOutboxEntries } from "./outbox";
import type { OutboxEntry } from "./types";

function entry(id: string, createdAt: number): OutboxEntry {
  return {
    clientAnswerId: id,
    sessionKey: "1:LEARN",
    cardId: 1,
    result: "FAMILIAR",
    queueType: "LEARN",
    timezone: "UTC",
    stateVersion: 1,
    previousClientAnswerId: null,
    graduate: false,
    confirmForget: false,
    status: "PENDING",
    createdAt,
    updatedAt: createdAt,
    attempts: 0,
  };
}

describe("sortOutboxEntries", () => {
  it("orders pending entries by creation time", () => {
    const entries = [entry("c", 30), entry("a", 10), entry("b", 20)];
    expect(sortOutboxEntries(entries).map((item) => item.clientAnswerId)).toEqual(["a", "b", "c"]);
  });

  it("uses id as a stable tie breaker", () => {
    const entries = [entry("b", 10), entry("a", 10)];
    expect(sortOutboxEntries(entries).map((item) => item.clientAnswerId)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const entries = [entry("b", 2), entry("a", 1)];
    sortOutboxEntries(entries);
    expect(entries.map((item) => item.clientAnswerId)).toEqual(["b", "a"]);
  });
});

describe("chunkOutboxEntries", () => {
  it("splits pending entries into batches of twenty", () => {
    const entries = Array.from({ length: 45 }, (_, index) => entry(`id-${index}`, index));
    const chunks = chunkOutboxEntries(entries);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(20);
    expect(chunks[1]).toHaveLength(20);
    expect(chunks[2]).toHaveLength(5);
  });

  it("honors an explicit batch size", () => {
    const entries = [entry("a", 1), entry("b", 2), entry("c", 3)];
    expect(chunkOutboxEntries(entries, 2).map((chunk) => chunk.length)).toEqual([2, 1]);
  });
});
