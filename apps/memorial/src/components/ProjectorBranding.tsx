import { useState } from 'react';
import type { BrandProfile } from '@memorialconnect/shared';
import { photoUrl } from '../lib/api';

export function ProjectorBranding({ brand }: { brand: BrandProfile }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(brand.logoUrl) && !logoFailed;

  return (
    <>
      {showLogo ? (
        <img
          src={photoUrl(brand.logoUrl as string)}
          alt={`${brand.companyName} logo`}
          loading="eager"
          decoding="async"
          onError={() => setLogoFailed(true)}
          className="absolute left-5 top-5 z-10 h-16 max-w-56 object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:left-8 sm:top-8 sm:h-20"
        />
      ) : (
        <div className="absolute left-5 top-5 z-10 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/75 backdrop-blur-md sm:left-8 sm:top-8">
          {brand.tradingName || brand.companyName}
        </div>
      )}
      {brand.footerText && (
        <p className="absolute bottom-3 left-1/2 z-10 w-full max-w-[92%] -translate-x-1/2 px-6 text-center text-sm text-white/70 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] sm:bottom-4 sm:text-base">
          {brand.footerText}
        </p>
      )}
    </>
  );
}
