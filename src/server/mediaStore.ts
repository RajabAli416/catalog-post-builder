import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from './repository';
import { currentUserId } from './requestContext';
import { getStorageMode } from './stateStore';

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('pdf')) return 'pdf';
  return 'jpg';
}

export function mediaPathForUser(pathname: string, userId: string): boolean {
  if (!pathname.startsWith('media/') || pathname.includes('..') || pathname.includes('\\')) {
    return false;
  }
  return pathname.startsWith(`media/${userId}/`);
}

function diskPathForMedia(pathname: string): string | null {
  if (!pathname.startsWith('media/') || pathname.includes('..') || pathname.includes('\\')) {
    return null;
  }
  const relative = pathname.slice('media/'.length);
  const resolved = path.resolve(UPLOADS_DIR, relative);
  const root = path.resolve(UPLOADS_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

export async function readStoredMedia(
  pathname: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const mode = getStorageMode();
  if (mode === 'vercel-blob') {
    const { get } = await import('@vercel/blob');
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
    return {
      bytes,
      contentType: result.blob.contentType || 'application/octet-stream',
    };
  }

  const diskPath = diskPathForMedia(pathname);
  if (!diskPath || !fs.existsSync(diskPath)) return null;
  const ext = path.extname(diskPath).toLowerCase();
  const contentType =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.pdf'
          ? 'application/pdf'
          : 'image/jpeg';
  return { bytes: fs.readFileSync(diskPath), contentType };
}

export async function storeMediaBuffer(
  buffer: Buffer,
  mimeType: string,
  prefix: string
): Promise<string> {
  const mode = getStorageMode();
  const userId = currentUserId();
  const ext = extensionForMime(mimeType);
  const fileName = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const pathname = `media/${userId}/${fileName}`;

  if (mode === 'vercel-blob') {
    const { put } = await import('@vercel/blob');
    await put(pathname, buffer, {
      access: 'private',
      addRandomSuffix: false,
      contentType: mimeType,
    });
    return `/api/media?pathname=${encodeURIComponent(pathname)}`;
  }

  if (mode === 'ephemeral') {
    throw new Error(
      'Image storage is not configured on Vercel. Open the project Storage tab, create a Blob store, then redeploy. Vercel will set BLOB_READ_WRITE_TOKEN automatically.'
    );
  }

  const filePath = diskPathForMedia(pathname);
  if (!filePath) {
    throw new Error('Could not store this image.');
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return `/api/media?pathname=${encodeURIComponent(pathname)}`;
}
