import { loadConfig, resolveTemporalThreadPaths } from '@sudarshanchaudhari/temporalthread-config';
import { SystemClock, TemporalThreadService } from '@sudarshanchaudhari/temporalthread-core';
import { assertDatabaseHealthy, SqliteStorage } from '@sudarshanchaudhari/temporalthread-storage-sqlite';

export interface TemporalThreadRuntime {
  service: TemporalThreadService;
  storage: SqliteStorage;
}

export function createRuntime(env: NodeJS.ProcessEnv = process.env): TemporalThreadRuntime {
  const paths = resolveTemporalThreadPaths(env);
  const config = loadConfig(paths, env);
  const storage = new SqliteStorage(config.databasePath);
  try {
    assertDatabaseHealthy(storage.database);
    return {
      storage,
      service: new TemporalThreadService({ storage, config, clock: new SystemClock() }),
    };
  } catch (error) {
    storage.close();
    throw error;
  }
}
