import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import logo from '../image.jpeg';

const navItems = [
  { label: 'Home', href: '#home' },
  { label: 'Destinations', href: '#destinations' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
  { label: 'Admin', href: '/admin' },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white shadow-md">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:h-18 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <a href="#home" className="flex items-center gap-2 font-bold text-ocean-950 sm:gap-3" onClick={() => setIsOpen(false)}>
          <img src={logo} alt="Sri Rudra Trips logo" className="h-9 w-9 rounded-xl bg-white object-contain shadow-sm ring-2 ring-ocean-100 sm:h-12 sm:w-12" />
          <span className="text-sm tracking-normal sm:text-lg">Sri Rudra Trips</span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-bold text-slate-800 transition hover:text-ocean-700">
              {item.label}
            </a>
          ))}
          <a className="btn-primary" href="#contact">
            Enquire Now
          </a>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-ocean-900 transition hover:bg-ocean-50 sm:h-11 sm:w-11 md:hidden"
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          aria-label="Toggle navigation menu"
        >
          {isOpen ? <X size={20} className="sm:h-[22px] sm:w-[22px]" /> : <Menu size={20} className="sm:h-[22px] sm:w-[22px]" />}
        </button>
      </nav>

      {isOpen && (
        <div className="animate-menu-down border-t border-slate-100 bg-white px-4 py-4 shadow-soft md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-3.5 text-base font-medium text-slate-700 hover:bg-ocean-50 hover:text-ocean-700"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <a className="btn-primary mt-2 justify-center" href="#contact" onClick={() => setIsOpen(false)}>
              Enquire Now
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
