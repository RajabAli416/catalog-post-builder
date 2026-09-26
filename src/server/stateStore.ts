import fs from 'fs';
import path from 'path';
import type { StudioDatabaseState } from './repository';

export type StorageMode = 'vercel-blob' | 'local-disk' | 'ephemeral';

const LOCAL_DIR = path.resolve(process.cwd(), '.studio-data');
const LOCAL_FILE = path.join(LOCAL_DIR, 'studio-db.json');
const EPHEMERAL_DIR = path.join('/tmp', 'atelier-studio');
const EPHEMERAL_FILE = path.join(EPHEMERAL_DIR, 'studio-db.json');
const BLOB_PATH = 'studio/studio-db.json';

export function createEmptyState(): StudioDatabaseState {
  return {
    aiMode: 'live',
    projects: [],
    products: [],
    shoots: [],
    generatedImages: [],
    postDrafts: [],
  };
}

export function getStorageMode(): StorageMode {
  if (process.env.VERCEL && process.env.BLOB_READ_WRITE_TOKEN) return 'vercel-blob';
  if (process.env.VERCEL) return 'ephemeral';
  return 'local-disk';
}

function isLegacyDemoState(state: StudioDatabaseState): boolean {
  return state.projects.some(
    (project) =>
      project.id === 'proj-autumn-festive' || project.id === 'proj-heritage-silk'
  );
}

function normalizeState(parsed: StudioDatabaseState): StudioDatabaseState {
  if (!parsed || !Array.isArray(parsed.projects)) return createEmptyState();
  if (isLegacyDemoState(parsed)) return createEmptyState();
  return {
    ...createEmptyState(),
    ...parsed,
    aiMode: 'live',
    projects: parsed.projects || [],
    products: parsed.products || [],
    shoots: parsed.shoots || [],
    generatedImages: parsed.generatedImages || [],
    postDrafts: parsed.postDrafts || [],
  };
}

function readJsonFile(filePath: string): StudioDatabaseState {
  if (!fs.existsSync(filePath)) return createEmptyState();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  } catch {
    return createEmptyState();
  }
}

function writeJsonFile(filePath: string, state: StudioDatabaseState): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state), 'utf-8');
}

export async function loadStudioState(): Promise<StudioDatabaseState> {
  const mode = getStorageMode();
  if (mode === 'local-disk') return readJsonFile(LOCAL_FILE);
  if (mode === 'ephemeral') return readJsonFile(EPHEMERAL_FILE);

  const { get } = await import('@vercel/blob');
  let result;
  try {
    result = await get(BLOB_PATH, { access: 'private', useCache: false });
  } catch {
    return createEmptyState();
  }
  if (!result || result.statusCode !== 200 || !result.stream) {
    return createEmptyState();
  }
  const raw = await new Response(result.stream).text();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return createEmptyState();
  }
}

export async function saveStudioState(state: StudioDatabaseState): Promise<void> {
  const next = { ...state, aiMode: 'live' as const };
  const mode = getStorageMode();
  if (mode === 'local-disk') {
    writeJsonFile(LOCAL_FILE, next);
    return;
  }
  if (mode === 'ephemeral') {
    writeJsonFile(EPHEMERAL_FILE, next);
    return;
  }

  const { put } = await import('@vercel/blob');
  await put(BLOB_PATH, JSON.stringify(next), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  });
}
