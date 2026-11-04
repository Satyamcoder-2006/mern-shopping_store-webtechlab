import { readFile, readdir, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MediaModel } from './models.ts';
import { ensure } from './domain.ts';

// Compatibility migration only. New uploads never access the filesystem.
const legacyDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/community');
export async function migrateLegacyMedia() {
  let migrated = 0, removed = 0;
  const files = await readdir(legacyDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  for (const file of files) {
    if (!/^[a-f0-9-]{36}\.webp$/.test(file)) continue;
    const filePath = path.join(legacyDirectory, file);
    const record = await MediaModel.findOne({ mediaId: file.slice(0, -5) }).select('+data');
    // Never discard a file with no metadata: it may require manual recovery.
    if (!record) throw new Error(`Legacy image ${file} has no media record; local copy retained.`);
    const bytes = await readFile(filePath);
    ensure(bytes.length > 0 && bytes.length <= 250 * 1024, 'Legacy image exceeds the supported storage size.');
    ensure((await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata()).format === 'webp', 'Legacy image is not WebP.');
    if (!record.data) {
      await MediaModel.updateOne({ _id: record._id, data: { $exists: false } }, { $set: { data: bytes, bytes: bytes.length, contentType: 'image/webp' } });
      migrated++;
    }
    const stored = await MediaModel.findById(record._id).select('+data');
    ensure(stored && Buffer.isBuffer(stored.data) && stored.data.equals(bytes), 'Image migration verification failed; local copy retained.');
    await unlink(filePath);
    removed++;
  }
  // Refuse to serve a partially migrated store with dangling image references.
  const missing = await MediaModel.countDocuments({ data: { $exists: false } });
  if (missing) throw new Error(`${missing} media records are missing image bytes. Restore their legacy files to finish migration.`);
  await rmdir(legacyDirectory).catch((error: NodeJS.ErrnoException) => {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code || '')) throw error;
  });
  if (migrated || removed) console.log(`Media migrated to MongoDB: ${migrated} images verified; ${removed} local files removed.`);
  return { migrated, removed };
}
