import type { CustomerReview, Destination, Enquiry, SpecialTrip, TripCategory } from '../data/destinations';
import { resolveApiBaseUrl } from '../config/runtime';
import type { EnquiryPayload } from '../utils/whatsapp';

const localApiUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
let adminSessionToken: string | undefined;

type TripData = {
  categories: TripCategory[];
  destinations: Destination[];
};

type AdminData = TripData & {
  enquiries: Enquiry[];
  specialTrips: SpecialTrip[];
  customerReviews: CustomerReview[];
};

export type EnquirySubmissionResult = {
  ok: true;
  enquiry: {
    id: string;
    createdAt: string;
  };
  notifications: {
    email: 'sent' | 'disabled' | 'failed';
    whatsapp: 'accepted' | 'disabled' | 'failed';
  };
};

async function request<T>(path: string, init?: RequestInit): Promise<T | undefined> {
  const response = await fetch(`${localApiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(adminSessionToken ? { Authorization: `Bearer ${adminSessionToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `API request failed with ${response.status}.`);
  }

  const text = await response.text();
  if (!text) return undefined;
  return JSON.parse(text) as T;
}

export async function getPublicTripData() {
  const data = await request<TripData>('/api/trip-data');
  if (!data) throw new Error('Local API returned an empty trip-data response.');
  return data;
}

export async function getAdminTripData() {
  const data = await request<AdminData>('/api/admin-data');
  if (!data) throw new Error('Local API returned an empty admin-data response.');
  return data;
}

export async function checkAdminSession() {
  return (await request<{ authenticated: boolean }>('/api/admin/session')) ?? { authenticated: false };
}

export async function loginAdmin(password: string) {
  const result = await request<{ authenticated: boolean; token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (!result?.authenticated || typeof result.token !== 'string' || !result.token) {
    throw new Error('Could not authenticate the admin session.');
  }
  adminSessionToken = result.token;
}

export async function logoutAdmin() {
  try {
    await request('/api/admin/logout', { method: 'POST' });
  } finally {
    adminSessionToken = undefined;
  }
}

export async function getPublicSpecialTrips() {
  return (await request<SpecialTrip[]>('/api/special-trips')) ?? [];
}

export async function getPublicCustomerReviews() {
  return (await request<CustomerReview[]>('/api/customer-reviews')) ?? [];
}

export async function saveEnquiry(payload: EnquiryPayload) {
  const result = await request<EnquirySubmissionResult>('/api/enquiries', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      email: payload.email.trim() || null,
      destination: payload.destination,
      travellers: payload.travellers,
      travelDate: payload.travelDate || null,
      message: payload.message.trim() || null,
    }),
  });
  if (!result?.ok) throw new Error('The enquiry API returned an invalid response.');
  return result;
}

export async function deleteEnquiry(id: string) {
  await request(`/api/enquiries/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function createSpecialTrip(trip: SpecialTrip) {
  await request('/api/special-trips', {
    method: 'POST',
    body: JSON.stringify(trip),
  });
}

export async function updateSpecialTrip(id: string, trip: SpecialTrip) {
  await request(`/api/special-trips/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(trip),
  });
}

export async function deleteSpecialTrip(id: string) {
  await request(`/api/special-trips/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function upsertCategory(category: TripCategory) {
  await request('/api/trip-categories', {
    method: 'POST',
    body: JSON.stringify(category),
  });
}

export async function upsertDestination(destination: Destination) {
  await request('/api/destinations', {
    method: 'POST',
    body: JSON.stringify(destination),
  });
}

export async function deleteCategory(id: string) {
  await request(`/api/trip-categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function deleteDestination(id: string) {
  await request(`/api/destinations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function createCustomerReview(review: Omit<CustomerReview, 'id' | 'createdAt'>) {
  const result = await request<CustomerReview>('/api/customer-reviews', {
    method: 'POST',
    body: JSON.stringify(review),
  });
  if (!result) throw new Error('Local API returned an empty customer review response.');
  return result;
}

export async function updateCustomerReview(id: string, review: Omit<CustomerReview, 'id' | 'createdAt'>) {
  const result = await request<CustomerReview>(`/api/customer-reviews/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(review),
  });
  if (!result) throw new Error('Local API returned an empty customer review response.');
  return result;
}

export async function deleteCustomerReview(id: string) {
  await request(`/api/customer-reviews/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
