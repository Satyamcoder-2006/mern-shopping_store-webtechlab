import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ProductModel, CouponModel, OrderModel, UserModel } from './models.ts';
import { ensure, text, number, totals, shippingInput } from './domain.ts';

export async function quoteCart(body: any, userId: string, session: any = null) {
  ensure(Array.isArray(body.items) && body.items.length > 0 && body.items.length <= 40, 'Your bag must contain 1–40 items.');
  const requested = new Map<string, any>();
  for (const input of body.items) {
    ensure(input && typeof input === 'object', 'Invalid bag item.');
    const productId = text(input.productId, 'Product ID', 80);
    ensure(['XS', 'S', 'M', 'L', 'XL'].includes(input.size), 'Choose a size for each item.');
    const quantity = number(input.quantity, 'Quantity', 1, 10);
    const key = productId + ':' + input.size;
    const combined = (requested.get(key)?.quantity || 0) + quantity;
    ensure(combined <= 10, 'Maximum 10 of one size per order.');
    requested.set(key, { productId, size: input.size, quantity: combined });
  }
  const items: any[] = [];
  for (const input of requested.values()) {
    const product: any = await ProductModel.findOne({ productId: input.productId, active: true }).session(session);
    ensure(product, 'An item is no longer available. Please update your bag.', 409);
    const variant = product.variants.find((v: any) => v.size === input.size);
    ensure(variant && variant.stock >= input.quantity, `${product.productName} in ${input.size} has insufficient stock.`, 409);
    items.push({ ...input, productName: product.productName, unitPrice: product.productPrice, image: product.image, color: product.color });
  }
  let coupon: any = null;
  const code = typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : '';
  if (code) {
    ensure(code.length <= 24, 'Invalid coupon code.');
    coupon = await CouponModel.findOne({ code }).select('+usedBy').session(session);
    ensure(coupon, 'This coupon code was not found.');
    ensure(!coupon.usedBy.includes(userId), 'You have already used this coupon.');
  }
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  return { items, ...totals(subtotal, coupon), couponCode: coupon?.code || '', paymentMethod: 'cod' };
}

export async function placeOrder(body: any, user: any) {
  const address = shippingInput(body.address);
  const requestId = text(body.requestId, 'Request ID', 80, 16);
  ensure(body.paymentMethod === 'cod', 'Cash on delivery is the available payment method.');
  const existing = await OrderModel.findOne({ userId: user._id, requestId });
  if (existing) return existing;
  const session = await mongoose.startSession();
  let order: any;
  try {
    await session.withTransaction(async () => {
      const activeUser = await UserModel.updateOne({ _id: user._id }, { $inc: { writeRevision: 1 } }, { session });
      ensure(activeUser.modifiedCount === 1, 'Your account is no longer active.', 401);
      const alreadyPlaced = await OrderModel.findOne({ userId: user._id, requestId }).session(session);
      if (alreadyPlaced) { order = alreadyPlaced; return; }
      const quote = await quoteCart(body, String(user._id), session);
      for (const item of quote.items) {
        const result = await ProductModel.updateOne({ productId: item.productId, active: true,
          variants: { $elemMatch: { size: item.size, stock: { $gte: item.quantity } } } },
        { $inc: { 'variants.$.stock': -item.quantity, quantity: -item.quantity, revision: 1 } }, { session });
        ensure(result.modifiedCount === 1, 'Stock changed. Please refresh your bag and try again.', 409);
      }
      if (quote.couponCode) {
        const coupon: any = await CouponModel.findOneAndUpdate({ code: quote.couponCode, active: true,
          expiresAt: { $gt: new Date() }, usedBy: { $ne: String(user._id) }, $expr: { $lt: ['$usedCount', '$usageLimit'] } },
        { $inc: { usedCount: 1 }, $addToSet: { usedBy: String(user._id) } }, { session });
        ensure(coupon, 'The coupon is no longer available. Please try again.', 409);
      }
      [order] = await OrderModel.create([{ ...quote, address, orderId: 'FRM-' + randomUUID().slice(0, 8).toUpperCase(),
        userId: user._id, requestId, customerName: user.username, emailId: user.emailId }], { session });
    });
    return order;
  } catch (error: any) {
    if (error.code === 11000) {
      const duplicate = await OrderModel.findOne({ userId: user._id, requestId });
      if (duplicate) return duplicate;
    }
    throw error;
  } finally { await session.endSession(); }
}

export async function changeOrderStatus(orderId: string, status: string, user: any) {
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const order: any = await OrderModel.findOne({ orderId }).session(session);
      ensure(order, 'Order not found.', 404);
      ensure(user.role === 'admin' || String(order.userId) === String(user._id), 'Order not found.', 404);
      if (order.status === status) { result = order; return; }
      const next: Record<string, string[]> = { Pending: ['Processing', 'Cancelled'], Processing: ['Shipped', 'Cancelled'], Shipped: ['Delivered'], Delivered: [], Cancelled: [] };
      ensure(next[order.status].includes(status), 'That order status change is not allowed.', 409);
      ensure(user.role === 'admin' || status === 'Cancelled', 'You can only cancel your order.', 403);
      if (status === 'Cancelled') {
        for (const item of order.items) await ProductModel.updateOne({ productId: item.productId, 'variants.size': item.size },
          { $inc: { 'variants.$.stock': item.quantity, quantity: item.quantity, revision: 1 } }, { session });
        if (order.couponCode) await CouponModel.updateOne({ code: order.couponCode }, { $inc: { usedCount: -1 }, $pull: { usedBy: String(order.userId) } }, { session });
      }
      order.status = status;
      if (status === 'Delivered') {
        order.paymentStatus = 'collected';
        order.deliveredAt = new Date();
      }
      await order.save({ session }); result = order;
    });
    return result;
  } finally { await session.endSession(); }
}
