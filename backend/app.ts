import { rejectOperators, signupRules, loginRules } from './validation.ts';
import { communityRouter, mediaUploadRouter } from './community.ts';
import { eraseAccount } from './privacy.ts';
import express, { type Request, type Response, type NextFunction } from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { UserModel, ProductModel, OrderModel, CouponModel } from './models.ts';
import { HttpError, ensure, email, password, text, number, productInput, couponInput } from './domain.ts';
import { authenticate, adminOnly, csrf, csrfFor, clearSession, issueSession, publicUser, rateLimit, sameOrigin, securityHeaders } from './security.ts';
import { placeOrder, quoteCart, changeOrderStatus } from './commerce.ts';
import passwordUtils from '../shared/password.cjs';
import { databaseReady } from './database.ts';
const { hashPassword, verifyPassword } = passwordUtils;
export const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);
app.use('/api', sameOrigin, rateLimit(300, 60000, 'api'));
app.use('/api/media', mediaUploadRouter);
app.use('/api', express.json({ limit: '100kb' }), rejectOperators);

const route = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);
const who = (req: Request): any => (req as any).user;
const authLimit = rateLimit(30, 15 * 60000, 'auth');


app.get('/api/health', (_req, res) => res.status(databaseReady() ? 200 : 503).json({ status: databaseReady() ? 'ok' : 'unavailable', brand: 'FORME' }));
app.get('/api/app-info', (_req, res) => res.json({ databaseStatus: databaseReady() ? 'Connected to MongoDB Atlas' : 'Unavailable' }));
app.use('/api', (_req, _res, next) => databaseReady() ? next() : next(new HttpError(503, 'The store database is temporarily unavailable. Please try again shortly.')));
app.use('/api', communityRouter);
app.get('/api/products', route(async (req, res) => {
  const filter: any = { active: true };
  if (req.query.category && ['Tops', 'Bottoms', 'Layers', 'Sets'].includes(String(req.query.category))) filter.category = String(req.query.category);
  const products = await ProductModel.find(filter).sort({ featured: -1, createdAt: -1 }).limit(300).lean();
  res.json(products);
}));
app.get('/api/products/:id', route(async (req, res) => {
  const product = await ProductModel.findOne({ productId: String(req.params.id), active: true }).lean();
  ensure(product, 'This piece is no longer available.', 404); res.json(product);
}));

app.post('/api/users', authLimit, ...signupRules, route(async (req, res) => {
  const username = text(req.body.username, 'Name', 80, 2);
  const emailId = email(req.body.emailId);
  const age = number(req.body.age, 'Age', 1, 120);
  const pass = password(req.body.password);
  ensure(!await UserModel.exists({ emailId }), 'An account with this email already exists.');
  const user = await UserModel.create({ username, emailId, age, password: await hashPassword(pass), role: 'customer' });
  res.status(201).json({ message: `Welcome to FORME, ${username}.`, ...await issueSession(res, user) });
}));
app.post('/api/login', authLimit, ...loginRules, route(async (req, res) => {
  const emailId = email(req.body.emailId);
  ensure(typeof req.body.password === 'string' && req.body.password.length <= 128, 'Enter your password.');
  const user: any = await UserModel.findOne({ emailId }).select('+password');
  // Spend comparable hashing time whether the user exists or not.
  const valid = user ? await verifyPassword(req.body.password, user.password) : (await hashPassword(req.body.password), false);
  ensure(valid, 'Email or password is incorrect.', 401);
  res.json({ message: `Welcome back, ${user.username}.`, ...await issueSession(res, user) });
}));
app.get('/api/session', authenticate, route(async (req, res) => res.json({ user: publicUser(who(req)), csrfToken: csrfFor((req as any).sessionToken) })));
app.post('/api/logout', authenticate, csrf, route(async (req, res) => {
  await UserModel.updateOne({ _id: who(req)._id }, { $inc: { tokenVersion: 1 }, $set: { sessions: [] } });
  clearSession(res); res.json({ message: 'You are logged out.' });
}));
app.get('/api/users/me', authenticate, route(async (req, res) => res.json(publicUser(who(req)))));
app.get('/api/users/profile', authenticate, route(async (req, res) => {
  ensure(!req.query.emailId || req.query.emailId === who(req).emailId, 'You can only view your own account.', 403);
  res.json(publicUser(who(req)));
}));
const updateProfile = route(async (req, res) => {
  const user: any = await UserModel.findById(who(req)._id).select('+password');
  ensure(!req.query.emailId || req.query.emailId === user.emailId, 'You can only update your own account.', 403);
  ensure(req.body.emailId === undefined || req.body.emailId === user.emailId, 'Email address cannot be changed.');
  const complete = req.method === 'PUT'; let passwordChanged = false;
  if (complete || req.body.username !== undefined) user.username = text(req.body.username, 'Name', 80, 2);
  if (complete || req.body.age !== undefined) user.age = number(req.body.age, 'Age', 1, 120);
  if (req.body.password !== undefined && req.body.password !== '') {
    ensure(await verifyPassword(req.body.currentPassword, user.password), 'Your current password is incorrect.', 403);
    user.password = await hashPassword(password(req.body.password));
    user.tokenVersion = (user.tokenVersion || 0) + 1; user.sessions = []; passwordChanged = true;
  }
  await user.save(); res.json({ message: 'Your profile has been updated.', ...await issueSession(res, user, passwordChanged ? undefined : (req as any).sessionId) });
});
app.put(['/api/users', '/api/users/me'], authenticate, csrf, updateProfile);
app.patch(['/api/users', '/api/users/me'], authenticate, csrf, updateProfile);
app.delete(['/api/users', '/api/users/me'], authenticate, csrf, authLimit, route(async (req, res) => {
  const user: any = await UserModel.findById(who(req)._id).select('+password');
  ensure(!req.query.emailId || req.query.emailId === user.emailId, 'You can only delete your own account.', 403);
  ensure(user.role !== 'admin', 'Admin accounts cannot be deleted through the storefront.', 403);
  ensure(await verifyPassword(req.body.currentPassword, user.password), 'Your password is incorrect.', 403);
  await eraseAccount(user._id);
  clearSession(res); res.json({ message: 'Your account has been deleted.' });
}));

app.post('/api/checkout/quote', authenticate, csrf, route(async (req, res) => res.json(await quoteCart(req.body, String(who(req)._id)))));
app.post('/api/orders', authenticate, csrf, rateLimit(15, 60000, 'orders'), route(async (req, res) => res.status(201).json(await placeOrder(req.body, who(req)))));
app.get('/api/orders', authenticate, route(async (req, res) => res.json(await OrderModel.find({ userId: who(req)._id }).sort({ createdAt: -1 }).limit(100).lean())));
app.patch('/api/orders/:id/cancel', authenticate, csrf, route(async (req, res) => res.json(await changeOrderStatus(String(req.params.id), 'Cancelled', who(req)))));

app.use('/api/admin', authenticate, adminOnly);
app.get('/api/admin/dashboard', route(async (_req, res) => {
  const [earnings, booked, totalOrders, customers, lowStock, products, recentOrders, trend] = await Promise.all([
    OrderModel.aggregate([{ $match: { status: 'Delivered', paymentStatus: 'collected' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    OrderModel.aggregate([{ $match: { status: { $ne: 'Cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    OrderModel.countDocuments(), UserModel.countDocuments({ role: { $ne: 'admin' } }),
    ProductModel.find({ active: true, quantity: { $lte: 5 } }).lean(), ProductModel.countDocuments({ active: true }),
    OrderModel.find().sort({ createdAt: -1 }).limit(6).lean(),
    OrderModel.aggregate([{ $match: { status: 'Delivered', updatedAt: { $gte: new Date(Date.now() - 7 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt', timezone: 'Asia/Kolkata' } }, total: { $sum: '$total' } } }, { $sort: { _id: 1 } }]),
  ]);
  res.json({ earnings: earnings[0]?.total || 0, booked: booked[0]?.total || 0, totalOrders, customers, lowStock, products, recentOrders, trend });
}));
app.get('/api/admin/products', route(async (_req, res) => res.json(await ProductModel.find().sort({ createdAt: -1 }).limit(500).lean())));
app.post('/api/admin/products', csrf, route(async (req, res) => {
  const data = productInput(req.body);
  res.status(201).json(await ProductModel.create({ ...data, productId: 'FRM-' + randomUUID().slice(0, 8).toUpperCase() }));
}));
app.put('/api/admin/products/:id', csrf, route(async (req, res) => {
  const data = productInput(req.body);
  const revision = number(req.body.revision, 'Inventory revision');
  const product = await ProductModel.findOneAndUpdate({ productId: String(req.params.id), revision }, { $set: data, ...(!data.originalPrice ? { $unset: { originalPrice: 1 } } : {}), $inc: { revision: 1 } }, { new: true, runValidators: true });
  ensure(product, 'Stock or product details changed. Reload before saving again.', 409); res.json(product);
}));
app.delete('/api/admin/products/:id', csrf, route(async (req, res) => {
  const product = await ProductModel.findOneAndUpdate({ productId: String(req.params.id), revision: number(req.body.revision, 'Revision') }, { $set: { active: false }, $inc: { revision: 1 } }, { new: true });
  ensure(product, 'Product changed. Please reload and try again.', 409); res.json({ message: 'Product archived. Existing order records are preserved.' });
}));
app.get('/api/admin/orders', route(async (_req, res) => res.json(await OrderModel.find().sort({ createdAt: -1 }).limit(500).lean())));
app.patch('/api/admin/orders/:id', csrf, route(async (req, res) => {
  ensure(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(req.body.status), 'Invalid order status.');
  res.json(await changeOrderStatus(String(req.params.id), req.body.status, who(req)));
}));
app.get('/api/admin/customers', route(async (_req, res) => {
  const users = await UserModel.aggregate([{ $match: { role: { $ne: 'admin' } } },
    { $lookup: { from: 'orders', let: { id: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$userId', '$$id'] }, { $ne: ['$status', 'Cancelled'] }] } } }, { $group: { _id: null, count: { $sum: 1 }, spent: { $sum: '$total' } } }], as: 'orders' } },
    { $project: { username: 1, emailId: 1, age: 1, createdAt: 1, orderCount: { $ifNull: [{ $arrayElemAt: ['$orders.count', 0] }, 0] }, spent: { $ifNull: [{ $arrayElemAt: ['$orders.spent', 0] }, 0] } } },
    { $sort: { createdAt: -1 } }, { $limit: 500 }]); res.json(users);
}));
app.get('/api/admin/coupons', route(async (_req, res) => res.json(await CouponModel.find().sort({ createdAt: -1 }).lean())));
app.post('/api/admin/coupons', csrf, route(async (req, res) => res.status(201).json(await CouponModel.create(couponInput(req.body)))));
app.patch('/api/admin/coupons/:id', csrf, route(async (req, res) => {
  ensure(typeof req.body.active === 'boolean', 'Choose an active state.');
  ensure(mongoose.isValidObjectId(req.params.id), 'Coupon not found.', 404);
  const coupon = await CouponModel.findByIdAndUpdate(req.params.id, { $set: { active: req.body.active } }, { new: true });
  ensure(coupon, 'Coupon not found.', 404); res.json(coupon);
}));
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API endpoint not found.')));
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
  if (error.code === 11000) return res.status(409).json({ message: 'This record already exists. Please use a unique email or code.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'The request is too large.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON request.' });
  if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ message: 'Please check the submitted fields.' });
  console.error('Request failed:', error.name || 'Error');
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});
