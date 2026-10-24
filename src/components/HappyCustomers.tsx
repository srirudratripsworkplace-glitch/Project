import { useEffect, useMemo, useRef, useState } from 'react';
import { Quote, Star, UserRound } from 'lucide-react';
import type { CustomerReview } from '../data/destinations';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

export function HappyCustomers({ reviews }: { reviews: CustomerReview[] }) {
  const [activePhoto, setActivePhoto] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [failedPhotos, setFailedPhotos] = useState<number[]>([]);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeReview, setActiveReview] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const reviewTimerRef = useRef<number | undefined>(undefined);
  const customerPhotos = useMemo(
    () => reviews.filter((review) => review.image).map((review) => ({ id: review.id, src: review.image, name: review.name })),
    [reviews],
  );

  useEffect(() => {
    setActivePhoto((index) => customerPhotos.length ? index % customerPhotos.length : 0);
    setActiveReview((index) => reviews.length ? index % reviews.length : 0);
  }, [customerPhotos.length, reviews.length]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setIsReducedMotion(query.matches);
    updateMotionPreference();
    query.addEventListener('change', updateMotionPreference);
    return () => query.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const updateViewport = () => setIsMobile(query.matches);
    updateViewport();
    query.addEventListener('change', updateViewport);
    return () => query.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (customerPhotos.length < 2 || isPaused || !isVisible || isReducedMotion) return;
    timerRef.current = window.setInterval(() => {
      setActivePhoto((current) => (current + 1) % customerPhotos.length);
    }, 6000);
    return () => window.clearInterval(timerRef.current);
  }, [customerPhotos.length, isPaused, isVisible, isReducedMotion]);

  useEffect(() => {
    if (reviews.length < 2 || !isMobile || isPaused || !isVisible || isReducedMotion) return;
    reviewTimerRef.current = window.setInterval(() => {
      setActiveReview((current) => (current + 1) % reviews.length);
    }, 5000);
    return () => window.clearInterval(reviewTimerRef.current);
  }, [isMobile, reviews.length, isPaused, isVisible, isReducedMotion]);

  function showReview(index: number) {
    if (reviews.length) setActiveReview((index + reviews.length) % reviews.length);
  }

  function showPhoto(index: number) {
    if (customerPhotos.length) setActivePhoto((index + customerPhotos.length) % customerPhotos.length);
  }

  const photoSwipe = useSwipeGesture((direction) => {
    if (customerPhotos.length) setActivePhoto((index) => (index + direction + customerPhotos.length) % customerPhotos.length);
  });
  const reviewSwipe = useSwipeGesture((direction) => {
    if (reviews.length) setActiveReview((index) => (index + direction + reviews.length) % reviews.length);
  });

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-gradient-to-b from-white to-ocean-50/70 px-4 py-8 sm:px-6 sm:py-11 lg:px-8">
      <div className="pointer-events-none absolute -left-24 top-16 h-56 w-56 rounded-full bg-sunrise/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-2">Good journeys. Great company.</p>
          <h2 className="font-display text-3xl font-bold text-ocean-950 sm:text-4xl">Happy Customers of Sri Rudra</h2>
          <p className="mx-auto mt-2 text-sm leading-6 text-slate-600">
            “Every journey becomes special when you travel with Sri Rudra.”
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ocean-100 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold text-slate-500">
            <Quote size={12} className="text-ocean-600" /> Customer experiences from trips with Sri Rudra
          </div>
        </div>

        <div className="mt-5 grid items-stretch gap-4 lg:grid-cols-[1fr_1.08fr] lg:gap-5">
          <div
            className="overflow-hidden rounded-[10px] bg-ocean-950 shadow-[0_20px_55px_rgba(15,61,68,0.18)]"
            onPointerEnter={() => setIsPaused(true)}
            onPointerLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
            }}
            aria-roledescription="carousel"
            aria-label="Customer photo carousel"
          >
            <div {...photoSwipe.handlers} className="relative touch-pan-y select-none overflow-hidden">
              <div
                className={`flex ${photoSwipe.offset === 0 ? 'transition-transform duration-500 ease-out motion-reduce:transition-none' : ''}`}
                style={{ transform: `translateX(calc(-${activePhoto * 100}% + ${photoSwipe.offset}px))` }}
              >
                {customerPhotos.length > 0 ? customerPhotos.map((photo, index) => (
                  <div key={photo.id} className="relative aspect-[16/10] w-full shrink-0 bg-gradient-to-br from-ocean-100 via-white to-sunrise/30">
                    {failedPhotos.includes(index) ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.95),rgba(223,241,237,0.9)_55%,rgba(15,89,96,0.14))] text-ocean-700">
                        <span className="grid h-16 w-16 place-items-center rounded-full border border-white bg-white/80 shadow-sm"><UserRound size={32} /></span>
                        <span className="mt-2 text-sm font-bold">Customer photo unavailable</span>
                        <span className="mt-1 text-xs text-slate-600">Please check the photo in Admin</span>
                      </div>
                    ) : (
                      <img
                        src={photo.src}
                        alt={photo.name}
                        className="pointer-events-none h-full w-full object-cover"
                        draggable={false}
                        loading={index === activePhoto ? 'eager' : 'lazy'}
                        onError={() => setFailedPhotos((current) => current.includes(index) ? current : [...current, index])}
                      />
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-ocean-950/75 to-transparent" />
                    <p className="pointer-events-none absolute bottom-4 left-5 text-sm font-semibold text-white">{photo.name}</p>
                  </div>
                )) : (
                  <div className="relative flex aspect-[16/10] w-full shrink-0 flex-col items-center justify-center bg-gradient-to-br from-ocean-100 via-white to-sunrise/30 text-ocean-700">
                    <span className="grid h-16 w-16 place-items-center rounded-full border border-white bg-white/80 shadow-sm"><UserRound size={32} /></span>
                    <span className="mt-2 text-sm font-bold">Customer photos coming soon</span>
                    <span className="mt-1 text-xs text-slate-600">Photos added in Admin will appear here</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-white">
              <span className="text-xs font-semibold text-white/70">Moments worth remembering</span>
              <div className="flex gap-2" aria-label={customerPhotos.length ? `Photo ${activePhoto + 1} of ${customerPhotos.length}` : 'No customer photos yet'}>
                {customerPhotos.map((photo, index) => (
                  <button key={photo.id} type="button" className={`h-2 rounded-full transition-all ${index === activePhoto ? 'w-7 bg-sunrise' : 'w-2 bg-white/35'}`} aria-label={`Show customer photo ${index + 1}`} aria-pressed={index === activePhoto} onClick={() => showPhoto(index)} />
                ))}
              </div>
            </div>
          </div>

          <div
            className="scrollbar-soft -mx-4 overflow-hidden px-4 pb-2 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0"
            onPointerEnter={() => setIsPaused(true)}
            onPointerLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
            }}
            aria-roledescription={isMobile ? 'carousel' : undefined}
            aria-label={isMobile ? 'Customer reviews' : undefined}
          >
            <div {...(isMobile ? reviewSwipe.handlers : {})} className="touch-pan-y select-none">
              <div
                className={`flex transition-transform duration-500 ease-out motion-reduce:transition-none sm:grid sm:w-auto sm:grid-cols-2 sm:gap-3 lg:grid-cols-1 ${reviewSwipe.offset !== 0 ? '!transition-none' : ''}`}
                style={isMobile && reviews.length ? { width: `${reviews.length * 100}%`, transform: `translateX(calc(-${activeReview * (100 / reviews.length)}% + ${reviewSwipe.offset}px))` } : undefined}
              >
                {reviews.map((review, index) => (
                  <article key={review.id} style={isMobile ? { width: `${100 / reviews.length}%` } : undefined} className={`relative flex shrink-0 flex-col justify-between overflow-hidden rounded-[10px] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-auto sm:min-w-0 ${index === 0 ? 'border-ocean-800 bg-ocean-900 text-white' : 'border-slate-100 bg-white text-slate-800'}`}>
                    <Quote size={34} className={`absolute right-4 top-4 ${index === 0 ? 'text-white/10' : 'text-ocean-100'}`} aria-hidden="true" />
                    <div>
                      <div className={`flex gap-1 ${index === 0 ? 'text-sunrise' : 'text-amber-500'}`} aria-label="5 out of 5 stars">
                        {Array.from({ length: 5 }, (_, star) => <Star key={star} size={13} fill="currentColor" />)}
                      </div>
                      <p className={`relative mt-2 max-w-xl text-sm leading-5 ${index === 0 ? 'text-white/90' : 'text-slate-600'}`}>“{review.text}”</p>
                    </div>
                    <div className={`mt-3 flex items-center justify-between border-t pt-2.5 ${index === 0 ? 'border-white/15' : 'border-slate-100'}`}>
                      <div className="flex items-center gap-2">
                        {review.image && <img src={review.image} alt="" className="h-9 w-9 rounded-full object-cover" loading="lazy" draggable={false} />}
                        <div>
                          <p className={`text-sm font-bold ${index === 0 ? 'text-white' : 'text-ocean-950'}`}>{review.name}</p>
                          <p className={`mt-0.5 text-xs ${index === 0 ? 'text-white/60' : 'text-slate-500'}`}>{review.trip}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wide ${index === 0 ? 'bg-white/10 text-white/75' : 'bg-ocean-50 text-ocean-700'}`}>Customer review</span>
                    </div>
                  </article>
                ))}
                {reviews.length === 0 && <p className="rounded-[10px] border border-slate-100 bg-white p-5 text-center text-sm text-slate-600">Customer reviews will appear here when published.</p>}
              </div>
            </div>
            <div className="mt-3 flex justify-center gap-2 sm:hidden" aria-label={`Review ${activeReview + 1} of ${reviews.length}`}>
              {reviews.map((review, index) => (
                <button
                  key={review.id}
                  type="button"
                  className={`h-2 rounded-full transition-all ${index === activeReview ? 'w-6 bg-ocean-700' : 'w-2 bg-ocean-200'}`}
                  aria-label={`Show review ${index + 1}`}
                  aria-pressed={index === activeReview}
                  onClick={() => showReview(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
