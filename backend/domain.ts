export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function ensure(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export function text(value: unknown, name: string, max = 200, min = 1) {
  ensure(typeof value === 'string', `${name} is required.`);
  const result = value.trim();
  ensure(result.length >= min && result.length <= max, `${name} must be ${min}–${max} characters.`);
  return result;
}
export function number(value: unknown, name: string, min = 0, max = 1000000) {
  ensure(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, `${name} must be a whole number between ${min} and ${max}.`);
  return value;
}
export function email(value: unknown) {
  const result = text(value, 'Email', 254).toLowerCase();
  ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result), 'Enter a valid email address.');
  return result;
}
export function password(value: unknown) {
  ensure(typeof value === 'string' && value.length >= 8 && value.length <= 128, 'Use a password with 8–128 characters.');
  return value;
}
export function imageUrl(value: unknown) {
  const url = text(value, 'Image URL', 2000);
  if (/^\/catalog\/[a-z0-9-]+\.webp$/.test(url)) return url;
  try { ensure(new URL(url).protocol === 'https:', 'Images must use an HTTPS URL.'); }
  catch { throw new HttpError(400, 'Enter a valid HTTPS image URL.'); }
  return url;
}
export function productInput(body: any) {
  ensure(body && typeof body === 'object', 'Product details are required.');
  ensure(['Tops', 'Bottoms', 'Layers', 'Sets'].includes(body.category), 'Choose a clothing category.');
  ensure(['Women', 'Men', 'Unisex'].includes(body.gender), 'Choose a collection.');
  ensure(Array.isArray(body.variants) && body.variants.length === 5, 'Provide inventory for XS, S, M, L and XL.');
  const sizes = new Set();
  const variants = body.variants.map((v: any) => {
    ensure(v && ['XS', 'S', 'M', 'L', 'XL'].includes(v.size) && !sizes.has(v.size), 'Sizes must be valid and unique.');
    sizes.add(v.size); return { size: v.size, stock: number(v.stock, 'Stock', 0, 100000) };
  });
  const price = number(body.productPrice, 'Price', 1, 1000000);
  const originalPrice = body.originalPrice ? number(body.originalPrice, 'Original price', price, 1000000) : undefined;
  const images = Array.isArray(body.images) ? body.images.slice(0, 4).filter(Boolean).map(imageUrl) : [];
  const image = imageUrl(body.image);
  return { productName: text(body.productName, 'Product name', 120), productPrice: price, originalPrice, category: body.category,
    gender: body.gender, description: text(body.description, 'Description', 3000, 10), image, images: images.length ? images : [image],
    color: text(body.color || 'Natural', 'Colour', 40), material: text(body.material || 'See care label', 'Material', 200),
    care: text(body.care || 'Follow the care label.', 'Care', 400), badge: typeof body.badge === 'string' ? body.badge.trim().slice(0, 40) : '',
    featured: body.featured === true, active: body.active !== false, variants, quantity: variants.reduce((n: number, v: any) => n + v.stock, 0) };
}
export function couponInput(body: any) {
  const code = text(body.code, 'Coupon code', 24, 3).toUpperCase();
  ensure(/^[A-Z0-9_-]+$/.test(code), 'Coupon codes can contain letters, numbers, hyphens and underscores.');
  ensure(['percent', 'fixed'].includes(body.type), 'Choose percentage or fixed discount.');
  const expiresAt = new Date(body.expiresAt);
  ensure(Number.isFinite(expiresAt.getTime()) && expiresAt > new Date(), 'Choose a future expiry date.');
  return { code, type: body.type, value: number(body.value, 'Discount', 1, body.type === 'percent' ? 80 : 100000),
    minSpend: number(body.minSpend ?? 0, 'Minimum spend'), maxDiscount: number(body.maxDiscount ?? 0, 'Maximum discount'),
    usageLimit: number(body.usageLimit, 'Usage limit', 1, 100000), expiresAt, active: body.active !== false };
}
export function totals(subtotal: number, coupon: any = null) {
  let discount = 0;
  if (coupon) {
    ensure(coupon.active && new Date(coupon.expiresAt) > new Date(), 'This coupon has expired or is inactive.');
    ensure(coupon.usedCount < coupon.usageLimit, 'This coupon has reached its usage limit.');
    ensure(subtotal >= coupon.minSpend, `This coupon requires a minimum of ₹${coupon.minSpend}.`);
    discount = coupon.type === 'percent' ? Math.floor(subtotal * coupon.value / 100) : coupon.value;
    if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, subtotal);
  }
  const delivery = subtotal >= 1999 ? 0 : 99;
  return { subtotal, discount, delivery, total: subtotal - discount + delivery };
}
export function shippingInput(body: any) {
  ensure(body && typeof body === 'object', 'Shipping details are required.');
  const phone = text(body.phone, 'Phone number', 15).replace(/\s/g, '');
  ensure(/^[6-9]\d{9}$/.test(phone), 'Enter a valid 10 digit Indian mobile number.');
  const pinCode = text(body.pinCode, 'PIN code', 6, 6);
  ensure(/^[1-9]\d{5}$/.test(pinCode), 'Enter a valid 6 digit PIN code.');
  return { fullName: text(body.fullName, 'Full name', 80), phone, pinCode,
    line1: text(body.line1, 'Address', 250, 5), city: text(body.city, 'City', 80), state: text(body.state, 'State', 80) };
}
