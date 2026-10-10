import { FormEvent, useRef, useState } from 'react';
import { ArrowRight, Check, Clock3, Luggage, MapPin, PlaneTakeoff, ShieldCheck } from 'lucide-react';
import { saveEnquiry } from '../lib/supabaseApi';
import { getTodayDate } from '../utils/enquiryForm';
import { getWhatsAppUrl, isValidPhoneNumber } from '../utils/whatsapp';
import { CountryPhoneField } from './CountryPhoneField';

const airportDirections = ['Airport → Destination', 'Destination → Airport'] as const;
const airports = ['Heathrow Airport', 'Gatwick Airport', 'Stansted Airport', 'Luton Airport', 'London City Airport'];

export function AirportTravel() {
  const [travelType, setTravelType] = useState<(typeof airportDirections)[number]>(airportDirections[0]);
  const [selectedAirport, setSelectedAirport] = useState(airports[0]);
  const [countryCode, setCountryCode] = useState('+44');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [whatsAppFallbackUrl, setWhatsAppFallbackUrl] = useState('');
  const submissionLock = useRef(false);

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;

    const formData = new FormData(event.currentTarget);
    const airport = String(formData.get('airport') || '').trim();
    const location = String(formData.get('location') || '').trim();
    const travelDate = String(formData.get('travelDate') || '');
    const pickupTime = String(formData.get('pickupTime') || '');
    const passengers = String(formData.get('passengers') || '');
    const name = String(formData.get('name') || '').trim();
    const phoneNumber = String(formData.get('phoneNumber') || '').trim();
    const countryCode = String(formData.get('countryCode') || '+44');
    const phone = `${countryCode}${phoneNumber}`;
    const message = String(formData.get('message') || '').trim();
    if (!isValidPhoneNumber(phone)) {
      setStatus('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!Number.isInteger(Number(passengers)) || Number(passengers) < 1 || Number(passengers) > 6) {
      setStatus('Enter between 1 and 6 passengers.');
      return;
    }

    const pickup = travelType === airportDirections[0] ? airport : location;
    const drop = travelType === airportDirections[0] ? location : airport;
    const route = travelType === airportDirections[0] ? `${airport} to ${location}` : `${location} to ${airport}`;
    const enquiry = {
      name,
      phone,
      email: '',
      destination: `Airport Travel (${travelType}): ${route}`,
      travellers: passengers,
      travelDate,
      message: `Airport Travel Enquiry\nAirport: ${airport}\nPickup: ${pickup}\nDrop: ${drop}\nPickup time: ${pickupTime || 'Not specified'}${message ? `\n${message}` : ''}`,
    };
    const whatsAppUrl = getWhatsAppUrl({
      type: 'airport-travel',
      travelType,
      airport,
      pickup,
      drop,
      travelDate,
      pickupTime,
      passengers,
      name,
      phone,
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
    <section id="airport-travel" className="bg-ocean-50 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-6">
        <div className="relative overflow-hidden rounded-[10px] bg-gradient-to-br from-ocean-950 via-ocean-800 to-[#137879] p-4 text-white shadow-soft sm:p-5">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10" />
          <div className="absolute -right-5 -top-5 h-36 w-36 rounded-full border border-white/10" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/20"><PlaneTakeoff size={20} /></span>
              <div>
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-sunrise">A smoother start and finish</p>
                <h2 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Airport Travel</h2>
              </div>
            </div>
            <p className="mt-2 hidden max-w-md text-sm leading-5 text-white/75 sm:block">
              Land, relax, and let us take care of the road. Request a private transfer to your destination or back to the airport.
            </p>

            <div className="mt-4 hidden rounded-[8px] border border-white/15 bg-white/[0.07] p-3 sm:block">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/60">Your route</p>
              <div className="mt-3 grid grid-cols-[32px_1fr] gap-x-3">
                <div className="flex flex-col items-center">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-sunrise text-ocean-950"><PlaneTakeoff size={14} /></span>
                  <span className="my-1 h-4 border-l border-dashed border-white/40" />
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-white" />
                </div>
                <div className="flex flex-col justify-between pb-0.5">
                  <span>
                    <span className="block text-[0.62rem] font-bold uppercase tracking-wider text-white/55">{travelType === airportDirections[0] ? 'Airport pickup' : 'To airport'}</span>
                    <span className="mt-0.5 block text-sm font-bold">{selectedAirport}</span>
                  </span>
                  <span className="mt-3">
                    <span className="block text-[0.62rem] font-bold uppercase tracking-wider text-white/55">{travelType === airportDirections[0] ? 'Your destination' : 'Your pickup'}</span>
                    <span className="mt-0.5 block text-sm font-bold">Your chosen location</span>
                  </span>
                </div>
              </div>
            </div>

            <ul className="mt-3 grid grid-cols-3 gap-1.5 text-[0.58rem] font-semibold leading-tight text-white/85 sm:mt-4 sm:gap-2 sm:text-[0.68rem] lg:grid-cols-1 xl:grid-cols-3">
              <li className="flex items-center justify-center gap-1 rounded-full bg-white/10 px-1.5 py-1.5 sm:justify-start sm:gap-2 sm:bg-transparent sm:px-0 sm:py-0"><Check size={13} className="shrink-0 text-sunrise" />Easy pickup</li>
              <li className="flex items-center justify-center gap-1 rounded-full bg-white/10 px-1.5 py-1.5 sm:justify-start sm:gap-2 sm:bg-transparent sm:px-0 sm:py-0"><ShieldCheck size={13} className="shrink-0 text-sunrise" />Direct support</li>
              <li className="flex items-center justify-center gap-1 rounded-full bg-white/10 px-1.5 py-1.5 sm:justify-start sm:gap-2 sm:bg-transparent sm:px-0 sm:py-0"><Luggage size={13} className="shrink-0 text-sunrise" />Luggage space</li>
            </ul>
          </div>
        </div>

        <form className="compact-form rounded-[10px] border border-white bg-white p-3.5 shadow-[0_18px_50px_rgba(15,61,68,0.1)] sm:p-4" onSubmit={submitEnquiry}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow mb-1">Plan your transfer</p>
              <h3 className="font-display text-xl font-bold text-ocean-950">Where can we take you?</h3>
            </div>
            <p className="text-xs font-medium text-slate-500">Quick enquiry · No obligation</p>
          </div>

          <fieldset className="mt-3">
            <legend className="mb-1 text-xs font-bold text-slate-800">Choose your direction</legend>
            <div className="grid grid-cols-2 rounded-[8px] bg-stone-100 p-1">
              {airportDirections.map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-pressed={travelType === direction}
                  className={`min-h-9 rounded-[6px] px-2 py-1.5 text-[0.68rem] font-bold transition sm:text-sm ${travelType === direction ? 'bg-white text-ocean-900 shadow-sm' : 'text-slate-600 hover:text-ocean-800'}`}
                  onClick={() => setTravelType(direction)}
                >
                  {direction}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-2 min-[360px]:grid-cols-2 md:grid-cols-3">
            <Field label="Airport">
              <select name="airport" value={selectedAirport} onChange={(event) => setSelectedAirport(event.target.value)} required>
                {airports.map((airport) => <option key={airport} value={airport}>{airport}</option>)}
              </select>
            </Field>
            <Field label={travelType === airportDirections[0] ? 'Drop destination' : 'Pickup location'}>
              <input
                className="min-w-0"
                name="location"
                placeholder={travelType === airportDirections[0] ? 'City or address' : 'Pickup area'}
                required
              />
            </Field>
            <Field label="Passengers">
              <input name="passengers" type="number" min="1" max="6" step="1" defaultValue="1" onChange={(event) => {
                if (Number(event.target.value) > 6) {
                  window.alert('A maximum of 6 passengers is allowed.');
                  event.target.value = '6';
                }
              }} required />
            </Field>
            <Field label="Your name">
              <input name="name" autoComplete="name" placeholder="Full name" required />
            </Field>
            <Field label="Mobile number">
              <CountryPhoneField
                className="min-[360px]:col-span-2 md:col-span-1"
                countryCode={countryCode}
                phoneNumber={phoneNumber}
                onCountryCodeChange={setCountryCode}
                onPhoneNumberChange={setPhoneNumber}
                required
              />
            </Field>
          </div>
          <details className="mt-3 rounded-[8px] border border-slate-200 px-3 py-2">
            <summary className="cursor-pointer text-xs font-bold text-ocean-800">Add date, pickup time, or a message <span className="font-normal text-slate-500">(optional)</span></summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Travel date">
                <input name="travelDate" type="date" min={getTodayDate()} />
              </Field>
              <Field label="Pickup time">
                <span className="relative block">
                  <Clock3 size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="pl-10" name="pickupTime" type="time" />
                </span>
              </Field>
              <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
                Message <span className="font-normal text-slate-500">(optional)</span>
                <textarea className="mt-1" name="message" rows={2} placeholder="Luggage, flight details, or anything we should know" />
              </label>
            </div>
          </details>
          {status && <p className="mt-4 text-sm font-semibold text-ocean-800" role="status">{status}</p>}
          {whatsAppFallbackUrl && (
            <a className="btn-outline mt-3 w-full justify-center" href={whatsAppFallbackUrl} target="_blank" rel="noreferrer">
              Open WhatsApp to send your enquiry
            </a>
          )}
          <button className="btn-primary mt-3 min-h-10 w-full justify-center py-2" type="submit" disabled={isSaving}>
            {isSaving ? 'Submitting enquiry...' : 'Request airport transfer'} <ArrowRight size={17} />
          </button>
          <p className="mt-2 text-center text-[0.7rem] leading-4 text-slate-500">Submit your details and our team will contact you shortly.</p>
        </form>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <label className="block text-xs font-semibold text-slate-800 sm:text-sm">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
