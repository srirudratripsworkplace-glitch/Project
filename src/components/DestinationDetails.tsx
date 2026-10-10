import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, MapPin, X } from 'lucide-react';
import { businessConfig } from '../config/business';
import type { Destination } from '../data/destinations';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { WhatsAppIcon } from './WhatsAppIcon';

interface DestinationDetailsProps {
  destination: Destination | null;
  categoryImage?: string;
  fallbackImage?: string;
  onClose: () => void;
  onEnquire: (destinationName: string) => void;
}

export function DestinationDetails({ destination, categoryImage, fallbackImage, onClose, onEnquire }: DestinationDetailsProps) {
  if (!destination) return null;

  const destinationImages = destination.images?.length ? destination.images : [destination.image].filter(Boolean);
  const secondImage = categoryImage && categoryImage !== destinationImages[0] ? categoryImage : fallbackImage;
  const galleryImages = [...destinationImages, ...(secondImage && !destinationImages.includes(secondImage) ? [secondImage] : [])];
  const quickMessage = encodeURIComponent(`Hello Srirudra Trips, I would like to enquire about ${destination.name}.`);

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-ocean-900/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto my-2 max-w-5xl overflow-hidden rounded-[8px] bg-white shadow-2xl sm:my-6">
        <div className="relative h-56 sm:h-96">
          <img src={destination.image} alt={`${destination.name} overview`} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ocean-900/80 to-transparent" />
          <button
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/92 text-ocean-900 shadow"
            onClick={onClose}
            aria-label="Close destination details"
          >
            <X size={22} />
          </button>
          <div className="absolute bottom-4 left-4 right-4 text-white sm:bottom-6 sm:left-6 sm:right-6">
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur">
              <MapPin size={15} aria-hidden="true" /> Destination details
            </p>
            <h2 className="font-display text-3xl font-bold tracking-normal sm:text-5xl">{destination.name}</h2>
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:gap-8 sm:p-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            {galleryImages.length > 1 && (
              <DestinationGallery key={destination.id} name={destination.name} images={galleryImages} />
            )}
            <h3 className="text-xl font-bold text-ocean-900">Overview</h3>
            <p className="mt-2 text-sm leading-6 text-slate-650 sm:mt-3 sm:text-base sm:leading-7">{destination.overview}</p>

            <div className="mt-5 grid gap-4 sm:mt-7 sm:grid-cols-2 sm:gap-6">
              <div>
                <h4 className="font-semibold text-slate-900">Places to visit</h4>
                <ul className="mt-3 space-y-2">
                  {destination.placesToVisit.map((place, index) => (
                    <li key={`${destination.id}-place-${index}`} className="flex gap-2 text-sm text-slate-650">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ocean-600" /> {place}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Trip highlights</h4>
                <ul className="mt-3 space-y-2">
                  {destination.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2 text-sm text-slate-650">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ocean-600" /> {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-5 rounded-[8px] bg-ocean-50 p-3 text-sm leading-6 text-ocean-900 sm:mt-7 sm:p-4">{destination.extraInfo}</p>
          </div>

          <aside className="rounded-[8px] border border-slate-200 bg-stone-50 p-4 sm:p-5">
            <div className="flex items-center gap-3 text-ocean-900">
              <CalendarDays aria-hidden="true" />
              <div>
                <p className="text-sm text-slate-500">Duration</p>
                <p className="font-semibold">{destination.duration}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              <button className="btn-primary justify-center" onClick={() => onEnquire(destination.name)}>
                Enquire Now
              </button>
              <a
                className="btn-outline justify-center"
                href={`https://wa.me/${businessConfig.whatsappNumber}?text=${quickMessage}`}
                target="_blank"
                rel="noreferrer"
              >
                <WhatsAppIcon size={18} /> WhatsApp
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function DestinationGallery({ name, images }: { name: string; images: string[] }) {
  const [activeImage, setActiveImage] = useState(0);
  const swipe = useSwipeGesture((direction) => {
    setActiveImage((index) => (index + direction + images.length) % images.length);
  });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setActiveImage((current) => (current + 1) % images.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [images.length]);

  return (
    <section aria-label={`${name} photos`} className="mb-6 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl font-bold text-ocean-900">A closer look</h3>
        <span className="text-xs font-semibold text-slate-500">{activeImage + 1} / {images.length}</span>
      </div>
      <div className="relative mt-3 overflow-hidden rounded-[8px] bg-slate-100">
        <div
          {...swipe.handlers}
          className={`flex touch-pan-y select-none ${swipe.offset === 0 ? 'transition-transform duration-700 ease-in-out motion-reduce:transition-none' : ''}`}
          style={{ transform: `translateX(calc(-${activeImage * 100}% + ${swipe.offset}px))` }}
          aria-live="polite"
        >
          {images.map((image, index) => (
            <img
              key={`${name}-photo-${index}`}
              src={image}
              alt={`${name} photo ${index + 1}`}
              className="pointer-events-none h-44 w-full shrink-0 object-cover sm:h-64"
              draggable={false}
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-2" aria-label="Choose a photo">
        {images.map((image, index) => (
          <button
            key={`${name}-photo-indicator-${index}`}
            type="button"
            className={`h-2.5 rounded-full transition-all ${activeImage === index ? 'w-6 bg-ocean-700' : 'w-2.5 bg-slate-300 hover:bg-slate-400'}`}
            aria-label={`Show photo ${index + 1}`}
            aria-pressed={activeImage === index}
            onClick={() => setActiveImage(index)}
          />
        ))}
      </div>
    </section>
  );
}
