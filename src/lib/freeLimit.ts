// How many full stock analyses a free (Explorer) account may reveal. Enforced
// server-side per email (KV `free:<email>`) so it can't be reset by refreshing
// or switching devices. Shared by the API route and the Stock Analysis UI.
export const FREE_LIMIT = 2;
