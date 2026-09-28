import fs from 'fs';
import path from 'path';
import type { StudioDatabaseState } from './repository';
import { currentUserId } from './requestContext';

export type StorageMode = 'vercel-blob' | 'local-disk' | 'ephemeral';

const LOCAL_DIR = path.resolve(process.cwd(), '.studio-data');
const LEGACY_LOCAL_FILE = path.join(LOCAL_DIR, 'studio-db.json');
const EPHEMERAL_DIR = path.join('/tmp', 'atelier-studio');
const LEGACY_BLOB_PATH = 'studio/studio-db.json';

function safeUserId(userId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error('Invalid user.');
  }
  return userId;
}

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

function stateHasContent(state: StudioDatabaseState): boolean {
  return (
    state.projects.length > 0 ||
    state.products.length > 0 ||
    state.shoots.length > 0 ||
    state.generatedImages.length > 0 ||
    state.postDrafts.length > 0
  );
}

function userLocalFile(userId: string): string {
  return path.join(LOCAL_DIR, 'users', safeUserId(userId), 'studio-db.json');
}

function userEphemeralFile(userId: string): string {
  return path.join(EPHEMERAL_DIR, 'users', safeUserId(userId), 'studio-db.json');
}

function userBlobPath(userId: string): string {
  return `studio/${safeUserId(userId)}/studio-db.json`;
}

async function readBlobJson(blobPath: string): Promise<unknown | null> {
  const { get } = await import('@vercel/blob');
  let result;
  try {
    result = await get(blobPath, { access: 'private', useCache: false });
  } catch {
    return null;
  }
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const raw = await new Response(result.stream).text();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeBlobJson(blobPath: string, value: unknown): Promise<void> {
  const { put } = await import('@vercel/blob');
  await put(blobPath, JSON.stringify(value), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  });
}

async function readUserState(userId: string): Promise<StudioDatabaseState> {
  const mode = getStorageMode();
  if (mode === 'local-disk') return readJsonFile(userLocalFile(userId));
  if (mode === 'ephemeral') return readJsonFile(userEphemeralFile(userId));
  const parsed = await readBlobJson(userBlobPath(userId));
  if (!parsed) return createEmptyState();
  return normalizeState(parsed as StudioDatabaseState);
}

async function writeUserState(userId: string, state: StudioDatabaseState): Promise<void> {
  const mode = getStorageMode();
  if (mode === 'local-disk') {
    writeJsonFile(userLocalFile(userId), state);
    return;
  }
  if (mode === 'ephemeral') {
    writeJsonFile(userEphemeralFile(userId), state);
    return;
  }
  await writeBlobJson(userBlobPath(userId), state);
}

async function readLegacyState(): Promise<StudioDatabaseState> {
  const mode = getStorageMode();
  if (mode === 'local-disk') return readJsonFile(LEGACY_LOCAL_FILE);
  if (mode === 'ephemeral') return createEmptyState();
  const parsed = await readBlobJson(LEGACY_BLOB_PATH);
  if (!parsed) return createEmptyState();
  return normalizeState(parsed as StudioDatabaseState);
}

function contentKey(state: StudioDatabaseState): string {
  return JSON.stringify({
    projects: state.projects,
    products: state.products,
    shoots: state.shoots,
    generatedImages: state.generatedImages,
    postDrafts: state.postDrafts,
  });
}

export function studioStateReferencesMedia(state: StudioDatabaseState, pathname: string): boolean {
  const encoded = encodeURIComponent(pathname);
  const serialized = JSON.stringify(state);
  return serialized.includes(pathname) || serialized.includes(encoded);
}

export async function loadStudioState(): Promise<StudioDatabaseState> {
  const userId = currentUserId();
  const own = await readUserState(userId);
  if (!stateHasContent(own)) return own;

  const legacy = await readLegacyState();
  if (stateHasContent(legacy) && contentKey(own) === contentKey(legacy)) {
    const empty = createEmptyState();
    await writeUserState(userId, empty);
    return empty;
  }
  return own;
}

export async function saveStudioState(state: StudioDatabaseState): Promise<void> {
  const next = { ...state, aiMode: 'live' as const };
  await writeUserState(currentUserId(), next);
}
