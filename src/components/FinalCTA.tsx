import { ArrowRight } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="bg-white px-4 py-9 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[8px] bg-[linear-gradient(135deg,#0b5960,#123f35)] px-5 py-9 text-center text-white shadow-soft sm:px-10 sm:py-12">
        <h2 className="font-display text-3xl font-bold tracking-normal sm:text-5xl">Ready to Start Your Journey?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:mt-4 sm:text-base sm:leading-7">
          Explore our destinations and get in touch with Srirudra Trips today.
        </p>
        <a className="btn-light mt-5 min-h-11 justify-center px-5 py-2.5 sm:mt-7" href="#contact">
          Plan Your Trip <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
