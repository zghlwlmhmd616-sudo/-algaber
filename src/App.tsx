import {
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Minus,
  PackageCheck,
  PhoneCall,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Truck,
  UserRound,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BrowserRouter,
  HashRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { demoProducts, demoReviews, defaultSettings } from './data';
import type { CartItem, Category, Order, Product, Review, Settings } from './types';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  bootstrapStore,
  createOrder,
  createReview,
  loadOrders,
  loadProducts,
  loadReviews,
  loadSettings,
  saveOrders,
  saveProducts,
  saveReviews,
  saveSettings,
  uploadStoreImage,
  verifyAdmin,
} from './lib/storeApi';

const categoryMeta = [
  { name: 'ادنائات', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80' },
  { name: 'دريسات', image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80' },
  { name: 'نقابات', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80' },
  { name: 'خمار', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80' },
  { name: 'مكملات حجاب', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80' },
  { name: 'اسدالات', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80' },
];

const legacyCategories: Record<string, Category> = {
  نقاب: 'نقابات',
  خمار: 'خمار',
  دريسات: 'دريسات',
  إدناءات: 'ادنائات',
  مكملات: 'مكملات حجاب',
  أطقم: 'اسدالات',
};

function migrateProductCategory(product: Product): Product {
  const category = product.name.includes('خمار')
    ? 'خمار'
    : legacyCategories[product.category] ?? product.category;
  return { ...product, category };
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readSettings(): Settings {
  const stored = readStorage<Partial<Settings>>('aljaber_settings', {});
  const previousShippingDefaults = [
    { city: 'القاهرة', rate: 45 },
    { city: 'الجيزة', rate: 50 },
    { city: 'الإسكندرية', rate: 60 },
    { city: 'محافظة أخرى', rate: 75 },
  ];
  const hasPreviousShippingDefaults = stored.shippingZones?.length === previousShippingDefaults.length
    && stored.shippingZones.every((zone, index) => zone.city === previousShippingDefaults[index].city && zone.rate === previousShippingDefaults[index].rate);
  const hasOldTableShippingDefaults = stored.shippingZones?.length === defaultSettings.shippingZones.length
    && stored.shippingZones.every((zone, index) => {
      const current = defaultSettings.shippingZones[index];
      const previousDeliveryTime = index === 4 && zone.deliveryHours === 48;
      return zone.city === current.city
        && zone.rate === current.rate
        && zone.includedKg === current.includedKg
        && zone.extraKgRate === current.extraKgRate
        && (zone.deliveryHours === current.deliveryHours || previousDeliveryTime);
    });

  return {
    ...defaultSettings,
    ...stored,
    vodafoneCashNumber: stored.vodafoneCashNumber === '01108372315'
      ? defaultSettings.vodafoneCashNumber
      : stored.vodafoneCashNumber ?? defaultSettings.vodafoneCashNumber,
    whatsapp: stored.whatsapp === '+966500000000' ? '' : stored.whatsapp ?? defaultSettings.whatsapp,
    brandPrimary: stored.brandPrimary === '#2f1e17' ? defaultSettings.brandPrimary : stored.brandPrimary ?? defaultSettings.brandPrimary,
    brandAccent: stored.brandAccent === '#d7b28b' ? defaultSettings.brandAccent : stored.brandAccent ?? defaultSettings.brandAccent,
    categoryImages: {
      ...defaultSettings.categoryImages,
      ...(stored.categoryImages?.['نقاب'] ? { نقابات: stored.categoryImages['نقاب'] } : {}),
      ...(stored.categoryImages?.['إدناءات'] ? { ادنائات: stored.categoryImages['إدناءات'] } : {}),
      ...(stored.categoryImages?.['مكملات'] ? { 'مكملات حجاب': stored.categoryImages['مكملات'] } : {}),
      ...(stored.categoryImages?.['أطقم'] ? { اسدالات: stored.categoryImages['أطقم'] } : {}),
      ...stored.categoryImages,
    },
    shippingZones: hasPreviousShippingDefaults || hasOldTableShippingDefaults
      ? defaultSettings.shippingZones
      : stored.shippingZones?.length ? stored.shippingZones : defaultSettings.shippingZones,
  };
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.onload = () => {
      image.onerror = () => reject(new Error('صيغة الصورة غير مدعومة'));
      image.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('تعذر معالجة الصورة'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function persistImage(file: File) {
  const compressedImage = await compressImage(file);
  return isSupabaseConfigured ? uploadStoreImage(compressedImage) : compressedImage;
}

function getShippingRate(settings: Settings, city: string, weightKg = 1) {
  if (settings.freeShipping) return 0;
  const zone = settings.shippingZones.find((entry) => entry.city === city);
  if (!zone) return settings.shippingRate;
  const extraWeight = Math.max(0, Math.ceil(weightKg - zone.includedKg));
  return zone.rate + extraWeight * zone.extraKgRate;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(value);
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseVariantImages(value: string): Record<string, string> {
  return Object.fromEntries(
    value.split(/\r?\n/).map((line) => line.split('|').map((part) => part.trim())).filter(([color, image]) => color && image),
  );
}

function App() {
  const StoreRouter = import.meta.env.BASE_URL === '/' ? BrowserRouter : HashRouter;
  const [products, setProducts] = useState<Product[]>(() => readStorage('aljaber_products', demoProducts).map(migrateProductCategory));
  const [cart, setCart] = useState<CartItem[]>(() => readStorage('aljaber_cart', [] as CartItem[]));
  const [orders, setOrders] = useState<Order[]>(() => readStorage('aljaber_orders', [] as Order[]));
  const [reviews, setReviews] = useState<Review[]>(() => readStorage('aljaber_reviews', demoReviews));
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [darkMode, setDarkMode] = useState<boolean>(() => readStorage('aljaber_dark_mode', false));
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [backendReady, setBackendReady] = useState(!isSupabaseConfigured);
  const [backendError, setBackendError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => writeStorage('aljaber_products', products), [products]);
  useEffect(() => writeStorage('aljaber_cart', cart), [cart]);
  useEffect(() => writeStorage('aljaber_orders', orders), [orders]);
  useEffect(() => writeStorage('aljaber_reviews', reviews), [reviews]);
  useEffect(() => writeStorage('aljaber_settings', settings), [settings]);
  useEffect(() => writeStorage('aljaber_dark_mode', darkMode), [darkMode]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const restoreAdmin = async () => {
      const client = supabase;
      if (!client) return;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) return;
      const allowed = await verifyAdmin(data.session.user.id);
      if (allowed && !cancelled) {
        setBackendReady(false);
        setAdminLoggedIn(true);
      }
      if (!allowed) await client.auth.signOut();
    };
    void restoreAdmin().catch((error: unknown) => {
      console.error('Failed to restore admin session', error);
      if (!cancelled) setBackendError('تعذر التحقق من جلسة الإدارة. سجّل الدخول مرة أخرى.');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const refreshRemoteData = async () => {
      try {
        const [remoteProducts, remoteReviews, remoteSettings] = await Promise.all([
          loadProducts(),
          loadReviews(),
          loadSettings(),
        ]);
        const remoteOrders = adminLoggedIn ? await loadOrders() : undefined;
        if (cancelled) return;
        setProducts(remoteProducts.map(migrateProductCategory));
        setReviews(remoteReviews);
        if (remoteOrders) setOrders(remoteOrders);
        if (remoteSettings) {
          setSettings({
            ...defaultSettings,
            ...remoteSettings,
            categoryImages: { ...defaultSettings.categoryImages, ...remoteSettings.categoryImages },
          });
        }
        setBackendError('');
      } catch (error) {
        console.error('Failed to load store data', error);
        if (!cancelled) setBackendError('تعذر الاتصال بقاعدة بيانات المتجر. تحقّق من إعداد Supabase وتشغيل schema.sql.');
      } finally {
        if (!cancelled) setBackendReady(true);
      }
    };
    void refreshRemoteData();
    return () => { cancelled = true; };
  }, [adminLoggedIn]);

  useEffect(() => {
    if (!isSupabaseConfigured || !backendReady || !adminLoggedIn) return;
    void saveProducts(products).catch((error: unknown) => {
      console.error('Failed to save products', error);
      setBackendError('تعذر حفظ تغييرات المنتجات في قاعدة البيانات.');
    });
  }, [products, backendReady, adminLoggedIn]);

  useEffect(() => {
    if (!isSupabaseConfigured || !backendReady || !adminLoggedIn) return;
    void saveOrders(orders).catch((error: unknown) => {
      console.error('Failed to save orders', error);
      setBackendError('تعذر حفظ تغييرات الطلبات في قاعدة البيانات.');
    });
  }, [orders, backendReady, adminLoggedIn]);

  useEffect(() => {
    if (!isSupabaseConfigured || !backendReady || !adminLoggedIn) return;
    void saveReviews(reviews).catch((error: unknown) => {
      console.error('Failed to save reviews', error);
      setBackendError('تعذر حفظ تغييرات التقييمات في قاعدة البيانات.');
    });
  }, [reviews, backendReady, adminLoggedIn]);

  useEffect(() => {
    if (!isSupabaseConfigured || !backendReady || !adminLoggedIn) return;
    void saveSettings(settings).catch((error: unknown) => {
      console.error('Failed to save settings', error);
      setBackendError('تعذر حفظ إعدادات المتجر في قاعدة البيانات.');
    });
  }, [settings, backendReady, adminLoggedIn]);

  const activeProducts = products.filter((product) => product.status === 'active');
  const cartDetails = useMemo(
    () =>
      cart
        .map((item) => {
          const product = activeProducts.find((entry) => entry.id === item.productId);
          return product ? { ...item, product } : null;
        })
        .filter(Boolean) as Array<CartItem & { product: Product }>,
    [cart, activeProducts],
  );

  const subtotal = cartDetails.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalWeightKg = cartDetails.reduce((sum, item) => sum + (item.product.weightKg ?? 1) * item.quantity, 0);
  const defaultZone = settings.shippingZones[0]?.city ?? '';
  const shipping = getShippingRate(settings, defaultZone, totalWeightKg);
  const total = subtotal + shipping;

  const addToCart = (product: Product, color = product.colors[0], size = product.sizes[0]) => {
    setCart((prev) => {
      const match = prev.find(
        (item) => item.productId === product.id && item.color === color && item.size === size,
      );
      if (match) {
        return prev.map((item) =>
          item.productId === product.id && item.color === color && item.size === size
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { productId: product.id, color, size, quantity: 1 }];
    });
  };

  const updateCartQty = (productId: string, color: string, size: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.productId !== productId || item.color !== color || item.size !== size) return [item];
        const qty = item.quantity + delta;
        return qty > 0 ? [{ ...item, quantity: qty }] : [];
      }),
    );
  };

  const removeCartItem = (productId: string, color: string, size: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.productId === productId && item.color === color && item.size === size)),
    );
  };

  const placeOrder = async (payload: {
    customerName: string;
    phone: string;
    whatsapp: string;
    city: string;
    address: string;
    notes: string;
    paymentMethod: string;
    paymentRef: string;
    depositAmount: number;
  }) => {
    if (!isSupabaseConfigured) throw new Error('إعداد قاعدة البيانات مطلوب قبل استقبال الطلبات.');
    if (!cartDetails.length) return undefined;
    const orderWeightKg = cartDetails.reduce((sum, item) => sum + (item.product.weightKg ?? 1) * item.quantity, 0);
    const orderShipping = getShippingRate(settings, payload.city, orderWeightKg);
    const orderTotal = subtotal + orderShipping;

    const order: Order = {
      id: generateId('ORD'),
      createdAt: new Date().toISOString(),
      customerName: payload.customerName,
      phone: payload.phone,
      whatsapp: payload.whatsapp,
      city: payload.city,
      address: payload.address,
      notes: payload.notes,
      items: cartDetails.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        color: item.color,
        size: item.size,
      })),
      subtotal,
      shipping: orderShipping,
      total: orderTotal,
      paymentMethod: payload.paymentMethod,
      paymentRef: payload.paymentRef,
      depositAmount: payload.depositAmount,
      status: 'new',
    };

    if (isSupabaseConfigured) await createOrder(order);
    setOrders((prev) => [order, ...prev]);
    setCart([]);
    return order;
  };

  const submitReview = async (review: Omit<Review, 'id' | 'createdAt' | 'status'>) => {
    const newReview: Review = {
      ...review,
      id: generateId('REV'),
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    if (isSupabaseConfigured) await createReview(newReview);
    setReviews((prev) => [newReview, ...prev]);
  };

  const loginAdmin = async (email: string, password: string) => {
    if (!supabase) return 'إعداد Supabase مطلوب قبل تسجيل دخول الإدارة.';
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      if (!await verifyAdmin(data.user.id)) {
        await supabase.auth.signOut();
        return 'هذا الحساب غير مضاف كمسؤول للمتجر.';
      }
      await bootstrapStore(settings);
      setBackendError('');
      setBackendReady(false);
      setAdminLoggedIn(true);
      return undefined;
    } catch (error) {
      console.error('Failed to initialize admin session', error);
      await supabase.auth.signOut();
      return 'تعذر الاتصال بقاعدة البيانات. راجع إعدادات Supabase وحاول مرة أخرى.';
    }
  };

  const logoutAdmin = () => {
    setBackendReady(false);
    setAdminLoggedIn(false);
    if (supabase) void supabase.auth.signOut();
  };

  const approvedReviews = reviews.filter((review) => review.status === 'approved');
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
  const lowStockCount = products.filter((product) => product.stock < 10 && product.status === 'active').length;

  return (
    <StoreRouter>
      <div
        className={`min-h-screen bg-[#f7f2eb] text-[#1a120d] antialiased ${darkMode ? 'theme-dark' : ''}`}
        style={{ '--brand-primary': settings.brandPrimary, '--brand-accent': settings.brandAccent } as CSSProperties}
      >
        <Header
          settings={settings}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((current) => !current)}
          cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          adminLoggedIn={adminLoggedIn}
          onLogout={logoutAdmin}
        />

        {isSupabaseConfigured && backendError && <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-xl border border-[#a5533d] bg-[#fffaf5] px-4 py-3 text-sm text-[#7b4537]">{backendError}</div>}

        <main>
          <Routes>
            <Route path="/" element={<HomePage products={activeProducts} reviews={approvedReviews} settings={settings} addToCart={addToCart} onSubmitReview={submitReview} />} />
            <Route path="/shop" element={<ShopPage products={activeProducts} addToCart={addToCart} />} />
            <Route path="/product/:id" element={<ProductDetailPage products={activeProducts} addToCart={addToCart} />} />
            <Route path="/cart" element={<CartPage cartItems={cartDetails} subtotal={subtotal} shipping={shipping} total={total} updateCartQty={updateCartQty} removeCartItem={removeCartItem} />} />
            <Route path="/checkout" element={<CheckoutPage cartItems={cartDetails} subtotal={subtotal} settings={settings} onPlaceOrder={placeOrder} />} />
            <Route path="/order-success" element={<OrderSuccessPage />} />
            <Route path="/about" element={<AboutPage settings={settings} />} />
            <Route path="/contact" element={<ContactPage settings={settings} />} />
            <Route path="/admin/login" element={adminLoggedIn ? <Navigate to="/admin" replace /> : <AdminLoginPage onLogin={loginAdmin} />} />
            <Route path="/admin" element={<ProtectedAdmin isLoggedIn={adminLoggedIn}><AdminLayout onLogout={logoutAdmin} /></ProtectedAdmin>}>
              <Route index element={<AdminDashboardPage products={activeProducts} orders={orders} reviews={reviews} totalSales={totalSales} lowStockCount={lowStockCount} />} />
              <Route path="products" element={<AdminProductsPage products={products} setProducts={setProducts} />} />
              <Route path="orders" element={<AdminOrdersPage orders={orders} setOrders={setOrders} />} />
              <Route path="reviews" element={<AdminReviewsPage reviews={reviews} setReviews={setReviews} />} />
              <Route path="shipping" element={<AdminShippingPage settings={settings} setSettings={setSettings} />} />
              <Route path="settings" element={<AdminSiteSettingsPage settings={settings} setSettings={setSettings} />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <Footer settings={settings} />
      </div>
    </StoreRouter>
  );
}

function Header({
  settings,
  darkMode,
  onToggleTheme,
  cartCount,
  mobileMenuOpen,
  setMobileMenuOpen,
  adminLoggedIn,
  onLogout,
}: {
  settings: Settings;
  darkMode: boolean;
  onToggleTheme: () => void;
  cartCount: number;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (value: boolean) => void;
  adminLoggedIn: boolean;
  onLogout: () => void;
}) {
  const navItems = [
    { label: 'الرئيسية', to: '/' },
    { label: 'المنتجات', to: '/shop' },
    { label: 'من نحن', to: '/about' },
    { label: 'تواصل معنا', to: '/contact' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#d9c3a7]/70 bg-[#f7f2eb]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {settings.logoImage ? (
            <img src={settings.logoImage} alt={settings.siteName} className="h-12 w-12 rounded-xl object-contain" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2f1e17] text-xl font-black text-[#f6efe7]">ج</div>
          )}
          <div>
            <p className="text-lg font-black text-[#2f1e17]">ال جابر</p>
            <p className="text-[11px] text-[#7a6257]">للزي الشرعي</p>
          </div>
        </div>

        <nav className="hidden items-center gap-7 text-sm font-bold text-[#4d352f] lg:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'text-[#2f1e17]' : 'text-[#5a4237]')}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={darkMode ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
            title={darkMode ? 'الوضع الفاتح' : 'الوضع الداكن'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d7c2a5] bg-[#fffaf5] text-[#2f1e17] transition hover:opacity-80"
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {adminLoggedIn ? (
            <button onClick={onLogout} className="hidden rounded-full border border-[#d2b38f] bg-[#f6efe7] px-3 py-2 text-xs font-bold text-[#2f1e17] lg:inline-flex">تسجيل الخروج</button>
          ) : (
            <Link to="/admin/login" className="hidden rounded-full border border-[#d2b38f] bg-[#f6efe7] px-3 py-2 text-xs font-bold text-[#2f1e17] lg:inline-flex">الإدارة</Link>
          )}
          <Link to="/cart" className="inline-flex items-center gap-2 rounded-full bg-[#2f1e17] px-4 py-2.5 text-sm font-bold text-[#fffaf5] shadow-lg shadow-[#2f1e17]/20">
            <ShoppingBag className="h-4 w-4" />
            <span>السلة</span>
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#d7b28b] px-1 text-xs text-[#2f1e17]">{cartCount}</span>
          </Link>
          <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d7c2a5] bg-[#fffaf5] text-[#2f1e17] lg:hidden">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-[#d4c0a5] bg-[#fffaf5] lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `rounded-xl px-3 py-2 text-right text-sm font-bold ${isActive ? 'bg-[#f2e5d7] text-[#2f1e17]' : 'text-[#5a4237]'}`}>
                {item.label}
              </NavLink>
            ))}
            <Link to="/admin/login" onClick={() => setMobileMenuOpen(false)} className="rounded-xl border border-[#d7b28b] bg-[#f7f1ea] px-3 py-2 text-right text-sm font-bold text-[#2f1e17]">الإدارة</Link>
          </div>
        </div>
      )}
    </header>
  );
}

function HomePage({
  products,
  reviews,
  settings,
  addToCart,
  onSubmitReview,
}: {
  products: Product[];
  reviews: Review[];
  settings: Settings;
  addToCart: (product: Product, color?: string, size?: string) => void;
  onSubmitReview: (review: Omit<Review, 'id' | 'createdAt' | 'status'>) => Promise<void>;
}) {
  const featuredProducts = products.filter((product) => product.featured).slice(0, 4);
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  const handleReviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReviewError('');
    try {
      await onSubmitReview({ name: reviewName.trim(), rating: reviewRating, comment: reviewComment.trim() });
      setReviewName('');
      setReviewComment('');
      setReviewRating(5);
      setReviewSubmitted(true);
    } catch {
      setReviewError('تعذر إرسال التقييم الآن. حاولي مرة أخرى.');
    }
  };

  return (
    <>
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(193,157,101,0.2),_transparent_30%)] py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="space-y-7">
            <span className="inline-flex rounded-full border border-[#d7b28b] bg-[#f5eadb] px-3 py-1 text-xs font-bold text-[#2f1e17]">أناقة محتشمة... وذوق يليق بكِ</span>
            <div className="space-y-4">
              <h1 className="text-4xl font-black leading-tight text-[#2f1d18] sm:text-5xl lg:text-6xl">{settings.siteName}</h1>
              <p className="max-w-xl text-lg leading-8 text-[#5a4237]">اكتشفي تشكيلتنا من الإدناءات والدريسات والنقابات والخمار ومكملات الحجاب والإسدالات بتصميم أنيق وتجربة تسوق سهلة.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link to="/shop" className="rounded-full bg-[#2f1e17] px-6 py-3 text-sm font-bold text-[#fffaf5] shadow-xl shadow-[#2f1e17]/20">تسوقي الآن</Link>
              <Link to="/shop" className="rounded-full border border-[#d7b28b] bg-[#fffaf5] px-6 py-3 text-sm font-bold text-[#2f1e17]">اكتشفي الموديلات</Link>
            </div>
            <div className="grid max-w-lg grid-cols-3 gap-4 pt-4 text-center">
              {[
                { label: 'عميل راضٍ', value: '+1200' },
                { label: 'تقييم', value: '4.9/5' },
                { label: 'توصيل', value: '48 ساعة' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-[#e8d5ba] bg-[#fffaf5] p-4 shadow-sm">
                  <div className="text-2xl font-black text-[#2f1e17]">{item.value}</div>
                  <div className="mt-1 text-xs text-[#6c5449]">{item.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="relative">
            <div className="absolute -right-3 top-8 rounded-full bg-[#f2e5d7] px-3 py-2 text-sm font-bold text-[#2f1e17] shadow-lg">جديد</div>
            <div className="absolute -left-4 bottom-8 rounded-full bg-[#fffaf5] px-3 py-2 text-sm font-bold text-[#2f1e17] shadow-lg">خصم 30%</div>
            <div className="overflow-hidden rounded-[30px] border border-[#e5d4b5] bg-[#f0e4d3] p-3 shadow-[0_30px_80px_rgba(47,30,23,0.12)]">
              <img src={settings.heroImage} alt="متجر ال جابر للزي الشرعي" className="h-[540px] w-full rounded-[24px] object-cover" />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#9e7650]">تسوقي حسب القسم</p>
            <h2 className="mt-1 text-3xl font-black text-[#2f1e17]">اكتشفي أفضل التصنيفات</h2>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {categoryMeta.map((category) => (
            <Link key={category.name} to="/shop" className="group overflow-hidden rounded-[28px] border border-[#e9d8be] bg-[#fffaf5] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="relative overflow-hidden">
                <img src={settings.categoryImages[category.name] || category.image} alt={category.name} className="h-64 w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2f1e17]/70 to-transparent" />
              </div>
              <div className="flex items-center justify-between p-5">
                <div>
                  <h3 className="text-2xl font-black text-[#2f1e17]">{category.name}</h3>
                  <p className="text-sm text-[#6c5449]">اكتشفي الموديلات المختارة</p>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f1e5d4] text-[#2f1e17]">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[#f0e7df] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#9e7650]">مميزتنا</p>
              <h2 className="mt-1 text-3xl font-black text-[#2f1e17]">منتجات مختارة بعناية</h2>
            </div>
            <Link to="/shop" className="hidden rounded-full border border-[#d7b28b] bg-[#fffaf5] px-5 py-2.5 text-sm font-bold text-[#2f1e17] sm:inline-flex">عرض الكل</Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} addToCart={addToCart} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: <Sparkles className="h-6 w-6" />, title: 'خياطة مميزة', text: 'أقمشة عالية الجودة مع تفاصيل دقيقة وتجهيز أنيق.' },
            { icon: <ShieldCheck className="h-6 w-6" />, title: 'ضمان الجودة', text: 'نقدم لكِ قطعًا تدوم طويلًا وتصلح للاستخدام اليومي والمناسبات.' },
            { icon: <Truck className="h-6 w-6" />, title: 'توصيل سريع', text: 'تسليم خلال 48 ساعة داخل المدينة مع متابعة مباشرة.' },
          ].map((item) => (
            <div key={item.title} className="rounded-[26px] border border-[#e8d7bc] bg-[#fffaf5] p-6 text-right shadow-sm">
              <div className="mb-4 inline-flex rounded-2xl bg-[#f2e5d7] p-3 text-[#2f1e17]">{item.icon}</div>
              <h3 className="text-2xl font-black text-[#2f1e17]">{item.title}</h3>
              <p className="mt-3 text-base leading-8 text-[#5a4237]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#1d120d] py-16 text-[#f9f3ee]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-bold text-[#d7b28b]">آراء العملاء</p>
            <h2 className="mt-2 text-3xl font-black">ما يقوله عملاؤنا</h2>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[#f1e6de]">
              <span className="flex gap-1 text-[#e0bb84]" aria-label={`متوسط التقييم ${averageRating.toFixed(1)} من 5`}>
                {Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-4 w-4 ${index < Math.round(averageRating) ? 'fill-current' : ''}`} />)}
              </span>
              <span>{reviews.length ? `${averageRating.toFixed(1)} من 5 • ${reviews.length} تقييمات` : 'لا توجد تقييمات بعد'}</span>
            </div>
          </div>

          {reviews.length ? (
            <div className="grid gap-6 md:grid-cols-3">
              {reviews.slice(0, 3).map((review) => (
              <div key={review.id} className="rounded-[24px] border border-[#3b2b23] bg-[#251914] p-6">
                <div className="mb-3 flex gap-1 text-[#e0bb84]">
                  {Array.from({ length: review.rating }).map((_, index) => (
                    <Star key={`${review.id}-${index}`} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-base leading-8 text-[#f1e6de]">“{review.comment}”</p>
                <div className="mt-4 text-sm font-bold text-[#d7b28b]">— {review.name}</div>
              </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[#f1e6de]">كوني أول من يشاركنا رأيه في المتجر.</p>
          )}

          <form onSubmit={handleReviewSubmit} className="mx-auto mt-10 max-w-3xl rounded-[24px] border border-[#3b2b23] bg-[#251914] p-6 text-right">
            <h3 className="text-xl font-black">أضيفي تقييمك</h3>
            <label className="mt-5 block text-sm font-bold">
              تقييمك بالنجوم
              <span className="mt-2 flex gap-1" dir="ltr">
                {Array.from({ length: 5 }).map((_, index) => {
                  const rating = index + 1;
                  return (
                    <button key={rating} type="button" onClick={() => setReviewRating(rating)} aria-label={`${rating} نجوم`} aria-pressed={reviewRating === rating} className="rounded p-1 text-[#e0bb84]">
                      <Star className={`h-6 w-6 ${rating <= reviewRating ? 'fill-current' : ''}`} />
                    </button>
                  );
                })}
              </span>
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold">
                الاسم
                <input required maxLength={60} value={reviewName} onChange={(event) => setReviewName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#3b2b23] bg-[#1d120d] px-3 text-right text-[#f9f3ee]" />
              </label>
              <label className="block text-sm font-bold sm:col-span-2">
                رأيك في تجربتك
                <textarea required maxLength={500} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-[#3b2b23] bg-[#1d120d] px-3 py-3 text-right text-[#f9f3ee]" />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button type="submit" className="rounded-full bg-[#d7b28b] px-5 py-2.5 text-sm font-bold text-[#2f1e17]">إرسال التقييم</button>
              {reviewSubmitted && <p role="status" className="text-sm text-[#d7b28b]">شكرًا لتقييمك، سيظهر بعد مراجعته.</p>}
              {reviewError && <p role="alert" className="text-sm text-[#e6a092]">{reviewError}</p>}
            </div>
          </form>
        </div>
      </section>
    </>
  );
}

function ShopPage({ products, addToCart }: { products: Product[]; addToCart: (product: Product, color?: string, size?: string) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('الكل');
  const [sort, setSort] = useState('الأحدث');

  const filtered = useMemo(() => {
    let result = [...products];

    if (category !== 'الكل') {
      result = result.filter((product) => product.category === category);
    }

    if (query.trim()) {
      const term = query.toLowerCase();
      result = result.filter((product) => [product.name, product.description, product.category].join(' ').toLowerCase().includes(term));
    }

    if (sort === 'السعر: الأقل أولاً') {
      result.sort((a, b) => a.price - b.price);
    }
    if (sort === 'السعر: الأعلى أولاً') {
      result.sort((a, b) => b.price - a.price);
    }
    if (sort === 'الأكثر مبيعًا') {
      result.sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller));
    }

    return result;
  }, [products, query, category, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7a6257]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن المنتج أو القسم" className="h-12 w-full rounded-full border border-[#e3d0b2] bg-[#f9f4ee] pr-12 pl-4 text-right text-[#2f1e17] outline-none" />
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-12 rounded-full border border-[#e3d0b2] bg-[#f9f4ee] px-4 text-right text-[#2f1e17] outline-none">
              <option>الكل</option>
              <option>ادنائات</option>
              <option>دريسات</option>
              <option>نقابات</option>
              <option>خمار</option>
              <option>مكملات حجاب</option>
              <option>اسدالات</option>
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-12 rounded-full border border-[#e3d0b2] bg-[#f9f4ee] px-4 text-right text-[#2f1e17] outline-none">
              <option>الأحدث</option>
              <option>السعر: الأقل أولاً</option>
              <option>السعر: الأعلى أولاً</option>
              <option>الأكثر مبيعًا</option>
            </select>
          </div>
        </div>
      </div>

      {filtered.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} addToCart={addToCart} />
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-[#d9c3a7] bg-[#fffaf5] p-10 text-center text-[#5a4237]">
          لا توجد منتجات في هذا القسم حاليًا.
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, addToCart }: { product: Product; addToCart?: (product: Product, color?: string, size?: string) => void }) {
  const firstColor = product.colors[0];
  const firstSize = product.sizes[0];

  return (
    <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[28px] border border-[#e9dbc0] bg-[#fffaf5] shadow-sm">
      <Link to={`/product/${product.id}`} className="block overflow-hidden">
        <div className="relative overflow-hidden">
          <img src={product.images[0]} alt={product.name} className="h-[340px] w-full object-cover transition duration-500 hover:scale-105" />
          <span className="absolute right-4 top-4 rounded-full bg-[#f7e8d3] px-3 py-1 text-xs font-black text-[#2f1e17]">{product.badge}</span>
        </div>
      </Link>
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-[#f3e7d8] px-3 py-1 text-[11px] font-bold text-[#4d352f]">{product.category}</span>
          {product.stock > 0 ? <span className="text-xs font-bold text-[#79825a]">متوفر</span> : <span className="text-xs font-bold text-[#a5533d]">غير متوفر</span>}
        </div>

        <Link to={`/product/${product.id}`}>
          <h3 className="text-2xl font-black text-[#2f1e17]">{product.name}</h3>
        </Link>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-black text-[#2f1e17]">{formatMoney(product.price)}</span>
            {product.originalPrice && <span className="text-sm text-[#8a705d] line-through">{formatMoney(product.originalPrice)}</span>}
          </div>
          {product.discount && <span className="rounded-full bg-[#2f1e17] px-2 py-1 text-[10px] font-bold text-[#f4ebdf]">خصم {product.discount}%</span>}
        </div>

        <div className="flex items-center justify-between gap-3">
          {addToCart ? (
            <button onClick={() => addToCart(product, firstColor, firstSize)} className="rounded-full bg-[#2f1e17] px-4 py-2.5 text-sm font-bold text-[#fffaf5] transition hover:opacity-90">أضف للسلة</button>
          ) : (
            <span className="text-sm font-bold text-[#6c5449]">عرض التفاصيل</span>
          )}
          <Link to={`/product/${product.id}`} className="inline-flex items-center gap-2 rounded-full border border-[#d7b28b] bg-[#f7f1ea] px-4 py-2.5 text-sm font-bold text-[#2f1e17]">عرض التفاصيل</Link>
        </div>
      </div>
    </motion.article>
  );
}

function ProductDetailPage({ products, addToCart }: { products: Product[]; addToCart: (product: Product, color?: string, size?: string) => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const product = products.find((entry) => entry.id === id);
  const [variantSelection, setVariantSelection] = useState<{ productId: string; color: string; size: string } | null>(null);
  const selectionMatchesProduct = variantSelection?.productId === product?.id;
  const selectedColor = selectionMatchesProduct && variantSelection ? variantSelection.color : product?.colors[0] ?? '';
  const selectedSize = selectionMatchesProduct && variantSelection ? variantSelection.size : product?.sizes[0] ?? '';

  if (!product) {
    return <NotFoundPage />;
  }

  const relatedProducts = products.filter((entry) => entry.category === product.category && entry.id !== product.id).slice(0, 3);
  const selectedImage = product.variantImages?.[selectedColor] || product.images[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d7b28b] bg-[#fffaf5] px-4 py-2 text-sm font-bold text-[#2f1e17]">
        <ChevronLeft className="h-4 w-4" /> رجوع
      </button>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <img src={selectedImage} alt={`${product.name} - ${selectedColor}`} className="h-[620px] w-full rounded-[32px] object-cover shadow-lg" />
          <div className="grid grid-cols-2 gap-4">
            {product.images.slice(1).map((image, index) => (
              <img key={`${image}-${index}`} src={image} alt={`${product.name}-${index + 1}`} className="h-52 w-full rounded-[24px] object-cover" />
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
          <span className="inline-flex rounded-full bg-[#f1e5d4] px-3 py-1 text-xs font-bold text-[#2f1e17]">{product.category}</span>
          <h1 className="mt-4 text-3xl font-black text-[#2f1e17]">{product.name}</h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-4xl font-black text-[#2f1e17]">{formatMoney(product.price)}</span>
            {product.originalPrice && <span className="text-lg text-[#7a6257] line-through">{formatMoney(product.originalPrice)}</span>}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-[#5a4237]">
            <BadgeCheck className="h-4 w-4 text-[#4a6a47]" />
            {product.stock > 0 ? 'متوفر الآن' : 'غير متوفر'}
          </div>

          <p className="mt-6 text-base leading-8 text-[#5a4237]">{product.description}</p>

          <div className="mt-6">
            <p className="mb-3 text-sm font-bold text-[#2f1e17]">الألوان المتاحة</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <button key={color} type="button" onClick={() => setVariantSelection({ productId: product.id, color, size: selectedSize })} className={`rounded-full border px-4 py-2 text-sm font-bold ${selectedColor === color ? 'border-[#2f1e17] bg-[#2f1e17] text-[#fffaf5]' : 'border-[#d7b28b] bg-[#f5eadb] text-[#2f1e17]'}`}>
                  {color}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm font-bold text-[#2f1e17]">المقاسات</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => (
                <button key={size} type="button" onClick={() => setVariantSelection({ productId: product.id, color: selectedColor, size })} className={`rounded-full border px-4 py-2 text-sm font-bold ${selectedSize === size ? 'border-[#2f1e17] bg-[#2f1e17] text-[#fffaf5]' : 'border-[#d7b28b] bg-[#f5eadb] text-[#2f1e17]'}`}>
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => addToCart(product, selectedColor, selectedSize)} className="rounded-full bg-[#2f1e17] px-6 py-3 text-sm font-bold text-[#fffaf5]">أضف إلى السلة</button>
            <button onClick={() => navigate('/checkout')} className="rounded-full border border-[#d7b28b] bg-[#f7f1ea] px-6 py-3 text-sm font-bold text-[#2f1e17]">اطلب الآن</button>
          </div>
        </div>
      </div>

      <div className="mt-16">
        <h2 className="mb-6 text-3xl font-black text-[#2f1e17]">منتجات مشابهة</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {relatedProducts.map((entry) => (
            <ProductCard key={entry.id} product={entry} addToCart={addToCart} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CartPage({
  cartItems,
  subtotal,
  shipping,
  total,
  updateCartQty,
  removeCartItem,
}: {
  cartItems: Array<CartItem & { product: Product }>;
  subtotal: number;
  shipping: number;
  total: number;
  updateCartQty: (productId: string, color: string, size: string, delta: number) => void;
  removeCartItem: (productId: string, color: string, size: string) => void;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-4xl font-black text-[#2f1e17]">السلة</h1>

      {cartItems.length ? (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            {cartItems.map((item) => (
              <div key={`${item.productId}-${item.color}-${item.size}`} className="flex flex-col gap-4 rounded-[26px] border border-[#ead7b8] bg-[#fffaf5] p-4 sm:flex-row sm:items-center">
                <img src={item.product.images[0]} alt={item.product.name} className="h-28 w-28 rounded-[20px] object-cover" />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-[#2f1e17]">{item.product.name}</h3>
                      <p className="mt-2 text-sm text-[#5a4237]">اللون: {item.color} • المقاس: {item.size}</p>
                    </div>
                    <button onClick={() => removeCartItem(item.productId, item.color, item.size)} className="text-xs font-bold text-[#a5533d]">حذف</button>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 rounded-full border border-[#d7b28b] bg-[#f6efe7] p-1">
                      <button onClick={() => updateCartQty(item.productId, item.color, item.size, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fffaf5] text-[#2f1e17]">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-8 text-center text-sm font-bold text-[#2f1e17]">{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.productId, item.color, item.size, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fffaf5] text-[#2f1e17]">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-xl font-black text-[#2f1e17]">{formatMoney(item.product.price * item.quantity)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="rounded-[30px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
            <h2 className="text-2xl font-black text-[#2f1e17]">ملخص الطلب</h2>
            <div className="mt-5 space-y-4 text-[#5a4237]">
              <div className="flex items-center justify-between"><span>مجموع المنتجات</span><span>{formatMoney(subtotal)}</span></div>
              <div className="flex items-center justify-between"><span>مصاريف الشحن</span><span>{formatMoney(shipping)}</span></div>
              <div className="flex items-center justify-between border-t border-[#ead7b8] pt-4 text-lg font-black text-[#2f1e17]"><span>الإجمالي النهائي</span><span>{formatMoney(total)}</span></div>
            </div>
            <Link to="/checkout" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#2f1e17] px-5 py-3 text-sm font-bold text-[#fffaf5]">إتمام الطلب</Link>
          </aside>
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-[#d9c3a7] bg-[#fffaf5] p-10 text-center text-[#5a4237]">
          السلة فارغة الآن، ابدأ بتفقد المنتجات المتاحة.
        </div>
      )}
    </div>
  );
}

function CheckoutPage({
  cartItems,
  subtotal,
  settings,
  onPlaceOrder,
}: {
  cartItems: Array<CartItem & { product: Product }>;
  subtotal: number;
  settings: Settings;
  onPlaceOrder: (payload: {
    customerName: string;
    phone: string;
    whatsapp: string;
    city: string;
    address: string;
    notes: string;
    paymentMethod: string;
    paymentRef: string;
    depositAmount: number;
  }) => Promise<Order | undefined>;
}) {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    whatsapp: '',
    city: settings.shippingZones[0]?.city ?? '',
    address: '',
    notes: '',
    paymentMethod: 'الدفع عند الاستلام',
    paymentRef: '',
  });
  const totalWeightKg = cartItems.reduce((sum, item) => sum + (item.product.weightKg ?? 1) * item.quantity, 0);
  const selectedZone = settings.shippingZones.find((zone) => zone.city === form.city);
  const shipping = getShippingRate(settings, form.city, totalWeightKg);
  const total = subtotal + shipping;
  const depositAmount = form.paymentMethod === 'عربون فودافون كاش'
    ? Math.min(settings.depositAmount, total)
    : 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await onPlaceOrder({ ...form, depositAmount });
      if (order) navigate(`/order-success?order=${order.id}`);
    } catch {
      setSubmitError('تعذر تسجيل الطلب حاليًا. تحقّقي من اتصال الموقع وحاولي مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cartItems.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-[#5a4237] sm:px-6 lg:px-8">
        السلة فارغة، لا يمكن إتمام الطلب الآن.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 text-right">
        <h1 className="text-4xl font-black text-[#2f1e17]">إتمام الطلب</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <form onSubmit={handleSubmit} className="rounded-[30px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="text-right text-sm font-bold text-[#2f1e17]">
              الاسم الكامل
              <input required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right outline-none" />
            </label>
            <label className="text-right text-sm font-bold text-[#2f1e17]">
              رقم الهاتف
              <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right outline-none" />
            </label>
            <label className="text-right text-sm font-bold text-[#2f1e17]">
              واتساب
              <input required value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right outline-none" />
            </label>
            <label className="text-right text-sm font-bold text-[#2f1e17]">
              المحافظة
              <select required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right outline-none">
                {settings.shippingZones.map((zone) => <option key={zone.city} value={zone.city}>{zone.city}</option>)}
              </select>
            </label>
          </div>

          <label className="mt-5 block text-right text-sm font-bold text-[#2f1e17]">
            العنوان بالتفصيل
            <textarea required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-2 min-h-28 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 py-3 text-right outline-none" />
          </label>

          <label className="mt-5 block text-right text-sm font-bold text-[#2f1e17]">
            ملاحظات الطلب
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 py-3 text-right outline-none" />
          </label>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-right text-sm font-bold text-[#2f1e17]">
              طريقة الدفع
              <select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right outline-none">
                <option>الدفع عند الاستلام</option>
                <option>عربون فودافون كاش</option>
                <option>واتساب</option>
              </select>
            </label>

            <label className="text-right text-sm font-bold text-[#2f1e17]">
              رقم العملية / المرجع
              <input required={form.paymentMethod === 'عربون فودافون كاش'} value={form.paymentRef} onChange={(event) => setForm({ ...form, paymentRef: event.target.value })} placeholder={form.paymentMethod === 'عربون فودافون كاش' ? 'أدخلي رقم العملية بعد التحويل' : 'اختياري'} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right outline-none" />
            </label>
          </div>

          <div className="mt-6 rounded-[24px] border border-[#ead7b8] bg-[#f6efe7] p-4 text-right text-sm leading-8 text-[#4d352f]">
            <div className="font-bold text-[#2f1e17]">الشحن إلى {form.city}: {formatMoney(shipping)}</div>
            {selectedZone && <div>وزن الطلب {totalWeightKg} كجم • يشمل {selectedZone.includedKg} كجم • الإضافي {formatMoney(selectedZone.extraKgRate)} لكل كجم • التوصيل خلال {selectedZone.deliveryHours} ساعة</div>}
            {depositAmount > 0 && (
              <div className="mt-2 border-t border-[#e2d1ba] pt-3">
                <div className="font-black text-[#2f1e17]">حوّلي العربون ({formatMoney(depositAmount)}) عبر فودافون كاش</div>
                <div>رقم التحويل: <span dir="ltr" className="font-black text-[#2f1e17]">{settings.vodafoneCashNumber}</span></div>
                <div>اكتبي رقم العملية في الحقل أعلاه. باقي المبلغ عند الاستلام.</div>
              </div>
            )}
          </div>

          {!isSupabaseConfigured && <p className="mt-4 text-sm font-bold text-[#a5533d]">لن يُستقبل الطلب قبل إعداد قاعدة بيانات المتجر.</p>}
          {submitError && <p role="alert" className="mt-4 text-sm font-bold text-[#a5533d]">{submitError}</p>}
          <button type="submit" disabled={submitting || !isSupabaseConfigured} className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-[#2f1e17] px-5 py-3 text-sm font-bold text-[#fffaf5] disabled:opacity-60">{submitting ? 'جارٍ تسجيل الطلب...' : 'تأكيد الطلب'}</button>
        </form>

        <aside className="rounded-[30px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
          <h2 className="text-2xl font-black text-[#2f1e17]">ملخص الطلب</h2>
          <div className="mt-5 space-y-4">
            {cartItems.map((item) => (
              <div key={`${item.productId}-${item.color}-${item.size}`} className="flex items-center justify-between gap-3 border-b border-[#efe1cf] pb-3">
                <div>
                  <div className="font-bold text-[#2f1e17]">{item.product.name}</div>
                  <div className="text-xs text-[#5a4237]">{item.color} • {item.size}</div>
                </div>
                <div className="text-sm font-bold text-[#2f1e17]">{item.quantity} × {formatMoney(item.product.price)}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3 text-[#5a4237]">
            <div className="flex items-center justify-between"><span>إجمالي المنتجات</span><span>{formatMoney(subtotal)}</span></div>
            <div className="flex items-center justify-between"><span>الشحن إلى {form.city}</span><span>{formatMoney(shipping)}</span></div>
            <div className="flex items-center justify-between border-t border-[#ead7b8] pt-3 text-lg font-black text-[#2f1e17]"><span>الإجمالي النهائي</span><span>{formatMoney(total)}</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-[#d9c3a7] bg-[#fffaf5] p-8 shadow-sm">
        <div className="mb-4 inline-flex rounded-full bg-[#ecf5e8] p-3 text-[#466a3d]"><CheckCircle2 className="h-7 w-7" /></div>
        <h1 className="text-4xl font-black text-[#2f1e17]">تم إرسال طلبك بنجاح ❤️</h1>
        <p className="mt-4 text-lg text-[#5a4237]">رقم طلبك: <span className="font-black text-[#2f1e17]">{orderId || '—'}</span></p>
        <p className="mt-3 text-base text-[#5a4237]">يرجى الاحتفاظ برقم الطلب لمتابعة حالته.</p>
        <Link to="/shop" className="mt-8 inline-flex rounded-full bg-[#2f1e17] px-6 py-3 text-sm font-bold text-[#fffaf5]">متابعة التسوق</Link>
      </div>
    </div>
  );
}

function AboutPage({ settings }: { settings: Settings }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-[#ead7b8] bg-[#fffaf5] p-8 shadow-sm">
        <p className="text-sm font-bold text-[#9e7650]">من نحن</p>
        <h1 className="mt-2 text-4xl font-black text-[#2f1e17]">{settings.siteName}</h1>
        <p className="mt-6 text-lg leading-9 text-[#5a4237]">{settings.aboutText}</p>
        <img src={settings.aboutImage} alt={settings.siteName} className="mt-8 max-h-[520px] w-full rounded-[24px] object-cover" />
      </div>
    </div>
  );
}

function ContactPage({ settings }: { settings: Settings }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[30px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
          <p className="text-sm font-bold text-[#9e7650]">تواصل معنا</p>
          <h1 className="mt-2 text-4xl font-black text-[#2f1e17]">نحن هنا لخدمتكِ</h1>
          <p className="mt-5 text-base leading-8 text-[#5a4237]">{settings.contactText}</p>
          <div className="mt-6 space-y-3 text-base font-bold text-[#2f1e17]">
            <div className="flex items-center gap-3"><PhoneCall className="h-5 w-5 text-[#9e7650]" /> {settings.vodafoneCashNumber}</div>
            {settings.whatsapp && <div className="flex items-center gap-3"><MessageCircle className="h-5 w-5 text-[#9e7650]" /> {settings.whatsapp}</div>}
            <div className="flex items-center gap-3"><SettingsIcon className="h-5 w-5 text-[#9e7650]" /> {settings.facebook}</div>
          </div>
        </div>

        <div className="rounded-[30px] border border-[#ead7b8] bg-[#f3e7d7] p-6 shadow-sm">
          <img src={settings.contactImage} alt="تواصل معنا" className="h-full min-h-[320px] w-full rounded-[24px] object-cover" />
        </div>
      </div>
    </div>
  );
}

function ProtectedAdmin({ isLoggedIn, children }: { isLoggedIn: boolean; children: ReactNode }) {
  return isLoggedIn ? <>{children}</> : <Navigate to="/admin/login" replace />;
}

function AdminLayout({ onLogout }: { onLogout: () => void }) {
  const navItems = [
    { label: 'لوحة التحكم', to: '/admin', icon: LayoutDashboard },
    { label: 'المنتجات', to: '/admin/products', icon: Boxes },
    { label: 'الطلبات', to: '/admin/orders', icon: PackageCheck },
    { label: 'التقييمات', to: '/admin/reviews', icon: Star },
    { label: 'الشحن', to: '/admin/shipping', icon: Truck },
    { label: 'الإعدادات', to: '/admin/settings', icon: SettingsIcon },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4 rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2f1e17] text-[#fffaf5]"><UserRound className="h-5 w-5" /></span>
          <div>
            <div className="text-lg font-black text-[#2f1e17]">لوحة الإدارة</div>
            <div className="text-xs text-[#6b5448]">إدارة المتجر</div>
          </div>
        </div>
        <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-full border border-[#d7b28b] bg-[#f7f1ea] px-4 py-2 text-sm font-bold text-[#2f1e17]">
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-4 shadow-sm">
          <nav className="space-y-2">
            {navItems.map(({ label, to, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm font-bold ${isActive ? 'bg-[#2f1e17] text-[#fffaf5]' : 'text-[#2f1e17]'}`}>
                <span>{label}</span>
                <Icon className="h-4 w-4" />
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-h-[500px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function AdminLoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<string | undefined> }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const message = await onLogin(email, password);
      if (message) {
        setError(message);
      } else {
        navigate('/admin');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <form onSubmit={submit} className="w-full rounded-[32px] border border-[#ead7b8] bg-[#fffaf5] p-8 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-bold text-[#9e7650]">تسجيل الدخول</p>
          <h1 className="mt-2 text-3xl font-black text-[#2f1e17]">لوحة الإدارة</h1>
        </div>

        <label className="block text-right text-sm font-bold text-[#2f1e17]">
          البريد الإلكتروني
          <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-left outline-none" dir="ltr" />
        </label>

        <label className="mt-4 block text-right text-sm font-bold text-[#2f1e17]">
          كلمة المرور
          <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right outline-none" />
        </label>

        {error && <div className="mt-3 text-sm font-bold text-[#a5533d]">{error}</div>}
        {!isSupabaseConfigured && <p className="mt-4 text-sm text-[#a5533d]">أضيفي إعدادات Supabase لتفعيل دخول الإدارة.</p>}
        <button type="submit" disabled={submitting || !isSupabaseConfigured} className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#2f1e17] px-5 py-3 text-sm font-bold text-[#fffaf5] disabled:opacity-60">{submitting ? 'جارٍ التحقق...' : 'دخول'}</button>
      </form>
    </div>
  );
}

function AdminDashboardPage({
  products,
  orders,
  reviews,
  totalSales,
  lowStockCount,
}: {
  products: Product[];
  orders: Order[];
  reviews: Review[];
  totalSales: number;
  lowStockCount: number;
}) {
  const summaryCards = [
    { label: 'عدد المنتجات', value: products.length },
    { label: 'عدد الطلبات', value: orders.length },
    { label: 'الطلبات الجديدة', value: orders.filter((order) => order.status === 'new').length },
    { label: 'إجمالي المبيعات', value: formatMoney(totalSales) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-[24px] border border-[#ead7b8] bg-[#fffaf5] p-5 shadow-sm">
            <div className="text-sm text-[#6c5449]">{card.label}</div>
            <div className="mt-3 text-3xl font-black text-[#2f1e17]">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
          <h2 className="text-2xl font-black text-[#2f1e17]">آخر الطلبات</h2>
          <div className="mt-5 space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-2xl border border-[#f0e3d3] bg-[#faf4ee] p-3 text-sm text-[#5a4237]">
                <div>
                  <div className="font-black text-[#2f1e17]">{order.customerName}</div>
                  <div>{new Date(order.createdAt).toLocaleDateString('ar-SA')}</div>
                </div>
                <div className="text-left">
                  <div className="font-black text-[#2f1e17]">{formatMoney(order.total)}</div>
                  <div>{order.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
          <h2 className="text-2xl font-black text-[#2f1e17]">إحصائيات سريعة</h2>
          <div className="mt-5 space-y-4 text-sm text-[#5a4237]">
            <div className="flex items-center justify-between"><span>المنتجات قليلة المخزون</span><span className="font-black text-[#2f1e17]">{lowStockCount}</span></div>
            <div className="flex items-center justify-between"><span>التقييمات المعلقة</span><span className="font-black text-[#2f1e17]">{reviews.filter((review) => review.status === 'pending').length}</span></div>
            <div className="flex items-center justify-between"><span>الطلبات المكتملة</span><span className="font-black text-[#2f1e17]">{orders.filter((order) => order.status === 'delivered').length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminProductsPage({ products, setProducts }: { products: Product[]; setProducts: Dispatch<SetStateAction<Product[]>> }) {
  const [form, setForm] = useState({
    name: '',
    category: 'نقابات',
    price: '199',
    originalPrice: '250',
    weightKg: '1',
    stock: '10',
    description: '',
    badge: 'جديد',
    colors: 'أسود, بيج',
    sizes: 'مقاس صغير, متوسط, كبير',
    images: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
    variantImages: '',
  });
  const [editingImages, setEditingImages] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newProduct: Product = {
      id: generateId('PROD'),
      name: form.name,
      category: form.category as Product['category'],
      price: Number(form.price),
      weightKg: Number(form.weightKg) || 1,
      originalPrice: Number(form.originalPrice),
      discount: Math.max(0, Math.round(((Number(form.originalPrice) - Number(form.price)) / Number(form.originalPrice)) * 100)),
      badge: form.badge,
      colors: form.colors.split(',').map((item) => item.trim()).filter(Boolean),
      sizes: form.sizes.split(',').map((item) => item.trim()).filter(Boolean),
      stock: Number(form.stock),
      description: form.description,
      images: form.images.split(',').map((item) => item.trim()).filter(Boolean),
      variantImages: parseVariantImages(form.variantImages),
      featured: true,
      newArrival: true,
      bestSeller: false,
      status: 'active',
    };
    setProducts((prev) => [newProduct, ...prev]);
    setForm({ name: '', category: 'نقابات', price: '199', originalPrice: '250', weightKg: '1', stock: '10', description: '', badge: 'جديد', colors: 'أسود, بيج', sizes: 'مقاس صغير, متوسط, كبير', images: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80', variantImages: '' });
  };

  const toggleStatus = (id: string) => {
    setProducts((prev) => prev.map((product) => product.id === id ? { ...product, status: product.status === 'active' ? 'hidden' : 'active' } : product));
  };

  const updateProduct = (id: string, changes: Partial<Product>) => {
    setProducts((prev) => prev.map((product) => product.id === id ? { ...product, ...changes } : product));
  };

  const uploadProductImages = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const uploaded = await Promise.all(Array.from(files).map(persistImage));
      setForm((prev) => ({ ...prev, images: [...prev.images.split(',').map((image) => image.trim()).filter(Boolean), ...uploaded].join(', ') }));
    } catch {
      window.alert('تعذر تحميل إحدى الصور. جرّبي ملفًا بصيغة JPG أو PNG أو WebP.');
    }
  };

  const uploadExistingProductImages = async (productId: string, files: FileList | null) => {
    if (!files?.length) return;
    try {
      const uploaded = await Promise.all(Array.from(files).map(persistImage));
      const product = products.find((entry) => entry.id === productId);
      if (product) updateProduct(productId, { images: [...product.images, ...uploaded] });
    } catch {
      window.alert('تعذر تحميل إحدى الصور. جرّبي ملفًا بصيغة JPG أو PNG أو WebP.');
    }
  };

  const uploadVariantImage = async (productId: string, color: string, file?: File) => {
    if (!file) return;
    try {
      const image = await persistImage(file);
      const product = products.find((entry) => entry.id === productId);
      if (product) updateProduct(productId, { variantImages: { ...product.variantImages, [color]: image } });
    } catch {
      window.alert('تعذر تحميل الصورة. جرّبي ملفًا بصيغة JPG أو PNG أو WebP.');
    }
  };

  const uploadNewVariantImage = async (color: string, file?: File) => {
    if (!file) return;
    try {
      const image = await persistImage(file);
      setForm((prev) => ({
        ...prev,
        variantImages: Object.entries({ ...parseVariantImages(prev.variantImages), [color]: image })
          .map(([variantColor, variantImage]) => `${variantColor} | ${variantImage}`)
          .join('\n'),
      }));
    } catch {
      window.alert('تعذر تحميل الصورة. جرّبي ملفًا بصيغة JPG أو PNG أو WebP.');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
        <h2 className="mb-5 text-2xl font-black text-[#2f1e17]">إضافة منتج جديد</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="اسم المنتج" className="h-12 rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="h-12 rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right">
            <option>ادنائات</option>
            <option>دريسات</option>
            <option>نقابات</option>
            <option>خمار</option>
            <option>مكملات حجاب</option>
            <option>اسدالات</option>
          </select>
          <input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} type="number" placeholder="السعر" className="h-12 rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
          <input value={form.originalPrice} onChange={(event) => setForm({ ...form, originalPrice: event.target.value })} type="number" placeholder="السعر قبل الخصم" className="h-12 rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
          <input value={form.weightKg} onChange={(event) => setForm({ ...form, weightKg: event.target.value })} type="number" min="0.1" step="0.1" placeholder="وزن القطعة بالكيلو" className="h-12 rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
          <input value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} type="number" placeholder="المخزون" className="h-12 rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
          <input value={form.badge} onChange={(event) => setForm({ ...form, badge: event.target.value })} placeholder="الشارة" className="h-12 rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
        </div>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="وصف المنتج" className="mt-4 min-h-28 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 py-3 text-right" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input value={form.colors} onChange={(event) => setForm({ ...form, colors: event.target.value })} placeholder="الألوان (مفصولة بفواصل)" className="h-12 rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
          <input value={form.sizes} onChange={(event) => setForm({ ...form, sizes: event.target.value })} placeholder="المقاسات (مفصولة بفواصل)" className="h-12 rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
        </div>
        <textarea value={form.images} onChange={(event) => setForm({ ...form, images: event.target.value })} placeholder="روابط الصور (مفصولة بفواصل)" className="mt-4 min-h-20 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 py-3 text-right" />
        <label className="mt-3 inline-flex cursor-pointer rounded-full border border-[#d7b28b] bg-[#f7f1ea] px-4 py-2 text-xs font-bold text-[#2f1e17]">رفع صور الموديل<input type="file" accept="image/*" multiple onChange={(event) => void uploadProductImages(event.target.files)} className="sr-only" /></label>
        <label className="mt-4 block text-right text-sm font-bold text-[#2f1e17]">صور الألوان (سطر لكل لون: اسم اللون | رابط الصورة)
          <textarea value={form.variantImages} onChange={(event) => setForm({ ...form, variantImages: event.target.value })} placeholder={'أسود | https://...\nبيج | https://...'} className="mt-2 min-h-24 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 py-3 text-left font-normal" dir="auto" />
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          {form.colors.split(',').map((color) => color.trim()).filter(Boolean).map((color) => (
            <label key={color} className="cursor-pointer rounded-full border border-[#d7b28b] bg-[#f7f1ea] px-4 py-2 text-xs font-bold text-[#2f1e17]">رفع صورة {color}<input type="file" accept="image/*" onChange={(event) => void uploadNewVariantImage(color, event.target.files?.[0])} className="sr-only" /></label>
          ))}
        </div>
        <button type="submit" className="mt-6 inline-flex rounded-full bg-[#2f1e17] px-5 py-3 text-sm font-bold text-[#fffaf5]">حفظ المنتج</button>
      </form>

      <div className="rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
        <h2 className="mb-4 text-2xl font-black text-[#2f1e17]">قائمة المنتجات</h2>
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="flex flex-col gap-3 rounded-2xl border border-[#efe1cf] bg-[#faf4ee] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <img src={product.images[0]} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
                <div>
                  <div className="font-black text-[#2f1e17]">{product.name}</div>
                  <div className="text-xs text-[#5a4237]">{product.category} • {product.stock} في المخزون</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditingImages(editingImages === product.id ? null : product.id)} className="rounded-full border border-[#d7b28b] bg-[#f7f1ea] px-4 py-2 text-xs font-bold text-[#2f1e17]">تعديل الصور والألوان</button>
                <button onClick={() => toggleStatus(product.id)} className="rounded-full border border-[#d7b28b] bg-[#f7f1ea] px-4 py-2 text-xs font-bold text-[#2f1e17]">
                  {product.status === 'active' ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
            {editingImages === product.id && (
              <div className="mt-4 grid gap-4 border-t border-[#ead7b8] pt-4">
                <label className="text-sm font-bold text-[#2f1e17]">صور المنتج (روابط مفصولة بفواصل)
                  <textarea value={product.images.join(', ')} onChange={(event) => updateProduct(product.id, { images: event.target.value.split(',').map((image) => image.trim()).filter(Boolean) })} className="mt-2 min-h-20 w-full rounded-xl border border-[#e3d0b2] bg-white px-3 py-3 text-left font-normal" dir="auto" />
                </label>
                <label className="inline-flex w-fit cursor-pointer rounded-full border border-[#d7b28b] bg-white px-4 py-2 text-xs font-bold text-[#2f1e17]">رفع صور إضافية للموديل<input type="file" accept="image/*" multiple onChange={(event) => void uploadExistingProductImages(product.id, event.target.files)} className="sr-only" /></label>
                <label className="text-sm font-bold text-[#2f1e17]">الألوان (مفصولة بفواصل)
                  <input value={product.colors.join(', ')} onChange={(event) => updateProduct(product.id, { colors: event.target.value.split(',').map((color) => color.trim()).filter(Boolean) })} className="mt-2 h-11 w-full rounded-xl border border-[#e3d0b2] bg-white px-3 text-right font-normal" />
                </label>
                <label className="text-sm font-bold text-[#2f1e17]">وزن القطعة بالكيلو
                  <input type="number" min="0.1" step="0.1" value={product.weightKg ?? 1} onChange={(event) => updateProduct(product.id, { weightKg: Number(event.target.value) || 1 })} className="mt-2 h-11 w-full rounded-xl border border-[#e3d0b2] bg-white px-3 text-right font-normal" />
                </label>
                <label className="text-sm font-bold text-[#2f1e17]">صورة لكل لون (سطر لكل لون: اسم اللون | رابط الصورة)
                  <textarea value={Object.entries(product.variantImages ?? {}).map(([color, image]) => `${color} | ${image}`).join('\n')} onChange={(event) => updateProduct(product.id, { variantImages: parseVariantImages(event.target.value) })} className="mt-2 min-h-24 w-full rounded-xl border border-[#e3d0b2] bg-white px-3 py-3 text-left font-normal" dir="auto" />
                </label>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((color) => (
                    <label key={color} className="cursor-pointer rounded-full border border-[#d7b28b] bg-white px-4 py-2 text-xs font-bold text-[#2f1e17]">رفع صورة {color}<input type="file" accept="image/*" onChange={(event) => void uploadVariantImage(product.id, color, event.target.files?.[0])} className="sr-only" /></label>
                  ))}
                </div>
              </div>
            )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminOrdersPage({ orders, setOrders }: { orders: Order[]; setOrders: Dispatch<SetStateAction<Order[]>> }) {
  const [search, setSearch] = useState('');

  const visibleOrders = orders.filter((order) => [order.customerName, order.phone, order.id].join(' ').toLowerCase().includes(search.toLowerCase()));

  const updateStatus = (id: string, status: Order['status']) => {
    setOrders((prev) => prev.map((order) => order.id === id ? { ...order, status } : order));
  };

  return (
    <div className="rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-black text-[#2f1e17]">إدارة الطلبات</h2>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالاسم أو الهاتف أو رقم الطلب" className="mb-5 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />

      <div className="space-y-4">
        {visibleOrders.map((order) => (
          <div key={order.id} className="rounded-[24px] border border-[#efe1cf] bg-[#faf4ee] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-black text-[#2f1e17]">{order.customerName}</div>
                <div className="text-sm text-[#5a4237]">{order.id} • {order.phone}</div>
              </div>
              <div className="text-sm font-bold text-[#2f1e17]">{formatMoney(order.total)}</div>
            </div>
              {order.paymentMethod === 'عربون فودافون كاش' && (
                <div className="mt-3 rounded-xl border border-[#ead7b8] bg-white px-3 py-2 text-sm text-[#4d352f]">
                  <span className="font-bold">عربون فودافون كاش:</span> {formatMoney(order.depositAmount ?? 0)}
                  {order.paymentRef && <span> • رقم العملية: <span dir="ltr">{order.paymentRef}</span></span>}
                </div>
              )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-[#5a4237]">{new Date(order.createdAt).toLocaleDateString('ar-SA')}</span>
              <select value={order.status} onChange={(event) => updateStatus(order.id, event.target.value as Order['status'])} className="h-10 rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right">
                <option value="new">طلب جديد</option>
                <option value="confirmed">تم تأكيد الطلب</option>
                <option value="preparing">جاري التجهيز</option>
                <option value="shipping">تم الشحن</option>
                <option value="delivered">تم التوصيل</option>
                <option value="cancelled">تم الإلغاء</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminReviewsPage({ reviews, setReviews }: { reviews: Review[]; setReviews: Dispatch<SetStateAction<Review[]>> }) {
  const updateReview = (id: string, status: Review['status']) => {
    setReviews((prev) => prev.map((review) => review.id === id ? { ...review, status } : review));
  };

  return (
    <div className="rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
      <h2 className="mb-5 text-2xl font-black text-[#2f1e17]">إدارة التقييمات</h2>
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-[24px] border border-[#efe1cf] bg-[#faf4ee] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-black text-[#2f1e17]">{review.name}</div>
                <div className="mt-1 flex gap-1 text-[#d7b28b]">
                  {Array.from({ length: review.rating }).map((_, index) => <Star key={`${review.id}-star-${index}`} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="mt-2 text-sm text-[#5a4237]">{review.comment}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => updateReview(review.id, 'approved')} className="rounded-full bg-[#466a3d] px-3 py-2 text-xs font-bold text-[#fffaf5]">موافقة</button>
                <button onClick={() => updateReview(review.id, 'rejected')} className="rounded-full bg-[#a5533d] px-3 py-2 text-xs font-bold text-[#fffaf5]">رفض</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminShippingPage({ settings, setSettings }: { settings: Settings; setSettings: Dispatch<SetStateAction<Settings>> }) {
  const [newCity, setNewCity] = useState('');
  const [newRate, setNewRate] = useState('75');
  const [newIncludedKg, setNewIncludedKg] = useState('1');
  const [newExtraKgRate, setNewExtraKgRate] = useState('5');
  const [newDeliveryHours, setNewDeliveryHours] = useState('48');

  const addZone = () => {
    const city = newCity.trim();
    if (!city || settings.shippingZones.some((zone) => zone.city === city)) return;
    setSettings((prev: Settings) => ({
      ...prev,
      shippingZones: [...prev.shippingZones, {
        city,
        rate: Number(newRate) || 0,
        includedKg: Number(newIncludedKg) || 1,
        extraKgRate: Number(newExtraKgRate) || 0,
        deliveryHours: Number(newDeliveryHours) || 48,
      }],
    }));
    setNewCity('');
    setNewRate('75');
    setNewIncludedKg('1');
    setNewExtraKgRate('5');
    setNewDeliveryHours('48');
  };

  return (
    <div className="rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
      <h2 className="mb-5 text-2xl font-black text-[#2f1e17]">الشحن والعربون</h2>
      <div className="space-y-4">
        <label className="block text-right text-sm font-bold text-[#2f1e17]">
          سعر الشحن الافتراضي
          <input type="number" value={settings.shippingRate} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, shippingRate: Number(event.target.value) }))} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
        </label>

        <div className="rounded-[22px] border border-[#ead7b8] bg-[#faf4ee] p-4">
          <h3 className="mb-4 text-lg font-black text-[#2f1e17]">أسعار الشحن حسب المحافظة</h3>
          <div className="space-y-3">
            {settings.shippingZones.map((zone, index) => (
              <div key={`${zone.city}-${index}`} className="grid grid-cols-2 items-center gap-3 rounded-xl bg-white p-3 sm:grid-cols-[1.5fr_repeat(4,minmax(80px,1fr))_auto]">
                <span className="font-bold text-[#4d352f]">{zone.city}</span>
                <input aria-label={`سعر الشحن إلى ${zone.city}`} type="number" min="0" value={zone.rate} onChange={(event) => setSettings((prev: Settings) => ({
                  ...prev,
                  shippingZones: prev.shippingZones.map((item, itemIndex) => itemIndex === index ? { ...item, rate: Number(event.target.value) } : item),
                }))} className="h-10 w-full rounded-xl border border-[#e3d0b2] bg-white px-3 text-right" />
                <input aria-label={`الوزن المشمول في ${zone.city}`} title="الوزن المشمول بالكيلو" type="number" min="0.1" step="0.1" value={zone.includedKg} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, shippingZones: prev.shippingZones.map((item, itemIndex) => itemIndex === index ? { ...item, includedKg: Number(event.target.value) } : item) }))} className="h-10 w-full rounded-xl border border-[#e3d0b2] bg-white px-3 text-right" />
                <input aria-label={`سعر الكيلو الإضافي في ${zone.city}`} title="سعر كل كيلو إضافي" type="number" min="0" value={zone.extraKgRate} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, shippingZones: prev.shippingZones.map((item, itemIndex) => itemIndex === index ? { ...item, extraKgRate: Number(event.target.value) } : item) }))} className="h-10 w-full rounded-xl border border-[#e3d0b2] bg-white px-3 text-right" />
                <input aria-label={`مدة التوصيل إلى ${zone.city}`} title="مدة التوصيل بالساعات" type="number" min="1" value={zone.deliveryHours} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, shippingZones: prev.shippingZones.map((item, itemIndex) => itemIndex === index ? { ...item, deliveryHours: Number(event.target.value) } : item) }))} className="h-10 w-full rounded-xl border border-[#e3d0b2] bg-white px-3 text-right" />
                <button type="button" title={`حذف ${zone.city}`} onClick={() => setSettings((prev: Settings) => ({ ...prev, shippingZones: prev.shippingZones.filter((_, itemIndex) => itemIndex !== index) }))} className="h-10 w-10 rounded-full border border-[#d7b28b] text-[#7b4537]">×</button>
              </div>
            ))}
          </div>
          <p className="mt-3 hidden text-xs text-[#6c5449] sm:block">الترتيب لكل منطقة: اسم المنطقة، السعر الأساسي، الوزن المشمول (كجم)، سعر الكيلو الإضافي، مدة التسليم (ساعة).</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <input value={newCity} onChange={(event) => setNewCity(event.target.value)} placeholder="اسم المحافظة أو المنطقة" className="h-11 rounded-xl border border-[#e3d0b2] bg-white px-3 text-right" />
            <input value={newRate} onChange={(event) => setNewRate(event.target.value)} type="number" min="0" placeholder="سعر الشحن" className="h-11 rounded-xl border border-[#e3d0b2] bg-white px-3 text-right" />
            <input value={newIncludedKg} onChange={(event) => setNewIncludedKg(event.target.value)} type="number" min="0.1" step="0.1" placeholder="الوزن المشمول بالكيلو" className="h-11 rounded-xl border border-[#e3d0b2] bg-white px-3 text-right" />
            <input value={newExtraKgRate} onChange={(event) => setNewExtraKgRate(event.target.value)} type="number" min="0" placeholder="سعر الكيلو الإضافي" className="h-11 rounded-xl border border-[#e3d0b2] bg-white px-3 text-right" />
            <input value={newDeliveryHours} onChange={(event) => setNewDeliveryHours(event.target.value)} type="number" min="1" placeholder="مدة التوصيل بالساعات" className="h-11 rounded-xl border border-[#e3d0b2] bg-white px-3 text-right" />
            <button type="button" onClick={addZone} className="rounded-full bg-[#2f1e17] px-4 py-2 text-sm font-bold text-[#fffaf5]">إضافة منطقة</button>
          </div>
        </div>

        <label className="block text-right text-sm font-bold text-[#2f1e17]">
          رقم فودافون كاش لاستلام العربون
          <input dir="ltr" value={settings.vodafoneCashNumber} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, vodafoneCashNumber: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-left" />
        </label>

        <label className="block text-right text-sm font-bold text-[#2f1e17]">
          قيمة العربون المطلوبة
          <input type="number" min="0" value={settings.depositAmount} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, depositAmount: Number(event.target.value) }))} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
        </label>

        <label className="inline-flex items-center gap-3 text-right text-sm font-bold text-[#2f1e17]">
          <input type="checkbox" checked={settings.freeShipping} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, freeShipping: event.target.checked }))} />
          شحن مجاني
        </label>
      </div>
    </div>
  );
}

function AdminSiteSettingsPage({ settings, setSettings }: { settings: Settings; setSettings: Dispatch<SetStateAction<Settings>> }) {
  const updateCategoryImage = (category: string, image: string) => {
    setSettings((prev: Settings) => ({ ...prev, categoryImages: { ...prev.categoryImages, [category]: image } }));
  };

  return (
    <div className="rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-6 shadow-sm">
      <h2 className="mb-5 text-2xl font-black text-[#2f1e17]">هوية الموقع والصور</h2>
      <div className="space-y-4">
        <label className="block text-right text-sm font-bold text-[#2f1e17]">
          اسم المتجر
          <input value={settings.siteName} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, siteName: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
        </label>

        <label className="block text-right text-sm font-bold text-[#2f1e17]">
          نص من نحن
          <textarea value={settings.aboutText} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, aboutText: event.target.value }))} className="mt-2 min-h-32 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 py-3 text-right" />
        </label>

        <label className="block text-right text-sm font-bold text-[#2f1e17]">
          رابط الفيسبوك
          <input value={settings.facebook} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, facebook: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] px-3 text-right" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-right text-sm font-bold text-[#2f1e17]">لون الهوية الرئيسي<input type="color" value={settings.brandPrimary} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, brandPrimary: event.target.value }))} className="mt-2 h-12 w-full cursor-pointer rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] p-1" /></label>
          <label className="block text-right text-sm font-bold text-[#2f1e17]">لون الهوية المساعد<input type="color" value={settings.brandAccent} onChange={(event) => setSettings((prev: Settings) => ({ ...prev, brandAccent: event.target.value }))} className="mt-2 h-12 w-full cursor-pointer rounded-xl border border-[#e3d0b2] bg-[#f9f4ee] p-1" /></label>
        </div>

        <div className="space-y-4 border-t border-[#ead7b8] pt-5">
          <h3 className="text-xl font-black text-[#2f1e17]">صور الموقع</h3>
          <ImageSettingField label="اللوجو" value={settings.logoImage} onChange={(logoImage) => setSettings((prev: Settings) => ({ ...prev, logoImage }))} />
          <ImageSettingField label="صورة الواجهة الرئيسية" value={settings.heroImage} onChange={(heroImage) => setSettings((prev: Settings) => ({ ...prev, heroImage }))} />
          <ImageSettingField label="صورة صفحة من نحن" value={settings.aboutImage} onChange={(aboutImage) => setSettings((prev: Settings) => ({ ...prev, aboutImage }))} />
          <ImageSettingField label="صورة صفحة التواصل" value={settings.contactImage} onChange={(contactImage) => setSettings((prev: Settings) => ({ ...prev, contactImage }))} />
          <h3 className="pt-2 text-lg font-black text-[#2f1e17]">صور التصنيفات</h3>
          {Object.keys(defaultSettings.categoryImages).map((category) => (
            <ImageSettingField key={category} label={category} value={settings.categoryImages[category] ?? ''} onChange={(image) => updateCategoryImage(category, image)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageSettingField({ label, value, onChange }: { label: string; value: string; onChange: (image: string) => void }) {
  const [error, setError] = useState('');

  const handleUpload = async (file?: File) => {
    if (!file) return;
    try {
      onChange(await persistImage(file));
      setError('');
    } catch {
      setError('تعذر تحميل الصورة. جرّبي ملفًا بصيغة JPG أو PNG أو WebP.');
    }
  };

  return (
    <div className="rounded-2xl border border-[#ead7b8] bg-[#faf4ee] p-3">
      <label className="block text-right text-sm font-bold text-[#2f1e17]">{label}
        <input value={value.startsWith('data:') ? '' : value} onChange={(event) => onChange(event.target.value)} placeholder="الصقي رابط الصورة" className="mt-2 h-11 w-full rounded-xl border border-[#e3d0b2] bg-white px-3 text-left" dir="auto" />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-full border border-[#d7b28b] bg-white px-4 py-2 text-xs font-bold text-[#2f1e17]">رفع صورة<input type="file" accept="image/*" onChange={(event) => void handleUpload(event.target.files?.[0])} className="sr-only" /></label>
        {value && <img src={value} alt={`معاينة ${label}`} className="h-14 w-14 rounded-lg border border-[#e3d0b2] bg-white object-contain" />}
        {value && <button type="button" onClick={() => onChange('')} className="text-xs font-bold text-[#934c3c]">إزالة</button>}
      </div>
      {error && <p className="mt-2 text-xs text-[#934c3c]">{error}</p>}
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-[#ead7b8] bg-[#fffaf5] p-10 shadow-sm">
        <p className="text-sm font-bold text-[#9e7650]">404</p>
        <h1 className="mt-2 text-4xl font-black text-[#2f1e17]">الصفحة غير موجودة</h1>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-[#2f1e17] px-6 py-3 text-sm font-bold text-[#fffaf5]">العودة للرئيسية</Link>
      </div>
    </div>
  );
}

function Footer({ settings }: { settings: Settings }) {
  return (
    <footer className="mt-10 border-t border-[#d9c3a7] bg-[#201611] text-[#f6efe7]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
        <div>
          <p className="text-2xl font-black">{settings.siteName}</p>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#d9c2aa]">متجر الزي الإسلامي النسائي، يقدم لكِ تشكيلة مختارة بعناية من القطع الأنيقة والملائمة والعملية.</p>
        </div>
        <div>
          <p className="text-lg font-black">روابط سريعة</p>
          <div className="mt-4 grid gap-2 text-sm text-[#d9c2aa]">
            <Link to="/">الرئيسية</Link>
            <Link to="/shop">المنتجات</Link>
            <Link to="/about">من نحن</Link>
            <Link to="/contact">تواصل معنا</Link>
          </div>
        </div>
        <div>
          <p className="text-lg font-black">التواصل</p>
          <div className="mt-4 space-y-3 text-sm text-[#d9c2aa]">
            <div>{settings.vodafoneCashNumber}</div>
            {settings.whatsapp && <div>{settings.whatsapp}</div>}
            <div>{settings.facebook}</div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default App;
