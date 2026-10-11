import logo from '../image.jpeg';
import { siteImages } from '../data/siteContent';

interface SplashScreenProps {
  isExiting: boolean;
}

export function SplashScreen({ isExiting }: SplashScreenProps) {
  return (
    <div
      className={`fixed inset-0 z-[70] grid min-h-[100svh] place-items-center overflow-hidden bg-ocean-950 px-5 text-white ${
        isExiting ? 'splash-exit' : ''
      }`}
    >
      <img
        src={siteImages.hero}
        alt=""
        className="absolute inset-0 h-full w-full scale-105 object-cover object-center opacity-45 splash-bg"
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(5,41,45,0.96)_0%,rgba(8,53,58,0.82)_48%,rgba(18,63,53,0.66)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(247,178,103,0.24),transparent_34%)]" />
      <div className="absolute left-1/2 top-[18%] h-[58vh] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/25 to-transparent" />
      <div className="absolute bottom-12 left-1/2 h-28 w-[min(76vw,520px)] -translate-x-1/2 rounded-[50%] border-t border-white/25" />

      <div className="relative flex w-full max-w-md flex-col items-center text-center splash-enter" role="status" aria-label="Loading Sri Rudra Trips">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-sunrise/20 blur-2xl" />
          <img
            src={logo}
            alt="Sri Rudra Trips logo"
            className="relative h-36 w-36 rounded-2xl bg-white object-contain p-1 shadow-2xl ring-4 ring-white/25 min-[390px]:h-44 min-[390px]:w-44 sm:h-52 sm:w-52"
          />
        </div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.34em] text-sunrise">Sri Rudra Trips</p>
        <p className="mt-3 font-display text-3xl font-bold leading-tight tracking-normal text-white min-[390px]:text-4xl sm:text-5xl">
          Your Journey Starts Here
        </p>
        <p className="mt-3 max-w-sm text-sm leading-6 text-white/78 sm:text-base">
          Scenic destinations, simple planning, and friendly travel guidance.
        </p>
        <div className="mt-8 h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-white/18">
          <div className="h-full w-1/2 rounded-full bg-sunrise splash-progress" />
        </div>
      </div>
    </div>
  );
}
