import { businessConfig } from '../config/business';
import { WhatsAppIcon } from './WhatsAppIcon';
import { createPortal } from 'react-dom';

export function WhatsAppButton() {
  const message = encodeURIComponent('Hello Srirudra Trips, I would like to enquire about a trip.');

  return createPortal(
    <a
      href={`https://wa.me/${businessConfig.whatsappNumber}?text=${message}`}
      className="whatsapp-mobile-bounce fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[71] inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-[#16a34a] px-4 text-white ring-4 ring-white shadow-[0_14px_35px_rgba(5,41,45,0.4)] transition hover:-translate-y-1 hover:bg-[#15803d] focus:outline-none focus:ring-green-200 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16 sm:px-0"
      target="_blank"
      rel="noreferrer"
      aria-label="Enquire on WhatsApp"
    >
      <WhatsAppIcon size={25} />
      <span className="text-xs font-bold sm:hidden">Chat with us</span>
    </a>,
    document.body,
  );
}
