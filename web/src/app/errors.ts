import { ApiError } from "@/api/client";
import { t } from "@/content/strings";

/** A user-facing message for any failure. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return t.errors.generic;
  switch (err.code) {
    case "not_found":
      return t.errors.notFound;
    case "wrong_key":
      return t.errors.wrongKey;
    case "too_many_requests":
      return t.errors.tooMany;
    case "too_large":
      return t.create.tooLarge;
    case "network":
      return t.errors.network;
    default:
      return t.errors.generic;
  }
}
