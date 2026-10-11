export interface TripCategory {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  image: string;
  iconName: string;
  accentColor: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Destination {
  id: string;
  categoryId: string;
  name: string;
  image: string;
  images?: string[];
  shortDescription: string;
  overview: string;
  duration: string;
  placesToVisit: string[];
  highlights: string[];
  extraInfo: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  destination: string;
  travellers: string;
  travelDate: string;
  message: string;
  createdAt: string;
}

export interface SpecialTrip {
  id: string;
  title: string;
  description: string;
  image: string;
  fromLocation: string;
  destination: string;
  tripDate: string;
  tripTime: string;
  originalPrice: string;
  price: string;
  seats: number | null;
  badge: string;
  isActive: boolean;
}

export interface CustomerReview {
  id: string;
  name: string;
  trip: string;
  text: string;
  image: string;
  isActive: boolean;
  createdAt: string;
}
