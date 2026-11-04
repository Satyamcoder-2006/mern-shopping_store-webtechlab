import mongoose from 'mongoose';
const { Schema } = mongoose;
const integer = (value: number) => Number.isSafeInteger(value);
const userSchema = new Schema({
  username: { type: String, required: true, trim: true, maxlength: 80 },
  emailId: { type: String, required: true, unique: true, trim: true, lowercase: true },
  age: { type: Number, required: true, min: 1, max: 120 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  tokenVersion: { type: Number, default: 0 },
  writeRevision: { type: Number, default: 0 },
  sessions: [{ _id: false, id: String, createdAt: Date, expiresAt: Date }],
}, { timestamps: true });
const productSchema = new Schema({
  productId: { type: String, required: true, unique: true },
  productName: { type: String, required: true, maxlength: 120 },
  productPrice: { type: Number, required: true, min: 1, validate: integer },
  originalPrice: { type: Number, min: 1, validate: integer },
  category: { type: String, enum: ['Tops', 'Bottoms', 'Layers', 'Sets'], required: true },
  gender: { type: String, enum: ['Women', 'Men', 'Unisex'], default: 'Unisex' },
  color: { type: String, default: 'Natural', maxlength: 40 },
  quantity: { type: Number, min: 0, required: true, validate: integer },
  variants: [{ _id: false, size: { type: String, enum: ['XS', 'S', 'M', 'L', 'XL'], required: true }, stock: { type: Number, required: true, min: 0, validate: integer } }],
  description: { type: String, required: true, maxlength: 3000 },
  image: { type: String, required: true }, images: [String],
  material: { type: String, maxlength: 200 }, care: { type: String, maxlength: 400 },
  badge: { type: String, maxlength: 40 }, featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true }, revision: { type: Number, default: 0 },
}, { timestamps: true });
const couponSchema = new Schema({
  code: { type: String, required: true, uppercase: true, unique: true },
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true, min: 1 },
  minSpend: { type: Number, default: 0 }, maxDiscount: { type: Number, default: 0 },
  usageLimit: { type: Number, required: true }, usedCount: { type: Number, default: 0 },
  usedBy: { type: [String], default: [], select: false },
  expiresAt: { type: Date, required: true }, active: { type: Boolean, default: true },
}, { timestamps: true });
const orderSchema = new Schema({
  orderId: { type: String, unique: true, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requestId: { type: String, required: true },
  customerName: String, emailId: String,
  items: [{ _id: false, productId: String, productName: String, image: String, size: String, color: String, quantity: Number, unitPrice: Number }],
  address: { fullName: String, phone: String, line1: String, city: String, state: String, pinCode: String },
  subtotal: Number, discount: Number, delivery: Number, total: Number,
  couponCode: { type: String, default: '' },
  paymentMethod: { type: String, default: 'cod', enum: ['cod'] },
  paymentStatus: { type: String, default: 'unpaid', enum: ['unpaid', 'collected'] },
  status: { type: String, default: 'Pending', enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] },
}, { timestamps: true });
orderSchema.index({ userId: 1, requestId: 1 }, { unique: true });
orderSchema.index({ createdAt: -1 });
export const UserModel = mongoose.models.User || mongoose.model('User', userSchema, 'users');
export const ProductModel = mongoose.models.Product || mongoose.model('Product', productSchema, 'products');
export const CouponModel = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema, 'coupons');
export const OrderModel = mongoose.models.Order || mongoose.model('Order', orderSchema, 'orders');

const mediaSchema = new Schema({
  mediaId: { type: String, required: true, unique: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  attachedTo: { type: String, default: '', index: true },
  bytes: Number,
}, { timestamps: true });
const reviewSchema = new Schema({
  productId: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: integer },
  text: { type: String, required: true, maxlength: 2000 },
  images: [String], verifiedPurchase: { type: Boolean, default: false },
}, { timestamps: true });
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
const faceoffSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 140 },
  caption: { type: String, maxlength: 500 },
  looks: [{ _id: false, image: String, label: String }],
  closesAt: { type: Date, required: true },
}, { timestamps: true });
faceoffSchema.index({ createdAt: -1 });
const voteSchema = new Schema({
  faceoffId: { type: Schema.Types.ObjectId, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  option: { type: Number, required: true, min: 0, max: 2, validate: integer },
}, { timestamps: true });
voteSchema.index({ faceoffId: 1, userId: 1 }, { unique: true });
export const MediaModel = mongoose.models.Media || mongoose.model('Media', mediaSchema, 'media');
export const ReviewModel = mongoose.models.Review || mongoose.model('Review', reviewSchema, 'reviews');
export const FaceoffModel = mongoose.models.Faceoff || mongoose.model('Faceoff', faceoffSchema, 'faceoffs');
export const VoteModel = mongoose.models.Vote || mongoose.model('Vote', voteSchema, 'votes');
