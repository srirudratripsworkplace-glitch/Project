import { Compass, Handshake, HeartHandshake, MessagesSquare } from 'lucide-react';

const features = [
  {
    title: 'Carefully Planned Trips',
    description: 'Destination details are organized clearly so customers can choose with confidence.',
    icon: Compass,
  },
  {
    title: 'Memorable Experiences',
    description: 'Trips can be shaped around scenic places, local moments, and comfortable pacing.',
    icon: HeartHandshake,
  },
  {
    title: 'Customer-Friendly Service',
    description: 'Simple enquiry flow and responsive support help customers move from idea to plan.',
    icon: Handshake,
  },
  {
    title: 'Easy Enquiry & Support',
    description: 'Customers can send complete trip details directly through WhatsApp in one step.',
    icon: MessagesSquare,
  },
];

export function WhyChooseUs() {
  return (
    <section className="bg-stone-50 px-4 py-9 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
      <div className="section-inner">
        <div className="max-w-2xl">
          <p className="eyebrow mb-2">Why Choose Us</p>
          <h2 className="font-display text-3xl font-bold leading-tight text-ocean-900 sm:text-4xl">A clear, comfortable way to plan your next trip</h2>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-7 sm:gap-4 lg:grid-cols-4">
          {features.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-[8px] border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-1 hover:shadow-soft sm:p-5">
              <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-ocean-50 text-ocean-700 sm:h-11 sm:w-11">
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-bold leading-snug text-ocean-900 sm:mt-4 sm:text-base">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
