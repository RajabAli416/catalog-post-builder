import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from './repository';
import { getStorageMode } from './stateStore';

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('pdf')) return 'pdf';
  return 'jpg';
}

export async function storeMediaBuffer(
  buffer: Buffer,
  mimeType: string,
  prefix: string
): Promise<string> {
  const mode = getStorageMode();
  const ext = extensionForMime(mimeType);
  const fileName = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;

  if (mode === 'vercel-blob') {
    const { put } = await import('@vercel/blob');
    const blob = await put(`media/${fileName}`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: mimeType,
    });
    return blob.url;
  }

  if (mode === 'ephemeral') {
    throw new Error(
      'Image storage is not configured on Vercel. Open the project Storage tab, create a Blob store, then redeploy. Vercel will set BLOB_READ_WRITE_TOKEN automatically.'
    );
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const filePath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${fileName}`;
}
