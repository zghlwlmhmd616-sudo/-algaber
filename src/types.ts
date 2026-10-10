export type Category = 'ادنائات' | 'دريسات' | 'نقابات' | 'خمار' | 'مكملات حجاب' | 'اسدالات';

export type Product = {
  id: string;
  name: string;
  category: Category;
  description: string;
  price: number;
  weightKg?: number;
  originalPrice?: number;
  discount?: number;
  badge: string;
  colors: string[];
  sizes: string[];
  stock: number;
  images: string[];
  variantImages?: Record<string, string>;
  featured: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  status: 'active' | 'hidden';
};

export type CartItem = {
  productId: string;
  color: string;
  size: string;
  quantity: number;
};

export type Review = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
};

export type OrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  color: string;
  size: string;
};

export type Order = {
  id: string;
  createdAt: string;
  customerName: string;
  phone: string;
  whatsapp: string;
  city: string;
  address: string;
  notes: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: string;
  paymentRef: string;
  depositAmount?: number;
  status: 'new' | 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';
};

export type ShippingZone = {
  city: string;
  rate: number;
  includedKg: number;
  extraKgRate: number;
  deliveryHours: number;
};

export type Settings = {
  shippingRate: number;
  freeShipping: boolean;
  paymentAccount: string;
  vodafoneCashNumber: string;
  depositAmount: number;
  shippingZones: ShippingZone[];
  whatsapp: string;
  facebook: string;
  aboutText: string;
  contactText: string;
  siteName: string;
  logoImage: string;
  heroImage: string;
  aboutImage: string;
  contactImage: string;
  categoryImages: Record<string, string>;
  brandPrimary: string;
  brandAccent: string;
};

export type AdminSession = {
  loggedIn: boolean;
  loginAt: string;
};
