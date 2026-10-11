import { Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { businessConfig } from '../config/business';
import { WhatsAppIcon } from './WhatsAppIcon';

const links = [
  { label: 'Home', href: '#home' },
  { label: 'Destinations', href: '#destinations' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

export function Footer() {
  return (
    <footer className="bg-ocean-950 bg-ocean-900 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_0.8fr_1fr]">
        <div>
          <h2 className="text-2xl font-bold">Sri Rudra Trips</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
            Travel information, destination discovery, and easy enquiry support for memorable journeys.
          </p>
          <div className="mt-5 flex gap-3">
            <a
              className="footer-icon"
              href="https://www.instagram.com/srirudra_trips?rpxt=MXI0MzZ2c2p0ZW00eg=="
              target="_blank"
              rel="noreferrer"
              aria-label="Sri Rudra Trips on Instagram"
            >
              <Instagram size={18} />
            </a>
            <a className="footer-icon" href={`mailto:${businessConfig.email}`} aria-label={`Email Sri Rudra Trips at ${businessConfig.email}`}>
              <Mail size={18} />
            </a>
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Links</h3>
          <div className="mt-4 grid gap-2">
            {links.map((link) => (
              <a key={link.href} className="text-sm text-white/70 transition hover:text-white" href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Contact</h3>
          <div className="mt-4 grid gap-3 text-sm text-white/70">
            <a className="flex items-center gap-2 transition hover:text-white" href={`tel:${businessConfig.phone.replace(/\s/g, '')}`}>
              <Phone size={16} /> {businessConfig.phone}
            </a>
            <a
              className="flex items-center gap-2 transition hover:text-white"
              href={`https://wa.me/${businessConfig.whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
            >
              <WhatsAppIcon size={16} /> {businessConfig.phone}
            </a>
            <a className="flex items-center gap-2 transition hover:text-white" href={`mailto:${businessConfig.email}`}>
              <Mail size={16} /> {businessConfig.email}
            </a>
            <span className="flex items-center gap-2">
              <MapPin size={16} /> {businessConfig.location}
            </span>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-6 text-sm text-white/55">
        Copyright {new Date().getFullYear()} Sri Rudra Trips. All rights reserved.
      </div>
    </footer>
  );
}
