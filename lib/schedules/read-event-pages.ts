/** The existing PostgREST row cap is 1,000. Keep one query for ordinary
 * calendars, and fail rather than cache a partial list if a later page fails.
 * Callers own the same calendar/visibility filters and stable date/created/id
 * ordering on EVERY fresh builder. Offset pages are not a DB snapshot: edits
 * during a read can move rows, so detectable duplicates fail for a clean retry.
 */
export async function readScheduleEventPages<T extends { id: string }>(
  readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let from = 0; ; from += pageSize) {
    const result = await readPage(from, from + pageSize - 1);
    if (result.error || !Array.isArray(result.data)) throw new Error("Schedule events unavailable");
    for (const row of result.data) {
      if (typeof row.id !== "string" || seen.has(row.id)) throw new Error("Schedule events changed during read");
      seen.add(row.id); rows.push(row);
    }
    if (result.data.length < pageSize) return rows;
  }
}
