// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiCacheKey, writeApiCache } from "./api-cache";
import { useApiData, type UseApiDataOptions } from "./use-api-data";
import { makeUser } from "../test/factories";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  user: { id: 1, email: "one@example.com" },
  t: vi.fn((key: string) => key),
}));

vi.mock("@/lib/api", () => ({
  api: mocks.api,
  apiErrorMessage: (error: unknown, _language: string, fallback: string) =>
    error instanceof Error ? error.message : fallback,
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

function useHarness<T>(options: UseApiDataOptions<T>) {
  const state = useApiData<T>(options);
  return state;
}

beforeEach(() => {
  mocks.api.mockReset();
  mocks.t.mockClear();
  mocks.user = makeUser({ id: 1, email: "one@example.com" });
});

describe("useApiData", () => {
  it("renders cached data immediately and refreshes in the background", async () => {
    const path = "/api/decks";
    const query = { timezone: "UTC" };
    const cached = [{ id: 1, name: "cached" }];
    const fresh = [{ id: 1, name: "fresh" }];
    await writeApiCache(
      apiCacheKey(1, "GET", path, query),
      1,
      "GET",
      path,
      cached,
      query,
    );

    let resolveFresh: (value: typeof fresh) => void = () => {};
    mocks.api.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFresh = resolve;
        }),
    );

    const { result } = renderHook(() => useHarness({ path, query, auth: "required" }));

    await waitFor(() => expect(result.current.data).toEqual(cached));
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);

    act(() => resolveFresh(fresh));
    await waitFor(() => expect(result.current.data).toEqual(fresh));
    expect(result.current.refreshing).toBe(false);
  });

  it("shows loading while fetching when no cache exists", async () => {
    let resolveData: (value: { ok: true }) => void = () => {};
    mocks.api.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveData = resolve;
        }),
    );

    const { result } = renderHook(() => useHarness({ path: "/api/loading-test", auth: "required" }));

    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    act(() => resolveData({ ok: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ ok: true });
  });

  it("isolates cached responses by user", async () => {
    const path = "/api/decks";
    const cached = [{ id: 1, name: "one" }];
    await writeApiCache(apiCacheKey(1, "GET", path), 1, "GET", path, cached);
    mocks.user = makeUser({ id: 2, email: "two@example.com" });

    let resolveFresh: (value: { id: 2 }[]) => void = () => {};
    mocks.api.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFresh = resolve;
        }),
    );

    const { result } = renderHook(() => useHarness({ path, auth: "required" }));

    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    act(() => resolveFresh([{ id: 2 }]));
    await waitFor(() => expect(result.current.data).toEqual([{ id: 2 }]));
  });

  it("reports a network failure when no fallback data exists", async () => {
    mocks.api.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useHarness({ path: "/api/network-failure", auth: "required" }));

    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.error).toBe("offline"));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("keeps cached data during a background network failure", async () => {
    const path = "/api/decks";
    const cached = [{ id: 1, name: "cached" }];
    await writeApiCache(apiCacheKey(1, "GET", path), 1, "GET", path, cached);
    mocks.api.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useHarness({ path, auth: "required" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(cached);
    expect(result.current.error).toBe("");
  });
});
