import { useEffect, useState } from 'react';
import { About } from './components/About';
import { AirportTravel } from './components/AirportTravel';
import { DestinationCarousel } from './components/DestinationCarousel';
import { DestinationDetails } from './components/DestinationDetails';
import { EnquiryForm } from './components/EnquiryForm';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { HappyCustomers } from './components/HappyCustomers';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { SplashScreen } from './components/SplashScreen';
import { SpecialTrips } from './components/SpecialTrips';
import { WhatsAppButton } from './components/WhatsAppButton';
import { WhyChooseUs } from './components/WhyChooseUs';
import type { CustomerReview, Destination, SpecialTrip, TripCategory } from './data/destinations';
import { siteImages } from './data/siteContent';
import { getPublicCustomerReviews, getPublicSpecialTrips, getPublicTripData } from './lib/supabaseApi';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  const [categories, setCategories] = useState<TripCategory[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [specialTrips, setSpecialTrips] = useState<SpecialTrip[]>([]);
  const [customerReviews, setCustomerReviews] = useState<CustomerReview[]>([]);
  const [specialTripsError, setSpecialTripsError] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [preferredDestination, setPreferredDestination] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [isSplashExiting, setIsSplashExiting] = useState(false);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [tripError, setTripError] = useState('');

  const isAdminRoute = window.location.pathname.replace(/\/$/, '') === '/admin';

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setIsSplashExiting(true), 1350);
    const removeTimer = window.setTimeout(() => setShowSplash(false), 1750);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;

    let isCurrent = true;
    getPublicTripData()
      .then((data) => {
        if (!isCurrent) return;
        setCategories(data.categories);
        setDestinations(data.destinations);
        setPreferredDestination(data.destinations[0]?.name ?? '');
        setTripError('');
      })
      .catch((error: Error) => {
        if (isCurrent) setTripError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingTrips(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute) return;

    let isCurrent = true;
    getPublicCustomerReviews()
      .then((reviews) => {
        if (isCurrent) setCustomerReviews(reviews);
      })
      .catch((error: Error) => {
        console.error('Could not load customer reviews.', error);
      });

    return () => {
      isCurrent = false;
    };
  }, [isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute) return;

    let isCurrent = true;
    getPublicSpecialTrips()
      .then((trips) => {
        if (!isCurrent) return;
        setSpecialTrips(trips);
        setSpecialTripsError('');
      })
      .catch((error: Error) => {
        if (isCurrent) setSpecialTripsError(error.message);
      });

    return () => {
      isCurrent = false;
    };
  }, [isAdminRoute]);

  function handleDestinationSelect(destination: Destination) {
    setSelectedDestination(destination);
    setPreferredDestination(destination.name);
  }

  if (isAdminRoute) {
    return <AdminPage />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      {showSplash && <SplashScreen isExiting={isSplashExiting} />}
      <Header />
      <main>
        <Hero heroImage={siteImages.hero} mobileHeroImage={siteImages.heroMobile} />
        <SpecialTrips trips={specialTrips} error={specialTripsError} />
        <AirportTravel />
        <DestinationCarousel
          categories={categories}
          destinations={destinations}
          error={tripError}
          isLoading={isLoadingTrips}
          onSelect={handleDestinationSelect}
        />
        <EnquiryForm destinations={destinations} preferredDestination={preferredDestination} />
        <HappyCustomers reviews={customerReviews} />
        <About />
        <WhyChooseUs />
        <FinalCTA />
      </main>
      <Footer />
      <WhatsAppButton />
      <DestinationDetails
        destination={selectedDestination}
        onClose={() => setSelectedDestination(null)}
        onEnquire={(destinationName) => {
          setPreferredDestination(destinationName);
          setSelectedDestination(null);
          document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
    </div>
  );
}
