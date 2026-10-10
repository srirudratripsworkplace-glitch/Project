import { ArrowRight, Castle, Church, Landmark, Map, Mountain, Trees, Waves } from 'lucide-react';
import type { Destination, TripCategory } from '../data/destinations';

interface DestinationCarouselProps {
  categories: TripCategory[];
  destinations: Destination[];
  error: string;
  isLoading: boolean;
  onSelect: (destination: Destination) => void;
}

const icons = {
  castle: Castle,
  church: Church,
  landmark: Landmark,
  map: Map,
  mountain: Mountain,
  trees: Trees,
  waves: Waves,
};

export function DestinationCarousel({ categories, destinations, error, isLoading, onSelect }: DestinationCarouselProps) {
  return (
    <section id="destinations" className="overflow-hidden bg-white px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="section-inner">
        <div className="mb-5 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-2">Available Trips</p>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-normal text-ocean-900 sm:text-4xl">Explore destinations at a glance</h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-slate-600 sm:text-sm">
            Scroll horizontally, compare trip ideas quickly, and open any destination for a simple scan-friendly overview.
          </p>
        </div>

        {isLoading && <div className="rounded-[8px] bg-ocean-50 p-4 text-sm text-ocean-900">Loading available trips...</div>}
        {!isLoading && error && <div className="rounded-[8px] bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {!isLoading && !error && categories.length === 0 && (
          <div className="rounded-[8px] bg-ocean-50 p-4 text-sm text-ocean-900">No trips are published yet. Add categories and places from the admin page.</div>
        )}

        {!isLoading && !error && categories.length > 0 && (
          <div
            className="scrollbar-soft -mx-4 flex snap-x gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:mx-0 sm:gap-4 sm:px-0 lg:grid lg:grid-cols-5 lg:gap-3 lg:overflow-visible"
            aria-label="Scrollable trip category cards"
          >
            {categories.map((category) => {
              const categoryDestinations = destinations.filter((destination) => destination.categoryId === category.id);
              const Icon = icons[category.iconName as keyof typeof icons] ?? Map;
              const firstDestination = categoryDestinations[0];

              return (
                <article
                  key={category.id}
                  className="flex w-[76vw] max-w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-[8px] bg-stone-50 shadow-soft sm:w-[280px] lg:w-auto lg:max-w-none"
                >
                  <div className="flex min-h-[112px] flex-col items-center justify-center px-2.5 py-2 text-center text-white" style={{ backgroundColor: category.accentColor }}>
                    <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white/55 bg-white/8">
                      <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <h3 className="mt-1.5 font-display text-base font-bold leading-tight tracking-normal sm:text-lg">{category.title}</h3>
                    <p className="mt-1 text-[0.55rem] font-bold uppercase leading-tight tracking-[0.12em] text-white/90">{category.subtitle}</p>
                  </div>
                  {category.image && (
                    <img
                      src={category.image}
                      alt={category.title}
                      className="h-24 w-full object-cover"
                      loading="lazy"
                    />
                  )}

                  <div className="flex flex-1 flex-col gap-2 p-2.5">
                    <div className="space-y-1.5">
                      {categoryDestinations.map((destination) => (
                        <button
                          key={destination.id}
                          className="flex min-h-12 w-full items-center gap-2 rounded-[8px] bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                          onClick={() => onSelect(destination)}
                        >
                          {destination.image && <img src={destination.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" loading="lazy" />}
                          <span className="min-w-0 flex-1 text-xs font-bold leading-tight text-ocean-950">{destination.name}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-ocean-800" aria-hidden="true" />
                        </button>
                      ))}
                    </div>

                    <button
                      className="mt-auto inline-flex min-h-9 items-center justify-center gap-1 rounded-[8px] px-2 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ backgroundColor: category.accentColor }}
                      onClick={() => firstDestination && onSelect(firstDestination)}
                      disabled={!firstDestination}
                    >
                      Explore {category.tagline || category.title} <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
