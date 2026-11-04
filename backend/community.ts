import express from 'express';
import mongoose from 'mongoose';
import { body, param, query } from 'express-validator';
import { UserModel, ProductModel, OrderModel, MediaModel, ReviewModel, FaceoffModel, VoteModel } from './models.ts';
import { authenticate, adminOnly, csrf, rateLimit, clearSession } from './security.ts';
import { validate, rejectOperators, faceoffRules } from './validation.ts';
import { HttpError, ensure } from './domain.ts';
import { claimPhotos, removeMedia, savePhotos } from './media.ts';
import { userWrite } from './user-write.ts';
import { databaseReady } from './database.ts';
import { recommendSize, MEASUREMENT_FIELDS, measurementMessage } from '../shared/sizing.ts';
const who = (req: any) => req.user;
const run = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res)).catch(next);
const idRules = [param('id').isMongoId(), validate];
const productRules = [param('productId').isString().matches(/^[A-Za-z0-9_-]{1,80}$/), validate];
const paging = [query('page').optional().isInt({ min: 1, max: 1000 }), validate];
const imagesRules = [body('images').isArray({ max: 3 }), body('images.*').isString().matches(/^\/api\/media\/[a-f0-9-]{36}$/)];
const optionalAuth = (req: any, res: any, next: any) => req.headers.cookie ? authenticate(req, res, () => next()) : next();
const asPublic = (doc: any, user: any) => ({ ...doc, _id: String(doc._id), userId: undefined,
  author: doc.userId?.username || 'Former member', isOwner: !!user && String(doc.userId?._id) === String(user._id) });

export const mediaUploadRouter = express.Router();
mediaUploadRouter.use((_req, _res, next) => databaseReady() ? next() : next(new HttpError(503, 'Database temporarily unavailable.')));
mediaUploadRouter.post('/', authenticate, csrf, rateLimit(20, 3600000, 'photos'), express.json({ limit: '4mb' }), rejectOperators,
  body('images').isArray({ min: 1, max: 3 }), validate, run(async (req: any, res: any) => {
    res.status(201).json({ images: await savePhotos(who(req)._id, req.body.images) });
  }));
mediaUploadRouter.get('/:id', param('id').isUUID(), validate, run(async (req: any, res: any) => {
  const media = await MediaModel.findOne({ mediaId: req.params.id, attachedTo: { $ne: '' } }).select('+data');
  ensure(media && Buffer.isBuffer(media.data), 'Image not found.', 404);
  res.set('Cache-Control', 'no-store'); res.type(media.contentType).send(media.data);
}));
export const communityRouter = express.Router();

communityRouter.get('/users/me/sessions', authenticate, run(async (req: any, res: any) => res.json(who(req).sessions.filter((s: any) => s.expiresAt > new Date()).map((s: any) => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt, current: s.id === req.sessionId })))));
communityRouter.delete('/users/me/sessions/:id', authenticate, csrf, param('id').isUUID(), validate, run(async (req: any, res: any) => {
  await UserModel.updateOne({ _id: who(req)._id }, { $pull: { sessions: { id: req.params.id } } });
  if (req.params.id === req.sessionId) clearSession(res);
  res.json({ message: 'Session ended.', current: req.params.id === req.sessionId });
}));
communityRouter.get('/users/me/dashboard', authenticate, run(async (req: any, res: any) => {
  const userId = who(req)._id;
  const [orders, reviews, faceoffs, votes] = await Promise.all([OrderModel.countDocuments({ userId }), ReviewModel.countDocuments({ userId }), FaceoffModel.countDocuments({ userId }), VoteModel.countDocuments({ userId })]);
  res.json({ orders, reviews, faceoffs, votes, sessionLimit: 3 });
}));
communityRouter.post('/size-recommendation', rateLimit(30, 60000, 'sizing'), body('productId').isString().matches(/^[A-Za-z0-9_-]{1,80}$/),
  ...MEASUREMENT_FIELDS.map(field => {
    const rule = body(field.key);
    return (field.optional ? rule.optional() : rule).isFloat({ min: field.min, max: field.max }).withMessage(measurementMessage(field)).toFloat();
  }),
  body('fit').isIn(['regular', 'relaxed']).withMessage('Choose a regular or roomier fit.'), validate,
  run(async (req: any, res: any) => {
    const p = await ProductModel.findOne({ productId: req.body.productId, active: true }).lean(); ensure(p, 'Product not found.', 404);
    try { res.json(recommendSize(req.body, p.category, p.variants)); } catch (e: any) { throw new HttpError(400, e.message); }
  }));

communityRouter.get('/products/:productId/reviews', ...productRules, ...paging, optionalAuth, run(async (req: any, res: any) => {
  const productId = req.params.productId, page = Number(req.query.page || 1), filter = { productId };
  const [reviews, stats, mine] = await Promise.all([
    ReviewModel.find(filter).populate('userId', 'username').sort({ createdAt: -1 }).skip((page - 1) * 10).limit(10).lean(),
    ReviewModel.aggregate([{ $match: filter }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } }]),
    who(req) ? ReviewModel.findOne({ productId, userId: who(req)._id }).lean() : null,
  ]);
  res.json({ reviews: reviews.map((r: any) => asPublic(r, who(req))), count: stats[0]?.count || 0, average: stats[0]?.average || 0, page, mine });
}));
const reviewRules = [body('rating').isInt({ min: 1, max: 5 }).toInt(), body('text').isString().bail().trim().isLength({ min: 10, max: 2000 }), ...imagesRules, validate];
communityRouter.put('/products/:productId/reviews/me', authenticate, csrf, rateLimit(12, 3600000, 'review-write'), ...productRules, ...reviewRules, run(async (req: any, res: any) => {
  const userId = who(req)._id, productId = req.params.productId; let removed: string[] = [];
  const review = await userWrite(userId, async session => {
    ensure(await ProductModel.exists({ productId, active: true }).session(session), 'Product not found.', 404);
    const existing = await ReviewModel.findOne({ productId, userId }).session(session);
    const id = existing?._id || new mongoose.Types.ObjectId(), target = 'review:' + id;
    await claimPhotos(req.body.images, userId, target, session);
    removed = (existing?.images || []).filter((p: string) => !req.body.images.includes(p)).map((p: string) => p.split('/').pop()!);
    const verifiedPurchase = !!await OrderModel.exists({ userId, status: 'Delivered', 'items.productId': productId }).session(session);
    return ReviewModel.findOneAndUpdate({ _id: id }, { $set: { userId, productId, text: req.body.text, rating: req.body.rating, images: req.body.images, verifiedPurchase } }, { session, returnDocument: 'after', upsert: true, runValidators: true });
  });
  await removeMedia(removed); res.json({ message: 'Review saved.', review });
}));
communityRouter.delete('/products/:productId/reviews/me', authenticate, csrf, ...productRules, run(async (req: any, res: any) => {
  let images: string[] = [];
  await userWrite(who(req)._id, async session => {
    const review = await ReviewModel.findOneAndDelete({ productId: req.params.productId, userId: who(req)._id }, { session });
    ensure(review, 'Review not found.', 404); images = review.images.map((i: string) => i.split('/').pop()!);
    await MediaModel.deleteMany({ mediaId: { $in: images } }, { session });
  }); await removeMedia(images); res.json({ message: 'Review deleted.' });
}));

communityRouter.get('/faceoffs', ...paging, optionalAuth, run(async (req: any, res: any) => {
  if (req.query.mine === '1') ensure(who(req), 'Log in to see your posts.', 401);
  const filter = req.query.mine === '1' ? { userId: who(req)._id } : {}, page = Number(req.query.page || 1);
  const [posts, count] = await Promise.all([FaceoffModel.find(filter).populate('userId', 'username').sort({ createdAt: -1 }).skip((page - 1) * 12).limit(12).lean(), FaceoffModel.countDocuments(filter)]);
  const ids = posts.map((p: any) => p._id);
  const [counts, ownVotes] = await Promise.all([
    VoteModel.aggregate([{ $match: { faceoffId: { $in: ids } } }, { $group: { _id: { post: '$faceoffId', option: '$option' }, count: { $sum: 1 } } }]),
    who(req) ? VoteModel.find({ faceoffId: { $in: ids }, userId: who(req)._id }).lean() : [],
  ]);
  res.json({ posts: posts.map((p: any) => ({ ...asPublic(p, who(req)), counts: p.looks.map((_: any, i: number) => counts.find((c: any) => String(c._id.post) === String(p._id) && c._id.option === i)?.count || 0), myVote: ownVotes.find((v: any) => String(v.faceoffId) === String(p._id))?.option ?? null })), count, page });
}));
communityRouter.post('/faceoffs', authenticate, csrf, rateLimit(30, 3600000, 'post-create'), ...faceoffRules, run(async (req: any, res: any) => {
  const id = new mongoose.Types.ObjectId();
  await userWrite(who(req)._id, async session => {
    ensure(await FaceoffModel.countDocuments({ userId: who(req)._id, createdAt: { $gt: new Date(Date.now() - 86400000) } }).session(session) < 5, 'You can publish up to five face-offs per day.', 429);
    await claimPhotos(req.body.looks.map((l: any) => l.image), who(req)._id, 'faceoff:' + id, session);
    await FaceoffModel.create([{ _id: id, userId: who(req)._id, title: req.body.title, caption: req.body.caption || '', looks: req.body.looks.map((l: any) => ({ image: l.image, label: l.label })), closesAt: new Date(Date.now() + 7 * 86400000) }], { session });
  }); res.status(201).json({ message: 'Your face-off is live.', id });
}));
communityRouter.put('/faceoffs/:id/vote', authenticate, csrf, rateLimit(60, 60000, 'vote'), ...idRules, body('option').isInt({ min: 0, max: 2 }).toInt(), validate, run(async (req: any, res: any) => {
  await userWrite(who(req)._id, async session => {
    // Write the post as well, serializing votes against deletion/closing.
    const post = await FaceoffModel.findOneAndUpdate({ _id: req.params.id, closesAt: { $gt: new Date() } }, { $set: { updatedAt: new Date() } }, { session, returnDocument: 'after' });
    ensure(post, 'This vote is closed or the post was deleted.', 409);
    ensure(String(post.userId) !== String(who(req)._id), 'Let the community vote on your own looks.');
    ensure(req.body.option < post.looks.length, 'Choose an existing outfit.');
    await VoteModel.updateOne({ faceoffId: post._id, userId: who(req)._id }, { $set: { option: req.body.option } }, { upsert: true, session, runValidators: true });
  }); res.json({ message: 'Vote saved. You can change it until voting closes.' });
}));
async function deletePost(id: string, user: any) {
  let images: string[] = [];
  await userWrite(user._id, async session => {
    const post = await FaceoffModel.findOneAndDelete({ _id: id, ...(user.role === 'admin' ? {} : { userId: user._id }) }, { session });
    ensure(post, 'Post not found.', 404); images = post.looks.map((l: any) => l.image.split('/').pop());
    await VoteModel.deleteMany({ faceoffId: post._id }, { session });
    await MediaModel.deleteMany({ mediaId: { $in: images } }, { session });
  }); await removeMedia(images);
}
communityRouter.delete('/faceoffs/:id', authenticate, csrf, ...idRules, run(async (req: any, res: any) => { await deletePost(req.params.id, who(req)); res.json({ message: 'Post and votes deleted.' }); }));
communityRouter.get('/admin/community', authenticate, adminOnly, run(async (_req: any, res: any) => {
  const [reviews, posts] = await Promise.all([ReviewModel.find().populate('userId', 'username').sort({ createdAt: -1 }).limit(50).lean(), FaceoffModel.find().populate('userId', 'username').sort({ createdAt: -1 }).limit(50).lean()]);
  res.json({ reviews: reviews.map((r: any) => asPublic(r, null)), posts: posts.map((p: any) => asPublic(p, null)) });
}));
communityRouter.delete('/admin/reviews/:id', authenticate, adminOnly, csrf, ...idRules, run(async (req: any, res: any) => {
  const review = await ReviewModel.findByIdAndDelete(req.params.id); ensure(review, 'Review not found.', 404);
  await removeMedia(review.images.map((i: string) => i.split('/').pop()!)); res.json({ message: 'Review removed.' });
}));
