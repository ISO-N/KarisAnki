// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  apiErrorMessage,
  ApiError,
  ApiNetworkError,
  IMPORT_MAX_CARDS,
  IMPORT_MAX_SOURCE_BYTES,
} from "./api";

type JsonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function jsonResponse(status: number, data: unknown): JsonResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("api request handling", () => {
  it("maps a timeout to an ApiNetworkError", async () => {
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const request = api("/api/slow", { timeoutMs: 10 });
    await new Promise((resolve) => setTimeout(resolve, 30));

    await expect(request).rejects.toMatchObject({ code: "network_timeout" });
  });

  it("maps a fetch rejection to a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(api("/api/offline")).rejects.toMatchObject({
      code: "network_error",
    });
  });

  it("reports an externally aborted request", async () => {
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
          } else {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }
        }),
    );
    const controller = new AbortController();
    controller.abort();

    await expect(api("/api/request", { signal: controller.signal })).rejects.toMatchObject({
      code: "request_aborted",
    });
  });

  it("retries idempotent GET requests with the configured policy", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { code: "internal_error", message: "boom" }) as unknown as Response)
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }) as unknown as Response);

    await expect(
      api("/api/retry", { retry: { maxRetries: 1, backoffMs: 0 } }),
    ).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-idempotent POST requests", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { code: "internal_error", message: "boom" }) as unknown as Response);

    await expect(
      api("/api/save", { method: "POST", body: "{}", retry: true }),
    ).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dispatches an unauthorized event for 401 responses", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { code: "unauthenticated", message: "expired" }) as unknown as Response);
    const eventPromise = new Promise<Event>((resolve) => {
      window.addEventListener("karisanki:unauthorized", resolve, { once: true });
    });

    await expect(api("/api/auth/me")).rejects.toMatchObject({ status: 401 });
    await expect(eventPromise).resolves.toBeInstanceOf(Event);
  });
});

describe("error messages and import limits", () => {
  it("maps stable API error codes to localized messages", () => {
    expect(apiErrorMessage(new ApiError("rate_limited", "raw", 429), "EN", "fallback")).toContain(
      "Too many attempts",
    );
    expect(
      apiErrorMessage(new ApiError("invalid_invite_code", "raw", 400), "ZH", "fallback"),
    ).toBe("邀请码无效");
    expect(
      apiErrorMessage(new ApiNetworkError("network_timeout", "raw"), "EN", "fallback"),
    ).toContain("timed out");
  });

  it("uses the original message for unknown or non-API errors", () => {
    expect(apiErrorMessage(new ApiError("unknown_code", "custom", 400), "EN", "fallback")).toBe(
      "custom",
    );
    expect(apiErrorMessage(new Error("boom"), "EN", "fallback")).toBe("boom");
    expect(apiErrorMessage("not an error", "EN", "fallback")).toBe("fallback");
  });

  it("exposes shared import limits", () => {
    expect(IMPORT_MAX_SOURCE_BYTES).toBe(2 * 1024 * 1024);
    expect(IMPORT_MAX_CARDS).toBe(5000);
  });
});
