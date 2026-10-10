import { businessConfig } from '../config/business';

export interface EnquiryPayload {
  name: string;
  phone: string;
  email: string;
  destination: string;
  travellers: string;
  travelDate: string;
  message: string;
}

export interface SpecialTripEnquiry {
  type: 'special-trip';
  trip: string;
  name: string;
  phone: string;
  travelDate: string;
  travellers: string;
  message: string;
}

export interface AirportTravelEnquiry {
  type: 'airport-travel';
  travelType: string;
  airport: string;
  pickup: string;
  drop: string;
  travelDate: string;
  pickupTime: string;
  passengers: string;
  name: string;
  phone: string;
  message: string;
}

export type WhatsAppEnquiry = EnquiryPayload | SpecialTripEnquiry | AirportTravelEnquiry;

export function isValidPhoneNumber(phone: string) {
  const normalized = phone.trim().replace(/[\s()-]/g, '');
  if (!/^\+\d{11,13}$/.test(normalized)) return false;

  const digits = normalized.slice(1);
  const callingCodes = ['971', '353', '64', '65', '61', '27', '44', '91', '1'];
  const callingCode = callingCodes.find((code) => digits.startsWith(code));
  return Boolean(callingCode && digits.slice(callingCode.length).length === 10);
}

export function buildWhatsAppMessage(payload: WhatsAppEnquiry) {
  if ('type' in payload && payload.type === 'special-trip') {
    return `Srirudra Trips - Special Trip Enquiry

Special Trip:
${payload.trip}

Customer Name: ${payload.name}

Mobile:
${payload.phone}

Travel Date:
${payload.travelDate || 'Not specified'}

Passengers:
${payload.travellers}

Message:
${payload.message || 'Please share more details about this trip.'}`;
  }

  if ('type' in payload && payload.type === 'airport-travel') {
    return `Srirudra Trips - Airport Travel Enquiry

Travel Type:
${payload.travelType}

Airport:
${payload.airport}

Pickup:
${payload.pickup}

Drop:
${payload.drop}

Travel Date:
${payload.travelDate || 'Not specified'}

Pickup Time:
${payload.pickupTime || 'Not specified'}

Passengers:
${payload.passengers}

Customer Name:
${payload.name}

Mobile:
${payload.phone}

Message:
${payload.message || 'Please share more details about airport travel.'}`;
  }

  return `Srirudra Trips - Available Trip Enquiry

Trip:
${payload.destination}

Customer Name:
${payload.name}

Mobile:
${payload.phone}

Travel Date:
${payload.travelDate || 'Not specified'}

Passengers:
${payload.travellers}

Message:
${payload.message || 'Please share more details about this trip.'}`;
}

export function getWhatsAppUrl(payload: WhatsAppEnquiry) {
  const message = encodeURIComponent(buildWhatsAppMessage(payload));
  return `https://wa.me/${businessConfig.whatsappNumber}?text=${message}`;
}
