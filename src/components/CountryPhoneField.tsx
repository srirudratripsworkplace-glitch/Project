interface CountryPhoneFieldProps {
  countryCode: string;
  phoneNumber: string;
  onCountryCodeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
  className?: string;
}

const countryCallingCodes = [
  { country: 'United Kingdom', code: '+44' },
  { country: 'India', code: '+91' },
  { country: 'United States', code: '+1' },
  { country: 'Canada', code: '+1' },
  { country: 'Australia', code: '+61' },
  { country: 'United Arab Emirates', code: '+971' },
  { country: 'Ireland', code: '+353' },
  { country: 'New Zealand', code: '+64' },
  { country: 'Singapore', code: '+65' },
  { country: 'South Africa', code: '+27' },
];

export function CountryPhoneField({
  countryCode,
  phoneNumber,
  onCountryCodeChange,
  onPhoneNumberChange,
  required = false,
  autoComplete = 'tel-national',
  className = '',
}: CountryPhoneFieldProps) {
  return (
    <span className={`grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-1.5 ${className}`}>
      <select
        className="min-w-0 !px-1.5 text-xs"
        name="countryCode"
        aria-label="Country calling code"
        autoComplete="tel-country-code"
        value={countryCode}
        onChange={(event) => onCountryCodeChange(event.target.value)}
      >
        {countryCallingCodes.map(({ country, code }) => (
          <option key={country} value={code}>{code} · {country}</option>
        ))}
      </select>
      <input
        className="w-full min-w-0 !px-3 text-base tracking-wide"
        name="phoneNumber"
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        value={phoneNumber}
        onChange={(event) => onPhoneNumberChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
        placeholder="Phone number"
        minLength={10}
        maxLength={10}
        pattern="[0-9]{10}"
        required={required}
      />
    </span>
  );
}
