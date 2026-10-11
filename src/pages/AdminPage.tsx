import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, ImagePlus, LogOut, Pencil, RefreshCw, Save, Trash2, X } from 'lucide-react';
import type { CustomerReview, Destination, Enquiry, SpecialTrip, TripCategory } from '../data/destinations';
import {
  createCustomerReview,
  deleteEnquiry,
  deleteCustomerReview,
  deleteCategory,
  deleteDestination,
  deleteSpecialTrip,
  getAdminTripData,
  createSpecialTrip,
  checkAdminSession,
  loginAdmin,
  logoutAdmin,
  updateCustomerReview,
  updateSpecialTrip,
  upsertCategory,
  upsertDestination,
} from '../lib/supabaseApi';
import { formatPoundPrice } from '../utils/currency';

const emptyCategory: TripCategory = {
  id: '',
  title: '',
  subtitle: '',
  tagline: '',
  image: '',
  iconName: 'map',
  accentColor: '#0b5960',
  sortOrder: 0,
  isActive: true,
};

const emptyDestination: Destination = {
  id: '',
  categoryId: '',
  name: '',
  image: '',
  images: [],
  shortDescription: '',
  overview: '',
  duration: '',
  placesToVisit: [],
  highlights: [],
  extraInfo: '',
  sortOrder: 0,
  isActive: true,
};

const emptySpecialTrip: SpecialTrip = {
  id: '',
  title: '',
  description: '',
  image: '',
  fromLocation: '',
  destination: '',
  tripDate: '',
  tripTime: '',
  originalPrice: '',
  price: '',
  seats: null,
  badge: '',
  isActive: true,
};

const emptyCustomerReview: Omit<CustomerReview, 'id' | 'createdAt'> = {
  name: '',
  trip: '',
  text: '',
  image: '',
  isActive: true,
};

const maximumImageSize = 2 * 1024 * 1024;
const maximumDestinationImageDataLength = 17_000_000;

export function AdminPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [password, setPassword] = useState('');
  const [categories, setCategories] = useState<TripCategory[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [specialTrips, setSpecialTrips] = useState<SpecialTrip[]>([]);
  const [customerReviews, setCustomerReviews] = useState<CustomerReview[]>([]);
  const [categoryForm, setCategoryForm] = useState<TripCategory>(emptyCategory);
  const [destinationForm, setDestinationForm] = useState<Destination>(emptyDestination);
  const [specialTripForm, setSpecialTripForm] = useState<SpecialTrip>(emptySpecialTrip);
  const [editingSpecialTripId, setEditingSpecialTripId] = useState('');
  const [customerReviewForm, setCustomerReviewForm] = useState<Omit<CustomerReview, 'id' | 'createdAt'>>(emptyCustomerReview);
  const [editingCustomerReviewId, setEditingCustomerReviewId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const destinationFormRef = useRef<HTMLFormElement>(null);

  const groupedDestinations = useMemo(
    () =>
      categories.map((category) => ({
        category,
        destinations: destinations.filter((destination) => destination.categoryId === category.id),
      })),
    [categories, destinations],
  );

  useEffect(() => {
    let isCurrent = true;
    checkAdminSession()
      .then(({ authenticated }) => {
        if (isCurrent) setIsUnlocked(authenticated);
      })
      .catch((sessionError) => {
        if (isCurrent) setError(sessionError instanceof Error ? sessionError.message : 'Could not verify the admin session.');
      })
      .finally(() => {
        if (isCurrent) setIsCheckingSession(false);
      });
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    if (isUnlocked) void loadAdminData();
  }, [isUnlocked]);

  async function loadAdminData() {
    try {
      setError('');
      const data = await getAdminTripData();
      setCategories(data.categories);
      setDestinations(data.destinations);
      setEnquiries(data.enquiries);
      setSpecialTrips(data.specialTrips ?? []);
      setCustomerReviews(data.customerReviews ?? []);
      setDestinationForm((current) => ({ ...current, categoryId: current.categoryId || data.categories[0]?.id || '' }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load admin data.');
    }
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await loginAdmin(password);
      setIsUnlocked(true);
      setPassword('');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Admin sign in failed.');
    }
  }

  async function lockAdmin() {
    try {
      await logoutAdmin();
      setIsUnlocked(false);
      setCategories([]);
      setDestinations([]);
      setEnquiries([]);
      setSpecialTrips([]);
      setCustomerReviews([]);
      setStatus('');
      setError('');
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Could not close the admin session.');
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const category = { ...categoryForm, id: categoryForm.id || slugify(categoryForm.title) };
    try {
      await upsertCategory(category);
      setCategoryForm(emptyCategory);
      setStatus('Category saved.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save category.');
    }
  }

  async function saveDestination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const images = destinationForm.images?.length ? destinationForm.images : [destinationForm.image].filter(Boolean);
    const destination = {
      ...destinationForm,
      id: destinationForm.id || slugify(destinationForm.name),
      image: images[0] || '',
      images,
    };
    try {
      await upsertDestination(destination);
      setDestinationForm({ ...emptyDestination, categoryId: categories[0]?.id || '' });
      setStatus('Place saved.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save place.');
    }
  }

  async function addDestinationImages(files: FileList | null) {
    if (!files?.length) return;
    const currentImages = destinationForm.images?.length ? destinationForm.images : [destinationForm.image].filter(Boolean);
    const remainingSlots = 6 - currentImages.length;
    if (remainingSlots <= 0) {
      setError('A place can have up to 6 images. Remove an image before uploading another.');
      return;
    }

    try {
      const selectedFiles = Array.from(files).slice(0, remainingSlots);
      const newImages = await Promise.all(selectedFiles.map(compressImage));
      const images = [...currentImages, ...newImages];
      if (images.reduce((total, image) => total + image.length, 0) > maximumDestinationImageDataLength) {
        throw new Error('These images are too large to save together. Choose smaller files or remove an image.');
      }
      setDestinationForm({ ...destinationForm, image: images[0] || '', images });
      setError('');
      setStatus(`${newImages.length} image${newImages.length === 1 ? '' : 's'} added. Save the place to publish them.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not process the selected images.');
    }
  }

  function removeDestinationImage(index: number) {
    const images = (destinationForm.images?.length ? destinationForm.images : [destinationForm.image].filter(Boolean))
      .filter((_, imageIndex) => imageIndex !== index);
    setDestinationForm({ ...destinationForm, image: images[0] || '', images });
  }

  function editDestination(destination: Destination) {
    setDestinationForm({
      ...destination,
      images: destination.images?.length ? [...destination.images] : [destination.image].filter(Boolean),
    });
    setError('');
    setStatus(`Editing ${destination.name}. Add or remove photos, then update the place to publish your changes.`);
    destinationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelDestinationEdit() {
    setDestinationForm({ ...emptyDestination, categoryId: categories[0]?.id || '' });
    setStatus('');
  }

  async function addSpecialTripImage(file: File | undefined) {
    if (!file) return;

    try {
      const image = await compressImage(file);
      setSpecialTripForm((current) => ({ ...current, image }));
      setError('');
      setStatus('Special trip photo added. Save the trip to publish it.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not process the special trip photo.');
    }
  }

  async function saveSpecialTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trip = {
      ...specialTripForm,
      id: editingSpecialTripId || slugify(specialTripForm.title),
    };
    if (!trip.id) {
      setError('Enter a title that can be used to identify this special trip.');
      return;
    }

    try {
      if (editingSpecialTripId) {
        await updateSpecialTrip(editingSpecialTripId, trip);
      } else {
        await createSpecialTrip(trip);
      }
      setSpecialTripForm(emptySpecialTrip);
      setEditingSpecialTripId('');
      setStatus('Special trip saved.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save special trip.');
    }
  }

  async function changeSpecialTripStatus(trip: SpecialTrip) {
    try {
      await updateSpecialTrip(trip.id, { ...trip, isActive: !trip.isActive });
      setStatus(`Special trip ${trip.isActive ? 'hidden' : 'published'}.`);
      await loadAdminData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update special trip.');
    }
  }

  async function removeSpecialTrip(trip: SpecialTrip) {
    if (!window.confirm(`Delete "${trip.title}"? This cannot be undone.`)) return;
    try {
      await deleteSpecialTrip(trip.id);
      setStatus('Special trip deleted.');
      await loadAdminData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete special trip.');
    }
  }

  async function addCustomerReviewImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for the customer photo.');
      return;
    }

    try {
      const image = await compressImage(file);
      setCustomerReviewForm((current) => ({ ...current, image }));
      setError('');
      setStatus('Customer photo added. Save the review to publish it.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not process the customer photo.');
    }
  }

  async function saveCustomerReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerReviewForm.image) {
      setError('Upload a customer photo before saving this review.');
      return;
    }

    try {
      if (editingCustomerReviewId) {
        await updateCustomerReview(editingCustomerReviewId, customerReviewForm);
      } else {
        await createCustomerReview(customerReviewForm);
      }
      setCustomerReviewForm(emptyCustomerReview);
      setEditingCustomerReviewId('');
      setStatus('Customer review saved.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save customer review.');
    }
  }

  async function removeCustomerReview(review: CustomerReview) {
    if (!window.confirm(`Delete the review from "${review.name}"? This cannot be undone.`)) return;
    try {
      await deleteCustomerReview(review.id);
      setStatus('Customer review deleted.');
      await loadAdminData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete customer review.');
    }
  }

  async function removeEnquiry(enquiry: Enquiry) {
    if (!window.confirm(`Delete the enquiry from "${enquiry.name}"? This cannot be undone.`)) return;
    try {
      await deleteEnquiry(enquiry.id);
      setStatus('Enquiry deleted.');
      await loadAdminData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete enquiry.');
    }
  }

  if (!isUnlocked) {
    return (
      <main className="grid min-h-screen place-items-center bg-ocean-950 px-4 text-white">
        <form className="w-full max-w-md rounded-[8px] bg-white p-6 text-slate-900 shadow-soft" onSubmit={unlock}>
          <h1 className="font-display text-4xl font-bold text-ocean-900">Admin</h1>
          {isCheckingSession && <p className="mt-3 text-sm text-slate-600">Checking your admin session...</p>}
          <label className="mt-6 block">
            <span className="mb-2 block text-sm font-bold">Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
          <button className="btn-primary mt-5 w-full justify-center" type="submit" disabled={isCheckingSession}>
            Open Admin
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a className="inline-flex items-center gap-2 text-sm font-bold text-ocean-700" href="/">
              <ArrowLeft size={16} /> Back to site
            </a>
            <h1 className="mt-2 font-display text-4xl font-bold text-ocean-900">Trips Admin</h1>
          </div>
          <div className="flex gap-2">
            <button className="btn-outline justify-center" onClick={loadAdminData}>
              <RefreshCw size={17} /> Refresh
            </button>
            <button className="btn-outline justify-center" onClick={() => void lockAdmin()}>
              <LogOut size={17} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[8px] bg-white p-5 shadow-soft lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-ocean-900">Special Trips</h2>
              <p className="mt-1 text-sm text-slate-600">Prepare trips in advance; only published trips appear on the homepage.</p>
            </div>
            {editingSpecialTripId && (
              <button type="button" className="text-sm font-bold text-ocean-700 underline" onClick={() => {
                setSpecialTripForm(emptySpecialTrip);
                setEditingSpecialTripId('');
              }}>
                Cancel edit
              </button>
            )}
          </div>
          <form className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveSpecialTrip}>
            <TextInput label="Title" value={specialTripForm.title} onChange={(title) => setSpecialTripForm({ ...specialTripForm, title })} required />
            <TextInput label="From" value={specialTripForm.fromLocation} onChange={(fromLocation) => setSpecialTripForm({ ...specialTripForm, fromLocation })} />
            <TextInput label="Destination" value={specialTripForm.destination} onChange={(destination) => setSpecialTripForm({ ...specialTripForm, destination })} required />
            <TextInput
              label="Image URL or local path"
              value={specialTripForm.image.startsWith('data:') ? '' : specialTripForm.image}
              onChange={(image) => setSpecialTripForm({ ...specialTripForm, image })}
            />
            <label>
              <span className="mb-2 block text-sm font-bold">Upload trip photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  void addSpecialTripImage(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
            {specialTripForm.image.startsWith('data:') && (
              <img src={specialTripForm.image} alt="Special trip photo preview" className="h-24 w-24 rounded-[8px] object-cover" />
            )}
            <label>
              <span className="mb-2 block text-sm font-bold">Date</span>
              <input type="date" value={specialTripForm.tripDate} onChange={(event) => setSpecialTripForm({ ...specialTripForm, tripDate: event.target.value })} />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold">Time</span>
              <input type="time" value={specialTripForm.tripTime} onChange={(event) => setSpecialTripForm({ ...specialTripForm, tripTime: event.target.value })} />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold">Original price (£)</span>
              <input type="number" min="0" step="0.01" value={specialTripForm.originalPrice} onChange={(event) => setSpecialTripForm({ ...specialTripForm, originalPrice: event.target.value })} />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold">Discount price (£)</span>
              <input type="number" min="0" step="0.01" value={specialTripForm.price} onChange={(event) => setSpecialTripForm({ ...specialTripForm, price: event.target.value })} />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold">Seats available</span>
              <input type="number" min="0" step="1" value={specialTripForm.seats ?? ''} onChange={(event) => setSpecialTripForm({ ...specialTripForm, seats: event.target.value === '' ? null : Number(event.target.value) })} />
            </label>
            <TextInput label="Badge (optional)" value={specialTripForm.badge} onChange={(badge) => setSpecialTripForm({ ...specialTripForm, badge })} />
            <label className="sm:col-span-2 lg:col-span-3">
              <span className="mb-2 block text-sm font-bold">Description</span>
              <textarea value={specialTripForm.description} onChange={(event) => setSpecialTripForm({ ...specialTripForm, description: event.target.value })} rows={3} />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-3">
              <Toggle checked={specialTripForm.isActive} onChange={(isActive) => setSpecialTripForm({ ...specialTripForm, isActive })} />
              <button className="btn-primary justify-center" type="submit">
                <Save size={17} /> {editingSpecialTripId ? 'Update Special Trip' : 'Add Special Trip'}
              </button>
            </div>
          </form>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {specialTrips.map((trip) => (
              <article key={trip.id} className="flex flex-col justify-between gap-4 rounded-[8px] border border-slate-200 p-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-ocean-900">{trip.title}</h3>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${trip.isActive ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      {trip.isActive ? 'Published' : 'Hidden'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{trip.fromLocation ? `${trip.fromLocation} → ` : ''}{trip.destination}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[
                      trip.tripDate,
                      trip.tripTime,
                      trip.originalPrice && `Was ${formatPoundPrice(trip.originalPrice)}`,
                      trip.price && `${trip.originalPrice ? 'Now ' : 'Price: '}${formatPoundPrice(trip.price)}`,
                      trip.seats !== null && `${trip.seats} seats`,
                    ].filter(Boolean).join(' · ') || 'No schedule or price set'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-outline min-h-10 px-3 py-2 text-xs" onClick={() => {
                    setSpecialTripForm(trip);
                    setEditingSpecialTripId(trip.id);
                    setError('');
                  }}>
                    <Save size={15} /> Edit
                  </button>
                  <button type="button" className="btn-outline min-h-10 px-3 py-2 text-xs" onClick={() => void changeSpecialTripStatus(trip)}>
                    {trip.isActive ? <EyeOff size={15} /> : <Eye size={15} />}{trip.isActive ? 'Hide' : 'Publish'}
                  </button>
                  <button type="button" className="btn-outline min-h-10 border-red-200 px-3 py-2 text-xs text-red-700 hover:bg-red-50" onClick={() => void removeSpecialTrip(trip)}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </article>
            ))}
            {specialTrips.length === 0 && <p className="text-sm text-slate-500">No special trips added yet.</p>}
          </div>
        </section>

        <section className="rounded-[8px] bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-ocean-900">Tour Categories</h2>
          <form className="mt-5 grid gap-4" onSubmit={saveCategory}>
            <TextInput label="Title" value={categoryForm.title} onChange={(title) => setCategoryForm({ ...categoryForm, title })} required />
            <TextInput label="Subtitle" value={categoryForm.subtitle} onChange={(subtitle) => setCategoryForm({ ...categoryForm, subtitle })} />
            <TextInput label="Button Label" value={categoryForm.tagline} onChange={(tagline) => setCategoryForm({ ...categoryForm, tagline })} />
            <TextInput label="Hero Image URL" value={categoryForm.image} onChange={(image) => setCategoryForm({ ...categoryForm, image })} />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextInput label="Icon" value={categoryForm.iconName} onChange={(iconName) => setCategoryForm({ ...categoryForm, iconName })} />
              <TextInput label="Color" value={categoryForm.accentColor} onChange={(accentColor) => setCategoryForm({ ...categoryForm, accentColor })} />
              <TextInput label="Order" value={String(categoryForm.sortOrder)} onChange={(sortOrder) => setCategoryForm({ ...categoryForm, sortOrder: Number(sortOrder) || 0 })} />
            </div>
            <Toggle checked={categoryForm.isActive} onChange={(isActive) => setCategoryForm({ ...categoryForm, isActive })} />
            <button className="btn-primary justify-center" type="submit">
              <Save size={17} /> Save Category
            </button>
          </form>
        </section>

        <section className="rounded-[8px] bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-ocean-900">Places</h2>
          <form ref={destinationFormRef} className="mt-5 grid scroll-mt-6 gap-4" onSubmit={saveDestination}>
            {destinationForm.id && (
              <div className="flex items-center justify-between gap-3 rounded-[8px] bg-ocean-50 px-4 py-3">
                <p className="font-semibold text-ocean-900">Editing {destinationForm.name}</p>
                <button type="button" className="text-sm font-bold text-ocean-800 underline" onClick={cancelDestinationEdit}>
                  Cancel
                </button>
              </div>
            )}
            <label>
              <span className="mb-2 block text-sm font-bold">Category</span>
              <select value={destinationForm.categoryId} onChange={(event) => setDestinationForm({ ...destinationForm, categoryId: event.target.value })} required>
                <option value="">Choose category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.title}
                  </option>
                ))}
              </select>
            </label>
            <TextInput label="Place Name" value={destinationForm.name} onChange={(name) => setDestinationForm({ ...destinationForm, name })} required />
            <div>
              <span className="mb-2 block text-sm font-bold">Place photos ({destinationForm.images?.length || (destinationForm.image ? 1 : 0)}/6)</span>
              <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(destinationForm.images?.length ? destinationForm.images : [destinationForm.image].filter(Boolean)).map((image, index) => (
                  <div key={`${destinationForm.id || 'new'}-${index}`} className="relative overflow-hidden rounded-[8px] border border-slate-200">
                    <img src={image} alt={`${destinationForm.name || 'Place'} photo ${index + 1}`} className="h-28 w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-red-700 shadow"
                      aria-label={`Delete photo ${index + 1}`}
                      onClick={() => removeDestinationImage(index)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {(destinationForm.images?.length || (destinationForm.image ? 1 : 0)) < 6 && (
                  <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-[8px] border-2 border-dashed border-ocean-200 bg-ocean-50 px-3 text-center text-sm font-semibold text-ocean-800 hover:bg-ocean-100">
                    <ImagePlus size={22} />
                    Upload place photos
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) => {
                        void addDestinationImages(event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              <TextInput
                label="Or use an image URL"
                value={destinationForm.image.startsWith('data:') ? '' : destinationForm.image}
                onChange={(image) => setDestinationForm({ ...destinationForm, image, images: image ? [image, ...(destinationForm.images || []).slice(1)] : destinationForm.images?.slice(1) || [] })}
              />
              <p className="mt-2 text-xs text-slate-500">Upload up to 6 photos, each no larger than 2 MB after processing. Removed photos are deleted from the saved place and website when you save.</p>
            </div>
            <TextInput
              label="Short Description"
              value={destinationForm.shortDescription}
              onChange={(shortDescription) => setDestinationForm({ ...destinationForm, shortDescription })}
            />
            <TextArea label="Overview" value={destinationForm.overview} onChange={(overview) => setDestinationForm({ ...destinationForm, overview })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Duration" value={destinationForm.duration} onChange={(duration) => setDestinationForm({ ...destinationForm, duration })} />
              <TextInput label="Order" value={String(destinationForm.sortOrder)} onChange={(sortOrder) => setDestinationForm({ ...destinationForm, sortOrder: Number(sortOrder) || 0 })} />
            </div>
            <TextArea label="Places to Visit (one per line)" value={destinationForm.placesToVisit.join('\n')} onChange={(value) => setDestinationForm({ ...destinationForm, placesToVisit: toLines(value) })} />
            <TextArea label="Highlights (one per line)" value={destinationForm.highlights.join('\n')} onChange={(value) => setDestinationForm({ ...destinationForm, highlights: toLines(value) })} />
            <TextArea label="Extra Info" value={destinationForm.extraInfo} onChange={(extraInfo) => setDestinationForm({ ...destinationForm, extraInfo })} />
            <Toggle checked={destinationForm.isActive} onChange={(isActive) => setDestinationForm({ ...destinationForm, isActive })} />
            <button className="btn-primary justify-center" type="submit">
              <Save size={17} /> {destinationForm.id ? 'Update Place' : 'Save Place'}
            </button>
          </form>
        </section>

        <section className="rounded-[8px] bg-white p-5 shadow-soft lg:col-span-2">
          <h2 className="text-xl font-bold text-ocean-900">Current Trips</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {groupedDestinations.map(({ category, destinations: categoryDestinations }) => (
              <div key={category.id} className="rounded-[8px] border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-ocean-900">{category.title}</h3>
                    <p className="text-sm text-slate-500">{category.isActive ? 'Published' : 'Hidden'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="grid h-9 w-9 place-items-center rounded-[8px] bg-ocean-50 text-ocean-800" onClick={() => setCategoryForm(category)} aria-label="Edit category">
                      <Save size={16} />
                    </button>
                    <button className="grid h-9 w-9 place-items-center rounded-[8px] bg-red-50 text-red-700" onClick={() => void deleteCategory(category.id).then(loadAdminData)} aria-label="Delete category">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {categoryDestinations.map((destination) => (
                    <div key={destination.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-stone-50 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex shrink-0 gap-1">
                          {(destination.images?.length ? destination.images : [destination.image].filter(Boolean)).map((image, index) => (
                            <img key={`${destination.id}-${index}`} src={image} alt={`${destination.name} photo ${index + 1}`} className="h-11 w-11 rounded-[6px] object-cover" />
                          ))}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{destination.name}</p>
                          <p className="text-xs text-slate-500">{destination.images?.length || (destination.image ? 1 : 0)} photo(s)</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="inline-flex items-center gap-1 rounded-[6px] bg-ocean-100 px-2 py-1 text-sm font-bold text-ocean-800 hover:bg-ocean-200" onClick={() => editDestination(destination)}>
                          <Pencil size={16} />
                          Edit
                        </button>
                        <button type="button" className="text-red-700" onClick={() => void deleteDestination(destination.id).then(loadAdminData)} aria-label="Delete place">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[8px] bg-white p-5 shadow-soft lg:col-span-2">
          <h2 className="text-xl font-bold text-ocean-900">Customer Reviews & Photos</h2>
          <p className="mt-1 text-sm text-slate-600">Add customer-approved reviews and photos. Published entries appear on the website.</p>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={saveCustomerReview}>
            <TextInput label="Customer name" value={customerReviewForm.name} onChange={(name) => setCustomerReviewForm({ ...customerReviewForm, name })} required />
            <TextInput label="Trip or destination" value={customerReviewForm.trip} onChange={(trip) => setCustomerReviewForm({ ...customerReviewForm, trip })} />
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold">Customer review</span>
              <textarea className="w-full rounded-[8px] border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-ocean-600 focus:ring-4 focus:ring-ocean-100" value={customerReviewForm.text} onChange={(event) => setCustomerReviewForm({ ...customerReviewForm, text: event.target.value })} maxLength={2000} rows={3} required />
            </label>
            <div className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold">Customer photo</span>
              {customerReviewForm.image && (
                <div className="relative mb-3 w-fit overflow-hidden rounded-[8px] border border-slate-200">
                  <img src={customerReviewForm.image} alt="Customer photo preview" className="h-40 w-40 object-cover" />
                  <button type="button" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-red-700 shadow" aria-label="Remove customer photo" onClick={() => setCustomerReviewForm({ ...customerReviewForm, image: '' })}>
                    <X size={16} />
                  </button>
                </div>
              )}
              <label className="flex min-h-24 max-w-sm cursor-pointer flex-col items-center justify-center gap-2 rounded-[8px] border-2 border-dashed border-ocean-200 bg-ocean-50 px-3 text-center text-sm font-semibold text-ocean-800 hover:bg-ocean-100">
                <ImagePlus size={22} />
                {customerReviewForm.image ? 'Choose a different photo' : 'Upload customer photo'}
                <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                  void addCustomerReviewImage(event.target.files?.[0]);
                  event.target.value = '';
                }} />
              </label>
              <p className="mt-2 text-xs text-slate-500">Images over 2 MB are compressed before saving. Only upload photos with the customer’s permission.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <Toggle checked={customerReviewForm.isActive} onChange={(isActive) => setCustomerReviewForm({ ...customerReviewForm, isActive })} />
              <button className="btn-primary justify-center" type="submit">
                <Save size={17} /> {editingCustomerReviewId ? 'Update Review' : 'Save Review'}
              </button>
              {editingCustomerReviewId && (
                <button type="button" className="text-sm font-bold text-ocean-700 underline" onClick={() => {
                  setCustomerReviewForm(emptyCustomerReview);
                  setEditingCustomerReviewId('');
                }}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {customerReviews.map((review) => (
              <article key={review.id} className="flex gap-3 rounded-[8px] border border-slate-200 p-3">
                {review.image && <img src={review.image} alt="" className="h-20 w-20 shrink-0 rounded-[6px] object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-ocean-900">{review.name}</h3>
                      <p className="text-xs text-slate-500">{review.trip || 'Trip not specified'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[0.65rem] font-bold ${review.isActive ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      {review.isActive ? 'Published' : 'Hidden'}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600">{review.text}</p>
                  <div className="mt-2 flex gap-3">
                    <button type="button" className="text-sm font-bold text-ocean-800" onClick={() => {
                      setCustomerReviewForm({ name: review.name, trip: review.trip, text: review.text, image: review.image, isActive: review.isActive });
                      setEditingCustomerReviewId(review.id);
                    }}>
                      Edit
                    </button>
                    <button type="button" className="text-sm font-bold text-red-700" onClick={() => void removeCustomerReview(review)}>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {customerReviews.length === 0 && <p className="text-sm text-slate-500">No customer reviews added yet.</p>}
          </div>
        </section>

        <section className="rounded-[8px] bg-white p-5 shadow-soft lg:col-span-2">
          <h2 className="text-xl font-bold text-ocean-900">Customer Enquiries</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-ocean-50 text-ocean-900">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Destination</th>
                  <th className="px-3 py-3">Message</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((enquiry) => (
                  <tr key={enquiry.id} className="border-b border-slate-100">
                    <td className="px-3 py-3">{new Date(enquiry.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3 font-semibold">{enquiry.name}</td>
                    <td className="px-3 py-3">{enquiry.phone}</td>
                    <td className="px-3 py-3">{enquiry.destination}</td>
                    <td className="px-3 py-3">{enquiry.message}</td>
                    <td className="px-3 py-3">
                      <button type="button" className="inline-flex items-center gap-1 font-semibold text-red-700" onClick={() => void removeEnquiry(enquiry)}>
                        <Trash2 size={15} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {enquiries.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={6}>No customer enquiries yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {(status || error) && <div className="fixed bottom-4 left-4 right-4 z-50 rounded-[8px] bg-ocean-950 px-4 py-3 text-sm font-bold text-white shadow-soft sm:left-auto sm:max-w-md">{error || status}</div>}
    </main>
  );
}

function TextInput({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} />
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button className="inline-flex w-fit items-center gap-2 font-bold text-ocean-900" type="button" onClick={() => onChange(!checked)}>
      {checked ? <Eye size={18} /> : <EyeOff size={18} />} {checked ? 'Published' : 'Hidden'}
    </button>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function toLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function compressImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error(`"${file.name}" is not a supported image. Choose a JPEG, PNG, or WebP file.`);
  }
  if (file.size <= maximumImageSize) return readFileAsDataUrl(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Could not open "${file.name}" for compression. Choose a valid image file.`);
  }

  try {
    const originalMaxDimension = Math.max(bitmap.width, bitmap.height);
    if (!originalMaxDimension) throw new Error(`Could not process "${file.name}".`);
    let maxDimension = Math.min(4096, originalMaxDimension);
    const qualities = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25];

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const scale = Math.min(1, maxDimension / originalMaxDimension);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error(`Could not process "${file.name}".`);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of qualities) {
        let blob = await canvasToBlob(canvas, 'image/webp', quality);
        if (blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (blob.size <= maximumImageSize) return readBlobAsDataUrl(blob);
      }

      if (maxDimension <= 128) break;
      maxDimension = Math.max(128, Math.floor(maxDimension * 0.8));
    }
    throw new Error(`Could not compress "${file.name}" to 2 MB. Choose a smaller image.`);
  } finally {
    bitmap.close();
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error(`Could not read "${file.name}".`));
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not prepare the compressed image for upload.'));
    reader.onerror = () => reject(new Error('Could not prepare the compressed image for upload.'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('The browser could not compress this image.')),
      type,
      quality,
    );
  });
}
