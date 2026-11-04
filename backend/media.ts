import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { MediaModel } from './models.ts';
import { ensure, HttpError } from './domain.ts';
import { userWrite } from './user-write.ts';
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
    // Re-encoding strips EXIF/GPS and bounds each MongoDB image to 250 KB.
    let result = await image.rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 78 }).toBuffer();
    if (result.length > 250 * 1024) result = await sharp(result).resize(1000, 1000, { fit: 'inside' }).webp({ quality: 60 }).toBuffer();
    ensure(result.length <= 250 * 1024, 'This image could not be compressed below 250 KB. Choose a simpler photo.', 413);
    return result;
  } catch (error: any) { if (error.status) throw error; throw new HttpError(400, 'This image could not be decoded safely.'); }
}
export async function savePhotos(ownerId: any, sources: unknown[]) {
  ensure(Array.isArray(sources) && sources.length >= 1 && sources.length <= 3, 'Upload 1–3 images.');
  // Decode everything first: invalid batches never create partial uploads.
  const photos = await Promise.all(sources.map(async source => {
    const data = await compressImage(source);
    return { mediaId: randomUUID(), ownerId, bytes: data.length, contentType: 'image/webp', data };
  }));
  return userWrite(ownerId, async session => {
    ensure(await MediaModel.countDocuments({ ownerId }).session(session) + photos.length <= 120, 'Your image limit is reached. Delete older posts or reviews first.', 429);
    await MediaModel.insertMany(photos, { session });
    return photos.map(photo => mediaURL(photo.mediaId));
  });
}
export async function claimPhotos(urls: string[], ownerId: any, target: string, session: any) {
  ensure(urls.length <= 3 && new Set(urls).size === urls.length, 'Use up to three different images.');
  for (const url of urls) {
    const id = mediaId(url); ensure(id, 'Invalid uploaded image.');
    const photo = await MediaModel.findOneAndUpdate({ mediaId: id, ownerId, attachedTo: { $in: ['', target] } }, { $set: { attachedTo: target } }, { session, returnDocument: 'after' });
    ensure(photo, 'This image is not yours or is already used in another post.', 403);
  }
}
export async function removeMedia(ids: string[]) {
  if (!ids.length) return;
  await MediaModel.deleteMany({ mediaId: { $in: ids } });
}
export async function cleanMedia() {
  const stale = await MediaModel.find({ attachedTo: '', createdAt: { $lt: new Date(Date.now() - 3600000) } }).select('mediaId').limit(500).lean();
  await removeMedia(stale.map((p: any) => p.mediaId));
}
