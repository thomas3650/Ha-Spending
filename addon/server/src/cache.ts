interface Entry<T> {
  promise: Promise<T>;
  /** undefined while the load runs. */
  loadedAt: number | undefined;
}

export function createCache<T>(options: { ttlMs: number; max: number; now?: () => number }): {
  get(key: string, load: () => Promise<T>): Promise<T>;
} {
  const now = options.now ?? Date.now;
  // A Map keeps insertion order, so re-inserting on each use makes its first key the least recently used.
  const entries = new Map<string, Entry<T>>();

  const fresh = (entry: Entry<T>) => entry.loadedAt === undefined || now() - entry.loadedAt <= options.ttlMs;

  return {
    get(key, load) {
      const known = entries.get(key);
      entries.delete(key);
      if (known && fresh(known)) {
        entries.set(key, known);
        return known.promise;
      }

      const entry: Entry<T> = { promise: load(), loadedAt: undefined };
      entry.promise.then(
        () => {
          entry.loadedAt = now();
        },
        () => {
          if (entries.get(key) === entry) entries.delete(key);
        },
      );
      entries.set(key, entry);
      for (const oldest of entries.keys()) {
        if (entries.size <= options.max) break;
        entries.delete(oldest);
      }
      return entry.promise;
    },
  };
}
