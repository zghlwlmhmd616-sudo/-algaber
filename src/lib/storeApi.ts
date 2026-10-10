import type { Order, Product, Review, Settings } from '../types';
import { supabase } from './supabase';

function requireSupabase() {
  if (!supabase) throw new Error('إعدادات قاعدة البيانات غير مكتملة.');
  return supabase;
}

export async function verifyAdmin(userId: string) {
  const client = requireSupabase();
  const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function loadProducts() {
  const client = requireSupabase();
  const { data, error } = await client.from('products').select('data');
  if (error) throw error;
  return (data ?? []).map((row) => row.data as Product);
}

export async function loadOrders() {
  const client = requireSupabase();
  const { data, error } = await client.from('orders').select('data').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.data as Order);
}

export async function loadReviews() {
  const client = requireSupabase();
  const { data, error } = await client.from('reviews').select('data').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.data as Review);
}

export async function loadSettings() {
  const client = requireSupabase();
  const { data, error } = await client.from('store_settings').select('data').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data?.data as Settings | undefined;
}

export async function createOrder(order: Order) {
  const client = requireSupabase();
  const { error } = await client.from('orders').insert({
    id: order.id,
    data: order,
    status: order.status,
    created_at: order.createdAt,
  });
  if (error) throw error;
}

export async function createReview(review: Review) {
  const client = requireSupabase();
  const { error } = await client.from('reviews').insert({
    id: review.id,
    data: review,
    status: review.status,
    created_at: review.createdAt,
  });
  if (error) throw error;
}

export async function saveProducts(products: Product[]) {
  const client = requireSupabase();
  const { error } = await client.from('products').upsert(products.map((product) => ({
    id: product.id,
    data: product,
    status: product.status,
  })));
  if (error) throw error;
}

export async function saveOrders(orders: Order[]) {
  const client = requireSupabase();
  const { error } = await client.from('orders').upsert(orders.map((order) => ({
    id: order.id,
    data: order,
    status: order.status,
    created_at: order.createdAt,
  })));
  if (error) throw error;
}

export async function saveReviews(reviews: Review[]) {
  const client = requireSupabase();
  const { error } = await client.from('reviews').upsert(reviews.map((review) => ({
    id: review.id,
    data: review,
    status: review.status,
    created_at: review.createdAt,
  })));
  if (error) throw error;
}

export async function saveSettings(settings: Settings) {
  const client = requireSupabase();
  const { error } = await client.from('store_settings').upsert({ id: 1, data: settings });
  if (error) throw error;
}

export async function bootstrapStore(settings: Settings) {
  const client = requireSupabase();
  const { data: storedSettings, error: settingsError } = await client.from('store_settings').select('id').eq('id', 1).maybeSingle();
  if (settingsError) throw settingsError;
  if (!storedSettings) await saveSettings(settings);
}

export async function uploadStoreImage(dataUrl: string) {
  const client = requireSupabase();
  const response = await fetch(dataUrl);
  const image = await response.blob();
  const path = `${crypto.randomUUID()}.webp`;
  const { error } = await client.storage.from('store-images').upload(path, image, {
    contentType: 'image/webp',
    cacheControl: '31536000',
  });
  if (error) throw error;
  return client.storage.from('store-images').getPublicUrl(path).data.publicUrl;
}
