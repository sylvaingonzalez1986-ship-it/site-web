/**
 * Collect every database reference before any storage deletion is considered.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, bucket: string, sources: Array<{ table: string, fields: string[] }>, initialUrls?: string[] }} options
 * @returns {Promise<Set<string>>}
 */
export async function collectStorageImageReferences({ supabase, bucket, sources, initialUrls = [] }) {
  /** @type {Set<string>} */
  const referenced = new Set();
  const addUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return;
    try {
      const url = new URL(value.trim());
      const marker = `/storage/v1/object/public/${bucket}/`;
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex < 0) return;
      const objectPath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
      if (objectPath) referenced.add(objectPath);
    } catch {
      // Local files and other media sources do not reference this storage bucket.
    }
  };

  for (const value of initialUrls) addUrl(value);
  for (const { table, fields } of sources) {
    let offset = 0;
    const pageSize = 100;
    while (true) {
      const query = await supabase.from(table)
        .select(["id", ...fields].join(","))
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (query.error || !Array.isArray(query.data)) {
        throw new Error(`Cannot safely clean ${bucket}: reading ${table} image references failed: ${query.error?.message || "invalid response"}`);
      }
      if (query.data.length === 0) break;
      for (const row of query.data) {
        for (const field of fields) {
          const value = row[field];
          if (Array.isArray(value)) value.forEach(addUrl);
          else addUrl(value);
        }
      }
      // Continue until an empty page, even if the API caps pages below pageSize.
      offset += query.data.length;
    }
  }
  return referenced;
}
