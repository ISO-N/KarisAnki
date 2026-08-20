import type { UiLanguage } from "@/lib/types";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

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
    request_failed: "请求失败",
    validation_error: "请求参数不正确",
    rate_limited: "尝试过于频繁，请稍后再试",
    card_not_found: "卡片不存在",
    deck_not_found: "卡组不存在",
    settings_not_found: "用户设置不存在",
    user_not_found: "用户不存在",
    unauthenticated: "登录状态已失效",
    internal_error: "服务器内部错误",
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
    request_failed: "Request failed.",
    validation_error: "The request parameters are invalid.",
    rate_limited: "Too many attempts. Please try again later.",
    card_not_found: "Card not found.",
    deck_not_found: "Deck not found.",
    settings_not_found: "User settings not found.",
    user_not_found: "User not found.",
    unauthenticated: "Your session has expired.",
    internal_error: "Internal server error.",
  },
};

export function apiErrorMessage(error: unknown, language: UiLanguage, fallback: string): string {
  if (error instanceof ApiError) {
    return apiMessages[language]?.[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data?.code || "request_failed";
    const message = data?.message || `Request failed (${response.status})`;
    throw new ApiError(code, message, response.status);
  }
  return data as T;
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
