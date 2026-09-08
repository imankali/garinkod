// frontend/src/types/common.ts — domain types (split from types/index.ts)
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
