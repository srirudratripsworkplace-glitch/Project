import { FormEvent, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { Destination } from '../data/destinations';
import { saveEnquiry } from '../lib/supabaseApi';
import { getTodayDate } from '../utils/enquiryForm';
import { getWhatsAppUrl, isValidPhoneNumber, type EnquiryPayload } from '../utils/whatsapp';
import { CountryPhoneField } from './CountryPhoneField';

interface EnquiryFormProps {
  destinations: Destination[];
  preferredDestination: string;
}

const initialForm: EnquiryPayload = {
  name: '',
  phone: '',
  email: '',
  destination: '',
  travellers: '2',
  travelDate: '',
  message: '',
};

export function EnquiryForm({ destinations, preferredDestination }: EnquiryFormProps) {
  const [form, setForm] = useState<EnquiryPayload>({ ...initialForm, destination: preferredDestination });
  const [countryCode, setCountryCode] = useState('+44');
  const [errors, setErrors] = useState<Partial<Record<keyof EnquiryPayload, string>>>({});
  const [submitStatus, setSubmitStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsAppFallbackUrl, setWhatsAppFallbackUrl] = useState('');
  const submissionLock = useRef(false);

  useEffect(() => {
    setForm((current) => ({ ...current, destination: preferredDestination || current.destination }));
  }, [preferredDestination]);

  function updateField(field: keyof EnquiryPayload, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const nextErrors: Partial<Record<keyof EnquiryPayload, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Please enter your name.';
    if (!isValidPhoneNumber(`${countryCode}${form.phone}`)) nextErrors.phone = 'Please enter a 10-digit mobile number.';
    if (!form.destination) nextErrors.destination = 'Please select a destination.';
    if (!Number.isInteger(Number(form.travellers)) || Number(form.travellers) < 1 || Number(form.travellers) > 6) nextErrors.travellers = 'Enter between 1 and 6 passengers.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current || !validate()) return;
    const enquiry = { ...form, phone: `${countryCode}${form.phone}` };
    const whatsAppUrl = getWhatsAppUrl(enquiry);
    const whatsAppWindow = window.open('about:blank', '_blank');
    submissionLock.current = true;
    setIsSubmitting(true);
    setSubmitStatus('');
    setWhatsAppFallbackUrl('');
    try {
      await saveEnquiry(enquiry);
      setSubmitStatus('Your enquiry has been submitted successfully! Review your message in WhatsApp and tap Send.');
      if (whatsAppWindow) {
        whatsAppWindow.opener = null;
        whatsAppWindow.location.href = whatsAppUrl;
      } else {
        setWhatsAppFallbackUrl(whatsAppUrl);
      }
    } catch (saveError) {
      whatsAppWindow?.close();
      setSubmitStatus(`We could not submit your enquiry. Please try again. ${saveError instanceof Error ? saveError.message : 'Unknown API error.'}`);
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section id="contact" className="bg-ocean-900 px-4 py-9 text-white sm:px-6 sm:py-14 lg:px-8">
      <div className="section-inner grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-24">
          <p className="eyebrow mb-2 text-sunrise">Contact & Enquiry</p>
          <h2 className="font-display text-3xl font-bold tracking-normal sm:text-4xl lg:text-5xl">Tell us where you want to go</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/78 sm:text-base sm:leading-7">
            Fill in your trip details and submit them to Srirudra Trips. Our team will contact you soon.
          </p>
        </div>

        <form className="compact-form rounded-[10px] bg-white p-3.5 text-slate-900 shadow-soft sm:p-5 lg:p-7" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-x-3 gap-y-3 min-[360px]:grid-cols-2 sm:gap-y-4">
            <Field label="Full Name" error={errors.name}>
              <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Your name" />
            </Field>
            <Field label="Phone Number" error={errors.phone} className="min-[360px]:col-span-2">
              <CountryPhoneField
                className="min-[360px]:max-w-xl"
                countryCode={countryCode}
                phoneNumber={form.phone}
                onCountryCodeChange={setCountryCode}
                onPhoneNumberChange={(value) => updateField('phone', value)}
                required
              />
            </Field>
            <Field label="Destination" error={errors.destination}>
              <select value={form.destination} onChange={(event) => updateField('destination', event.target.value)}>
                <option value="">Choose destination</option>
                {destinations.map((destination) => (
                  <option key={destination.id} value={destination.name}>
                    {destination.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Travellers" error={errors.travellers}>
              <input
                value={form.travellers}
                onChange={(event) => {
                  const count = Number(event.target.value);
                  if (count > 6) {
                    window.alert('A maximum of 6 passengers is allowed.');
                    updateField('travellers', '6');
                    return;
                  }
                  updateField('travellers', event.target.value);
                }}
                min="1"
                max="6"
                type="number"
                inputMode="numeric"
              />
            </Field>
          </div>
          <details className="mt-3 rounded-[8px] border border-slate-200 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-ocean-800">Add travel date, email, or a message <span className="font-normal text-slate-500">(optional)</span></summary>
            <div className="mt-3 grid gap-3 min-[390px]:grid-cols-2">
              <Field label="Preferred travel date">
                <input value={form.travelDate} onChange={(event) => updateField('travelDate', event.target.value)} type="date" min={getTodayDate()} />
              </Field>
              <Field label="Email">
                <input value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="you@example.com" type="email" />
              </Field>
              <Field label="Message" className="min-[390px]:col-span-2">
                <textarea
                  value={form.message}
                  onChange={(event) => updateField('message', event.target.value)}
                  placeholder="Tell us your preferred dates, destination, or any questions."
                  rows={2}
                />
              </Field>
            </div>
          </details>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <button className="btn-primary w-full justify-center sm:w-auto" type="submit" disabled={isSubmitting}>
              <Send size={18} aria-hidden="true" /> {isSubmitting ? 'Submitting enquiry...' : 'Send Enquiry'}
            </button>
          </div>
          {submitStatus && <p className="mt-4 text-sm font-semibold text-ocean-700" role="status">{submitStatus}</p>}
          {whatsAppFallbackUrl && (
            <a className="btn-outline mt-3 w-full justify-center sm:w-auto" href={whatsAppFallbackUrl} target="_blank" rel="noreferrer">
              Open WhatsApp to send your enquiry
            </a>
          )}
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  className = '',
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactElement;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {error && <span className="mt-2 block text-sm font-medium text-red-600">{error}</span>}
    </label>
  );
}
