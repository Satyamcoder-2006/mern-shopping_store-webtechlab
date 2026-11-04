import mongoose from 'mongoose';
import { UserModel } from './models.ts';
import { ensure } from './domain.ts';
export async function userWrite<T>(userId: any, work: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const user = await UserModel.updateOne({ _id: userId }, { $inc: { writeRevision: 1 } }, { session });
      ensure(user.modifiedCount === 1, 'Your account is no longer active.', 401);
      return work(session);
    });
  } finally { await session.endSession(); }
}
