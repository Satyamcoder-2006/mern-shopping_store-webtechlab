import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { UserModel, OrderModel, ProductModel, CouponModel, MediaModel, ReviewModel, FaceoffModel, VoteModel } from './models.ts';
import { ensure } from './domain.ts';
export async function eraseAccount(userId: any) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await UserModel.findOneAndUpdate({ _id: userId, role: { $ne: 'admin' } }, { $inc: { writeRevision: 1 } }, { session });
      ensure(user, 'Account not found.', 404);
      ensure(!await OrderModel.exists({ userId, status: 'Shipped' }).session(session), 'An order is in transit. Close your account after delivery or contact support to resolve it.', 409);
      const pending = await OrderModel.find({ userId, status: { $in: ['Pending', 'Processing'] } }).session(session);
      for (const order of pending) {
        for (const item of order.items) await ProductModel.updateOne({ productId: item.productId, 'variants.size': item.size }, { $inc: { 'variants.$.stock': item.quantity, quantity: item.quantity, revision: 1 } }, { session });
        if (order.couponCode) await CouponModel.updateOne({ code: order.couponCode, usedBy: String(userId) }, { $inc: { usedCount: -1 }, $pull: { usedBy: String(userId) } }, { session });
        order.status = 'Cancelled'; await order.save({ session });
      }
      // Keep non-identifying financial/product snapshots, remove all customer PII
      // and links. Shipped orders are blocked above to preserve fulfilment.
      const retained = await OrderModel.find({ userId }).select('_id status deliveredAt updatedAt').session(session).lean();
      for (const order of retained) await OrderModel.updateOne({ _id: order._id }, {
        $unset: { emailId: 1, address: 1 },
        $set: {
          userId: new mongoose.Types.ObjectId(), requestId: 'anon-' + randomUUID(), customerName: 'Deleted customer',
          ...(order.status === 'Delivered' && !order.deliveredAt ? { deliveredAt: order.updatedAt } : {}),
        },
      }, { session });
      await CouponModel.updateMany({ usedBy: String(userId) }, { $pull: { usedBy: String(userId) } }, { session });
      const owned = await FaceoffModel.find({ userId }).select('_id').session(session).lean();
      await VoteModel.deleteMany({ $or: [{ userId }, { faceoffId: { $in: owned.map(p => p._id) } }] }, { session });
      await FaceoffModel.deleteMany({ userId }, { session });
      await ReviewModel.deleteMany({ userId }, { session });
      await MediaModel.deleteMany({ ownerId: userId }, { session });
      await UserModel.deleteOne({ _id: userId }, { session });
    });
  } finally { await session.endSession(); }
}
