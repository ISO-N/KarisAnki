import type { UiLanguage } from "@/lib/types";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export class ApiNetworkError extends Error {
  code: "network_timeout" | "network_error" | "request_aborted";

  constructor(
    code: "network_timeout" | "network_error" | "request_aborted",
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ApiNetworkError";
    this.code = code;
    if (cause) {
      this.cause = cause;
    }
  }
}

export interface RetryOptions {
  maxRetries?: number;
  backoffMs?: number;
}

export interface ApiRequestInit extends RequestInit {
  timeoutMs?: number;
  retry?: boolean | RetryOptions;
  idempotent?: boolean;
}

export const DEFAULT_TIMEOUT_MS = 15_000;
export const IMPORT_MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_CARDS = 5000;

const apiMessages: Record<UiLanguage, Record<string, string>> = {
  ZH: {
    invalid_invite_code: "邀请码无效",
    email_exists: "该邮箱已注册",
    invalid_credentials: "邮箱或密码错误",
    registration_unavailable: "注册尚未开放，请联系部署者配置邀请码。",
    front_required: "卡片正面不能为空",
    name_required: "卡组名称不能为空",
    name_too_long: "卡组名称不能超过 120 个字符",
    invalid_refresh_time: "刷新时间必须按 15 分钟粒度设置",
    current_password_incorrect: "当前密码错误",
    queue_conflict: "队列已失效，请刷新后重试",
    queue_refresh: "卡片状态已变化，请刷新队列",
    confirmation_required: "从模糊重学切换到忘记重学需要确认",
    validation_error: "请求参数不正确",
    rate_limited: "尝试过于频繁，请稍后再试",
    card_not_found: "卡片不存在",
    deck_not_found: "卡组不存在",
    settings_not_found: "用户设置不存在",
    user_not_found: "用户不存在",
    unauthenticated: "登录状态已失效",
    internal_error: "服务器内部错误",
    invalid_import_json: "导入内容不是有效的 JSON 数组",
    import_source_too_large: "导入内容超过大小限制",
    too_many_import_cards: "单次导入卡片数量过多",
    back_invalid: "卡片背面格式不正确",
    network_timeout: "请求超时，请检查网络后重试",
    network_error: "网络连接失败，请检查网络",
    request_aborted: "请求已取消",
  },
  EN: {
    invalid_invite_code: "Invalid invite code.",
    email_exists: "This email is already registered.",
    invalid_credentials: "Incorrect email or password.",
    registration_unavailable: "Registration is not available. Ask the deployer to configure an invite code.",
    front_required: "The card front cannot be empty.",
    name_required: "The deck name cannot be empty.",
    name_too_long: "The deck name cannot exceed 120 characters.",
    invalid_refresh_time: "The refresh time must be set in 15-minute increments.",
    current_password_incorrect: "The current password is incorrect.",
    queue_conflict: "The queue is no longer valid. Refresh it and try again.",
    queue_refresh: "The card state changed. Refresh the queue.",
    confirmation_required: "Confirm switching from blurry relearn to forgot relearn.",
    validation_error: "The request parameters are invalid.",
    rate_limited: "Too many attempts. Please try again later.",
    card_not_found: "Card not found.",
    deck_not_found: "Deck not found.",
    settings_not_found: "User settings not found.",
    user_not_found: "User not found.",
    unauthenticated: "Your session has expired.",
    internal_error: "Internal server error.",
    invalid_import_json: "The source is not a valid JSON array.",
    import_source_too_large: "The import source exceeds the size limit.",
    too_many_import_cards: "The import contains too many cards.",
    back_invalid: "The card back has an invalid format.",
    network_timeout: "The request timed out. Check the network and try again.",
    network_error: "Network unavailable. Check your connection.",
    request_aborted: "The request was cancelled.",
  },
};

interface ApiErrorPayload {
  code?: string;
  message?: string;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryPlan(method: string, init: ApiRequestInit): RetryOptions | null {
  if (init.retry === false) return null;
  const safe = method === "GET" || (method === "POST" && init.idempotent === true);
  if (!safe) return null;

  const configured =
    typeof init.retry === "object"
      ? init.retry
      : { maxRetries: method === "GET" ? 2 : 2, backoffMs: 300 };
  return {
    maxRetries: Math.max(0, configured.maxRetries ?? 2),
    backoffMs: Math.max(0, configured.backoffMs ?? 300),
  };
}

function isRetryable(error: unknown) {
  if (error instanceof ApiNetworkError) return true;
  if (error instanceof ApiError) return error.status >= 500 && error.status !== 501;
  return false;
}

async function fetchOnce(path: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  try {
    return await fetch(path, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ApiNetworkError("network_timeout", "Request timed out.", error);
    }
    if (externalSignal?.aborted) {
      throw new ApiNetworkError("request_aborted", "Request cancelled.", error);
    }
    throw new ApiNetworkError("network_error", "Network unavailable.", error);
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

export function apiErrorMessage(error: unknown, language: UiLanguage, fallback: string): string {
  if (error instanceof ApiError || error instanceof ApiNetworkError) {
    return apiMessages[language]?.[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export async function api<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const { timeoutMs, retry, idempotent, ...requestInit } = init;
  const headers: Record<string, string> = {
    ...(requestInit.headers as Record<string, string> | undefined),
  };
  if (requestInit.body && !(requestInit.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const plan = retryPlan(method, { ...init, retry, idempotent });
  const attempts = (plan?.maxRetries ?? 0) + 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchOnce(path, {
        ...requestInit,
        headers,
        credentials: "same-origin",
      }, timeoutMs ?? DEFAULT_TIMEOUT_MS);

      if (response.status === 204) {
        return undefined as T;
      }

      const data: ApiErrorPayload | null = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(new Event("karisanki:unauthorized"));
        }
        const code = data?.code || "request_failed";
        const message = data?.message || `Request failed (${response.status})`;
        throw new ApiError(code, message, response.status);
      }
      return data as T;
    } catch (error) {
      if (isRetryable(error) && attempt < attempts - 1) {
        const backoffMs = (plan?.backoffMs ?? 300) * 2 ** attempt;
        await wait(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw new ApiNetworkError("network_error", "Network unavailable.", undefined);
}

export function browserLanguage(): "ZH" | "EN" {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")
    ? "ZH"
    : "EN";
}

export function clientTimezone(): string {
  return typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    : "UTC";
}
