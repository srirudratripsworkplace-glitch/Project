import { Compass, MapPinned, MessageCircle } from 'lucide-react';
import { siteImages } from '../data/siteContent';

export function About() {
  return (
    <section id="about" className="bg-white px-4 py-7 sm:px-6 sm:py-11 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 sm:gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10">
        <div className="relative overflow-hidden rounded-[10px] shadow-soft">
          <img
            src={siteImages.about}
            alt="Road trip through a scenic mountain route"
            className="aspect-[16/8] h-full w-full object-cover sm:aspect-[16/10]"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ocean-950/80 to-transparent px-5 pb-5 pt-12 text-white">
            <p className="font-display text-lg font-bold sm:text-xl">Make the journey yours</p>
            <p className="mt-1 hidden text-sm text-white/80 min-[430px]:block">Discover a place, then plan your way there.</p>
          </div>
        </div>
        <div>
          <p className="eyebrow mb-1.5 text-xs sm:mb-2 sm:text-sm">About Sri Rudra Trips</p>
          <h2 className="font-display text-2xl font-bold leading-tight text-ocean-950 sm:text-4xl">Travel packages and easy holiday planning for your next getaway</h2>
          <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600 sm:mt-3 sm:text-base sm:leading-6">
            Based in East London, Sri Rudra Trips shares UK sightseeing trips, holiday experiences and airport travel options. Whether you search for Srirudra Trips or Sri Rudra tours and travel, browse journeys from the UK to Bath, Cornwall, Wales and Scotland, then enquire directly.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="flex flex-col items-center gap-1.5 rounded-[8px] border border-ocean-100 bg-ocean-50/70 p-2 text-center sm:flex-row sm:gap-3 sm:p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ocean-700 shadow-sm sm:h-9 sm:w-9"><Compass size={17} /></span>
              <span className="text-[0.65rem] font-semibold leading-tight text-ocean-950 sm:text-sm">Explore places</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-[8px] border border-ocean-100 bg-ocean-50/70 p-2 text-center sm:flex-row sm:gap-3 sm:p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ocean-700 shadow-sm sm:h-9 sm:w-9"><MapPinned size={17} /></span>
              <span className="text-[0.65rem] font-semibold leading-tight text-ocean-950 sm:text-sm">Trip highlights</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-[8px] border border-ocean-100 bg-ocean-50/70 p-2 text-center sm:flex-row sm:gap-3 sm:p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ocean-700 shadow-sm sm:h-9 sm:w-9"><MessageCircle size={17} /></span>
              <span className="text-[0.65rem] font-semibold leading-tight text-ocean-950 sm:text-sm">Enquire directly</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
