import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MediaModel } from './models.ts';
import { ensure, HttpError } from './domain.ts';
import { userWrite } from './user-write.ts';
export const mediaDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/community');
export const mediaURL = (id: string) => '/api/media/' + id;
export const mediaId = (url: string) => /^\/api\/media\/([a-f0-9-]{36})$/.exec(url)?.[1];
export async function compressImage(source: unknown) {
  ensure(typeof source === 'string' && source.length <= 3 * 1024 * 1024, 'Image upload is too large.', 413);
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  ensure(match && match[2].length % 4 === 0, 'Use a JPEG, PNG or WebP image.');
  const bytes = Buffer.from(match[2], 'base64');
  ensure(bytes.length <= 2 * 1024 * 1024, 'Each upload must be under 2 MB.', 413);
  try {
    const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' });
    const meta = await image.metadata();
    ensure(['jpeg', 'png', 'webp'].includes(meta.format || '') && (meta.pages || 1) === 1 && (meta.width || 0) >= 64 && (meta.height || 0) >= 64, 'Use a non-animated photo at least 64px wide and tall.');
    // Re-encoding strips EXIF/GPS and keeps binary images out of MongoDB.
    let result = await image.rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 78 }).toBuffer();
    if (result.length > 250 * 1024) result = await sharp(result).resize(1000, 1000, { fit: 'inside' }).webp({ quality: 60 }).toBuffer();
    ensure(result.length <= 250 * 1024, 'This image could not be compressed below 250 KB. Choose a simpler photo.', 413);
    return result;
  } catch (error: any) { if (error.status) throw error; throw new HttpError(400, 'This image could not be decoded safely.'); }
}
export async function savePhotos(ownerId: any, sources: unknown[]) {
  ensure(Array.isArray(sources) && sources.length >= 1 && sources.length <= 3, 'Upload 1–3 images.');
  const outputs: string[] = [];
  await mkdir(mediaDirectory, { recursive: true });
  try {
    return await userWrite(ownerId, async session => {
    ensure(await MediaModel.countDocuments({ ownerId }).session(session) + sources.length <= 120, 'Your image limit is reached. Delete older posts or reviews first.', 429);
    const current: string[] = [];
    for (const source of sources) {
      const data = await compressImage(source), id = randomUUID(); outputs.push(id); current.push(id);
      await writeFile(path.join(mediaDirectory, id + '.webp'), data, { flag: 'wx' });
      await MediaModel.create([{ mediaId: id, ownerId, bytes: data.length }], { session });
    }
    return current.map(mediaURL);
    });
  } catch (error) { await Promise.all(outputs.map(id => unlink(path.join(mediaDirectory, id + '.webp')).catch(() => {}))); throw error; }
}
export async function claimPhotos(urls: string[], ownerId: any, target: string, session: any) {
  ensure(urls.length <= 3 && new Set(urls).size === urls.length, 'Use up to three different images.');
  for (const url of urls) {
    const id = mediaId(url); ensure(id, 'Invalid uploaded image.');
    const photo = await MediaModel.findOneAndUpdate({ mediaId: id, ownerId, attachedTo: { $in: ['', target] } }, { $set: { attachedTo: target } }, { session, new: true });
    ensure(photo, 'This image is not yours or is already used in another post.', 403);
  }
}
export async function removeMedia(ids: string[]) {
  if (!ids.length) return;
  await MediaModel.deleteMany({ mediaId: { $in: ids } });
  await Promise.all(ids.map(id => unlink(path.join(mediaDirectory, id + '.webp')).catch(() => {})));
}
export async function cleanMedia() {
  const stale = await MediaModel.find({ attachedTo: '', createdAt: { $lt: new Date(Date.now() - 3600000) } }).select('mediaId').limit(500).lean();
  await removeMedia(stale.map((p: any) => p.mediaId));
  // Remove files left behind if a process stopped between DB deletion and unlink.
  for (const file of await readdir(mediaDirectory).catch(() => [])) {
    if (!/^[a-f0-9-]{36}\.webp$/.test(file)) continue;
    const full = path.join(mediaDirectory, file), info = await stat(full).catch(() => null);
    if (info && info.mtimeMs < Date.now() - 3600000 && !await MediaModel.exists({ mediaId: file.slice(0, -5) })) await unlink(full).catch(() => {});
  }
}
