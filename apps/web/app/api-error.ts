export type ApiProblem = {
  detail?: string;
  title?: string;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    status: number,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds);
}

export function formatRetryAfter(seconds: number): string {
  const safeSeconds = Math.max(1, Math.ceil(seconds));
  if (safeSeconds < 60) {
    return `${safeSeconds} second${safeSeconds === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(safeSeconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function apiRequestError(
  response: Pick<Response, "status" | "headers">,
  problem: ApiProblem,
): ApiRequestError {
  const retryAfterSeconds = parseRetryAfter(response.headers.get("Retry-After"));
  if (response.status === 429 && retryAfterSeconds) {
    return new ApiRequestError(
      `Too many requests. Try again in ${formatRetryAfter(retryAfterSeconds)}.`,
      response.status,
      retryAfterSeconds,
    );
  }

  return new ApiRequestError(
    problem.detail ?? problem.title ?? "Request failed.",
    response.status,
    retryAfterSeconds,
  );
}
