import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { MediaModel, UserModel, FaceoffModel, ReviewModel } from '../backend/models.ts';
import { claimPhotos, mediaId, removeMedia } from '../backend/media.ts';
import { migrateLegacyMedia } from '../backend/migrate-media.ts';
import { userWrite } from '../backend/user-write.ts';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const base = 'http://localhost:3000';
let userId;
const diskImages = async () => readdir(path.join(root, 'uploads/community')).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
try {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'shopDB', serverSelectionTimeoutMS: 15000 });
  const before = await diskImages();
  assert.deepEqual(before, [], 'Existing image files must migrate before verification.');
  let existing = 0;
  for (const media of await MediaModel.find({ attachedTo: { $ne: '' } }).select('+data')) {
    assert(Buffer.isBuffer(media.data) && media.data.length === media.bytes);
    const [kind, id] = media.attachedTo.split(':');
    const attachment = await (kind === 'faceoff' ? FaceoffModel : ReviewModel).findById(id);
    assert(attachment && String(attachment.userId) === String(media.ownerId), 'Image owner must match its post/review owner.');
    const response = await fetch(base + '/api/media/' + media.mediaId);
    assert.equal(response.status, 200);
    assert(Buffer.from(await response.arrayBuffer()).equals(media.data), 'Served bytes must match MongoDB.');
    existing++;
  }
  const password = randomUUID();
  const signup = await fetch(base + '/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Media verification', emailId: `forme-media-check-${randomUUID()}@example.com`, age: 22, password }) });
  const account = await signup.json();
  assert.equal(signup.status, 201); userId = account.user.id;
  const headers = { 'Content-Type': 'application/json', Cookie: signup.headers.getSetCookie()[0].split(';')[0], 'X-CSRF-Token': account.csrfToken };
  const source = 'data:image/png;base64,' + (await sharp({ create: { width: 160, height: 200, channels: 3, background: '#687454' } }).png().toBuffer()).toString('base64');
  const upload = await fetch(base + '/api/media', { method: 'POST', headers, body: JSON.stringify({ images: [source, source] }) });
  assert.equal(upload.status, 201); const { images } = await upload.json();
  const stored = await MediaModel.find({ ownerId: userId }).select('+data');
  assert.equal(stored.length, 2);
  for (const media of stored) {
    assert(Buffer.isBuffer(media.data)); assert.equal(media.bytes, media.data.length);
    assert.equal(media.contentType, 'image/webp'); assert.equal(media.attachedTo, '');
    assert.equal((await sharp(media.data).metadata()).format, 'webp');
    assert.equal((await fetch(base + '/api/media/' + media.mediaId)).status, 404, 'Unpublished uploads stay private.');
  }
  assert.deepEqual(await diskImages(), before, 'New uploads must not create local image files.');
  const bad = await fetch(base + '/api/media', { method: 'POST', headers, body: JSON.stringify({ images: [source, 'data:image/png;base64,YmFk'] }) });
  assert.equal(bad.status, 400); assert.equal(await MediaModel.countDocuments({ ownerId: userId }), 2);
  await assert.rejects(userWrite(userId, session => claimPhotos(images, new mongoose.Types.ObjectId(), 'faceoff:' + new mongoose.Types.ObjectId(), session)), error => error.status === 403);
  const rollback = new Error('Intentional transaction rollback');
  await assert.rejects(userWrite(userId, async session => { await claimPhotos(images, userId, 'faceoff:' + new mongoose.Types.ObjectId(), session); throw rollback; }), error => error === rollback);
  assert.equal(await MediaModel.countDocuments({ ownerId: userId, attachedTo: '' }), 2, 'Rollback must preserve unattached state.');
  await removeMedia(images.map(mediaId)); assert.equal(await MediaModel.countDocuments({ ownerId: userId }), 0);
  assert.deepEqual(await migrateLegacyMedia(), { migrated: 0, removed: 0 }, 'Migration must be repeatable.');
  console.log(`PASS: ${existing} published images served byte-for-byte from MongoDB with matching owner/post references. New uploads, private drafts, invalid batches, ownership checks, transaction rollback, deletion and repeat migration verified. No local image files created.`);
} finally {
  if (userId) { await MediaModel.deleteMany({ ownerId: userId }); await UserModel.deleteOne({ _id: userId }); }
  await mongoose.disconnect();
}
