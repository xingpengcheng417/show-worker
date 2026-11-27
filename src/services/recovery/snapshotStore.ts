import type { RecoverySnapshot } from '@/core/models';

const SNAPSHOT_STORAGE_KEY = 'markflow:recovery-snapshots:v1';

function readAll(): Record<string, RecoverySnapshot> {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, RecoverySnapshot>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, RecoverySnapshot>): void {
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function saveRecoverySnapshot(snapshot: RecoverySnapshot): void {
  const map = readAll();
  map[snapshot.uri] = snapshot;
  writeAll(map);
}

export function getRecoverySnapshot(uri: string): RecoverySnapshot | null {
  const map = readAll();
  return map[uri] ?? null;
}

export function clearRecoverySnapshot(uri: string): void {
  const map = readAll();
  if (uri in map) {
    delete map[uri];
    writeAll(map);
  }
}
