// How many full stock analyses a free (Explorer) account may reveal per day.
// Enforced server-side per email + day (KV `free:<email>:<YYYY-MM-DD>`) so it
// can't be reset by refreshing or switching devices, and it resets each day.
// Shared by the API route and the Stock Analysis UI.
import { FREE_LIMITS } from "@/data/plans";

export const FREE_LIMIT = FREE_LIMITS.analysesPerDay;

// UTC day stamp used to scope the daily quota.
export function freeDayKey(email: string): string {
  return `free:${email}:${new Date().toISOString().slice(0, 10)}`;
}
