export interface Product {
  productId: string; productName: string; productPrice: number; originalPrice?: number;
  category: string; gender: string; color: string; description: string; image: string; images: string[];
  material: string; care: string; badge: string; featured: boolean; active: boolean; quantity: number;
  variants: { size: string; stock: number }[]; revision: number;
}
export interface Customer { id: string; username: string; emailId: string; age: number; role: 'customer' | 'admin' }
export interface BagItem { productId: string; size: string; quantity: number }
export interface Order {
  orderId: string; customerName: string; emailId: string; createdAt: string; status: string; paymentStatus: string;
  items: { productId: string; productName: string; image: string; color: string; size: string; quantity: number; unitPrice: number }[];
  address: { fullName: string; phone: string; line1: string; city: string; state: string; pinCode: string };
  subtotal: number; discount: number; delivery: number; total: number; couponCode: string;
}
export const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
export const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
