import { FormEvent, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Clock3, MapPin, Sparkles, Users, X } from 'lucide-react';
import type { SpecialTrip } from '../data/destinations';
import { saveEnquiry } from '../lib/supabaseApi';
import { formatPoundPrice } from '../utils/currency';
import { getTodayDate } from '../utils/enquiryForm';
import { getWhatsAppUrl, isValidPhoneNumber } from '../utils/whatsapp';
import { CountryPhoneField } from './CountryPhoneField';

interface SpecialTripsProps {
  trips: SpecialTrip[];
  error: string;
}

export function SpecialTrips({ trips, error }: SpecialTripsProps) {
  const [selectedTrip, setSelectedTrip] = useState<SpecialTrip | null>(null);
  const [countryCode, setCountryCode] = useState('+44');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [whatsAppFallbackUrl, setWhatsAppFallbackUrl] = useState('');
  const submissionLock = useRef(false);

  if (trips.length === 0 && !error) return null;

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTrip || submissionLock.current) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const phone = `${countryCode}${phoneNumber}`;
    const travelDate = String(formData.get('travelDate') || '');
    const travellers = String(formData.get('travellers') || '');
    const message = String(formData.get('message') || '').trim();
    if (!isValidPhoneNumber(phone)) {
      setStatus('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!Number.isInteger(Number(travellers)) || Number(travellers) < 1 || Number(travellers) > 6) {
      setStatus('Enter between 1 and 6 passengers.');
      return;
    }

    const enquiry = {
      name,
      phone,
      email: '',
      destination: selectedTrip.title,
      travellers,
      travelDate: travelDate || selectedTrip.tripDate,
      message: `Special Trip Enquiry: ${selectedTrip.title}${message ? `\n${message}` : ''}`,
    };
    const whatsAppUrl = getWhatsAppUrl({
      type: 'special-trip',
      trip: selectedTrip.title,
      name,
      phone,
      travelDate: travelDate || selectedTrip.tripDate,
      travellers,
      message,
    });
    const whatsAppWindow = window.open('about:blank', '_blank');
    submissionLock.current = true;
    setIsSaving(true);
    setStatus('');
    setWhatsAppFallbackUrl('');
    try {
      await saveEnquiry(enquiry);
      setStatus('Your enquiry has been submitted successfully! Review your message in WhatsApp and tap Send.');
      if (whatsAppWindow) {
        whatsAppWindow.opener = null;
        whatsAppWindow.location.href = whatsAppUrl;
      } else {
        setWhatsAppFallbackUrl(whatsAppUrl);
      }
    } catch (saveError) {
      whatsAppWindow?.close();
      setStatus(`We could not submit your enquiry. Please try again. ${saveError instanceof Error ? saveError.message : 'Unknown API error.'}`);
    } finally {
      submissionLock.current = false;
      setIsSaving(false);
    }
  }

  return (
    <>
      <section id="special-trips" className="relative isolate overflow-hidden bg-gradient-to-br from-[#24132f] via-[#482540] to-[#753b4c] px-4 py-8 text-white sm:px-6 sm:py-12 lg:px-8">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#f3c978]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-[#d77a83]/15 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-5 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ffe7b0]/60 bg-gradient-to-br from-[#ffe7b0] to-[#e4ad57] text-[#482540] shadow-lg shadow-black/20 sm:h-12 sm:w-12">
                <Sparkles size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f6d58f]">Limited-time experiences</p>
                <h2 className="mt-1 font-display text-2xl font-bold sm:text-4xl">Special Trips</h2>
              </div>
            </div>
            <p className="max-w-lg text-sm leading-6 text-white/75">A little more memorable, a little less ordinary. Find your next seasonal escape.</p>
          </div>
          {error ? (
            <p className="rounded-[8px] border border-white/15 bg-white/10 p-4 text-sm">{error}</p>
          ) : (
            <div className="scrollbar-soft -mx-4 flex snap-x gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0 xl:grid-cols-3">
              {trips.map((trip) => (
                <article key={trip.id} className="group w-[86vw] max-w-[350px] shrink-0 snap-start overflow-hidden rounded-[10px] border border-[#f1dfc2] bg-[#fffaf2] text-slate-900 shadow-[0_18px_45px_rgba(25,9,29,0.28)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(25,9,29,0.38)] lg:w-auto lg:max-w-none">
                  <div className="relative h-44 bg-gradient-to-br from-[#8c5b77] to-[#352039] sm:h-52">
                    {trip.image && (
                      <img
                        src={trip.image}
                        alt={trip.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/35" />
                    {trip.badge && <span className="absolute left-4 top-4 rounded-full border border-white/60 bg-gradient-to-r from-[#ffe7b0] to-[#e4ad57] px-3 py-1.5 text-[0.68rem] font-extrabold uppercase tracking-wide text-[#482540] shadow">{trip.badge}</span>}
                    {trip.tripDate && <DateBadge date={trip.tripDate} />}
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:p-5">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-white"><MapPin size={14} />{trip.fromLocation ? `${trip.fromLocation} to ` : ''}{trip.destination}</p>
                      <h3 className="mt-1 font-display text-2xl font-bold leading-tight text-white">{trip.title}</h3>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    {trip.description && <p className="line-clamp-2 text-sm font-medium leading-6 text-slate-700">{trip.description}</p>}
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800">
                      {trip.tripDate && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0dce6] px-2.5 py-1.5 text-[#51263d]"><CalendarDays size={14} />{formatDate(trip.tripDate)}</span>}
                      {trip.tripTime && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#efe2ca] px-2.5 py-1.5 text-[#49351f]"><Clock3 size={14} />{formatTime(trip.tripTime)}</span>}
                      {trip.seats !== null && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#efe2ca] px-2.5 py-1.5 text-[#49351f]"><Users size={14} />{trip.seats} seats</span>}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eadfce] pt-4">
                      <div>
                        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-700">{trip.price ? 'Trip price' : 'Ask us for details'}</p>
                        {trip.price && <p className="mt-0.5 text-lg font-extrabold text-[#63384e]">{formatPrice(trip.price)}</p>}
                      </div>
                      <button className="btn-primary min-h-11 justify-center bg-[#63384e] px-4 py-2.5 text-xs text-white shadow-md shadow-[#63384e]/20 hover:bg-[#49273a] focus:ring-[#e8d5df] sm:text-sm" onClick={() => { setSelectedTrip(trip); setCountryCode('+44'); setPhoneNumber(''); setStatus(''); }}>
                        Enquire <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedTrip && (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/70 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedTrip(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="special-trip-enquiry-title" className="my-auto w-full max-w-lg rounded-[8px] bg-white p-5 text-slate-900 shadow-soft sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Special Trip Enquiry</p>
                <h2 id="special-trip-enquiry-title" className="font-display text-2xl font-bold text-ocean-950">{selectedTrip.title}</h2>
              </div>
              <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200" aria-label="Close enquiry form" onClick={() => setSelectedTrip(null)}>
                <X size={20} />
              </button>
            </div>
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitEnquiry}>
              <label className="text-sm font-semibold">Customer name<input className="mt-1" name="name" required autoComplete="name" /></label>
              <label className="text-sm font-semibold sm:col-span-2">Mobile number<CountryPhoneField className="mt-1" countryCode={countryCode} phoneNumber={phoneNumber} onCountryCodeChange={setCountryCode} onPhoneNumberChange={setPhoneNumber} required /></label>
              <label className="text-sm font-semibold">Travel date<input className="mt-1" name="travelDate" type="date" min={getTodayDate()} defaultValue={selectedTrip.tripDate >= getTodayDate() ? selectedTrip.tripDate : ''} /></label>
              <label className="text-sm font-semibold">Passengers<input className="mt-1" name="travellers" type="number" min="1" max="6" step="1" defaultValue="1" onChange={(event) => {
                if (Number(event.target.value) > 6) {
                  window.alert('A maximum of 6 passengers is allowed.');
                  event.target.value = '6';
                }
              }} required /></label>
              <label className="text-sm font-semibold sm:col-span-2">Message<textarea className="mt-1" name="message" rows={3} /></label>
              {status && <p className="text-sm font-semibold text-ocean-800 sm:col-span-2" role="status">{status}</p>}
              {whatsAppFallbackUrl && (
                <a className="btn-outline justify-center sm:col-span-2" href={whatsAppFallbackUrl} target="_blank" rel="noreferrer">
                  Open WhatsApp to send your enquiry
                </a>
              )}
              <button className="btn-primary justify-center sm:col-span-2" type="submit" disabled={isSaving}>
                {isSaving ? 'Submitting enquiry...' : 'Send enquiry'} <ArrowRight size={17} />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function formatPrice(value: string) {
  return formatPoundPrice(value);
}

function DateBadge({ date }: { date: string }) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return (
    <span className="absolute right-4 top-4 grid min-w-[58px] place-items-center rounded-[8px] border border-[#f6d58f] bg-[#fffaf2]/95 px-2 py-2 text-center text-[#482540] shadow-lg backdrop-blur">
      <span className="text-[0.6rem] font-extrabold uppercase tracking-widest text-[#8a5d47]">{parsed.toLocaleDateString('en-IN', { month: 'short' })}</span>
      <span className="font-display text-2xl font-bold leading-none">{parsed.getDate()}</span>
      <span className="mt-0.5 text-[0.6rem] font-bold">{parsed.getFullYear()}</span>
    </span>
  );
}
