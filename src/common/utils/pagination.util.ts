export interface PaginationOptions {
  page: number;
  limit: number;
}

export function normalizePagination(
  page?: string | number,
  limit?: string | number,
): PaginationOptions {
  const parsedPage = Number(page ?? 1);
  const parsedLimit = Number(limit ?? 20);

  return {
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    limit: Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 20,
  };
}
