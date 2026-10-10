import { ArrowDown, ArrowRight, Sparkles } from 'lucide-react';
import { businessConfig } from '../config/business';
import { WhatsAppIcon } from './WhatsAppIcon';

interface HeroProps {
  heroImage: string;
  mobileHeroImage: string;
}

export function Hero({ heroImage, mobileHeroImage }: HeroProps) {
  return (
    <section id="home" className="relative min-h-[54svh] overflow-hidden pt-16 text-white sm:min-h-[74vh] sm:pt-18 lg:min-h-[80vh]">
      <picture className="absolute inset-0">
        <source media="(max-width: 639px)" srcSet={mobileHeroImage} />
        <img
          src={heroImage}
          alt="Scenic landscapes for an inspiring trip"
          className="h-full w-full object-cover object-[62%_center] brightness-[0.78] saturate-[1.12] sm:object-center"
        />
      </picture>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,41,45,0.94)_0%,rgba(8,53,58,0.78)_42%,rgba(8,53,58,0.18)_100%)] max-[639px]:bg-[linear-gradient(180deg,rgba(5,35,40,0.58)_0%,rgba(5,35,40,0.38)_30%,rgba(5,35,40,0.84)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_35%,rgba(247,178,103,0.24),transparent_32%)] max-[639px]:bg-[radial-gradient(ellipse_at_50%_100%,rgba(247,178,103,0.16),transparent_58%)]" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-ocean-950/55 to-transparent" />
      <div className="relative mx-auto flex min-h-[calc(54svh-4rem)] max-w-7xl items-end px-4 pb-7 pt-6 sm:min-h-[calc(74vh-4.5rem)] sm:items-center sm:px-6 sm:py-12 lg:min-h-[calc(80vh-4.5rem)] lg:px-8 lg:py-16">
        <div className="max-w-3xl animate-fade-up sm:pb-0">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-ocean-950/30 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#ffe2a4] backdrop-blur sm:mb-4 sm:px-4 sm:py-2 sm:text-sm">
            <Sparkles size={13} aria-hidden="true" /> Srirudra Trips
          </p>
          <h1 className="max-w-[15ch] font-sans text-[2.05rem] font-extrabold leading-[1.03] tracking-[-0.055em] min-[390px]:text-[2.2rem] sm:max-w-3xl sm:font-display sm:text-6xl sm:font-bold sm:leading-[1.06] sm:tracking-normal lg:text-7xl">
            <span className="sm:hidden">Your next<br /><span className="text-[#ffe2a4]">great escape.</span></span>
            <span className="hidden sm:inline">Find your next beautiful escape</span>
          </h1>
          <p className="mt-2.5 max-w-[32rem] font-sans text-[0.88rem] font-normal leading-6 tracking-[0.015em] text-white/95 sm:mt-6 sm:font-display sm:text-lg sm:leading-8">
            Inspiring places, thoughtful trips, and friendly help planning every step.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[0.62rem] font-semibold text-white sm:mt-6 sm:gap-2.5 sm:text-sm">
            <span className="rounded-full border border-white/25 bg-white/12 px-2.5 py-1.5 backdrop-blur sm:px-3.5 sm:py-2">Curated places</span>
            <span className="rounded-full border border-white/25 bg-white/12 px-2.5 py-1.5 backdrop-blur sm:px-3.5 sm:py-2">Easy planning</span>
            <span className="hidden rounded-full border border-white/25 bg-white/12 px-3.5 py-2 backdrop-blur min-[430px]:inline-flex">Friendly support</span>
          </div>
          <div className="mt-4 grid max-w-[22rem] grid-cols-2 gap-2.5 sm:mt-9 sm:flex sm:max-w-none sm:gap-4">
            <a className="btn-light min-h-11 justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-extrabold tracking-wide shadow-lg shadow-ocean-950/20 transition hover:-translate-y-0.5 sm:min-h-12 sm:rounded-[8px] sm:px-5 sm:py-3 sm:text-sm" href="#destinations">
              Explore trips <span className="grid h-6 w-6 place-items-center rounded-full bg-ocean-100"><ArrowRight size={14} aria-hidden="true" /></span>
            </a>
            <a
              className="btn-glass min-h-11 justify-center gap-2 rounded-xl border-white/45 bg-ocean-950/35 px-3 py-2.5 text-xs font-extrabold tracking-wide shadow-lg shadow-ocean-950/15 transition hover:-translate-y-0.5 hover:bg-ocean-950/55 sm:min-h-12 sm:rounded-[8px] sm:px-5 sm:py-3 sm:text-sm"
              href={`https://wa.me/${businessConfig.whatsappNumber}?text=${encodeURIComponent('Hello Srirudra Trips, I would like to enquire about a trip.')}`}
              target="_blank"
              rel="noreferrer"
            >
              <WhatsAppIcon size={17} /> WhatsApp us
            </a>
          </div>
          <a href="#special-trips" className="mt-4 inline-flex items-center gap-1.5 text-[0.65rem] font-semibold text-white/75 sm:hidden">
            Discover more <ArrowDown size={13} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
