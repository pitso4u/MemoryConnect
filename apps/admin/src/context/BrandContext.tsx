import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { BrandProfile } from '@memorialconnect/shared';
import { brandCssVariables, brandFromFuneralHome, DEFAULT_BRAND_PROFILE } from '../lib/brand';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
interface BrandContextType {
  brand: BrandProfile;
  setPreviewBrand: (brand: BrandProfile) => void;
  refreshBrand: () => Promise<void>;
  isBrandLoading: boolean;
}

const BrandContext = createContext<BrandContextType | null>(null);
const CACHE_KEY = 'mc_brand_profile';

function isFamilyRole(role?: string) {
  return role === 'FAMILY_MANAGER' || role === 'FAMILY_CONTRIBUTOR';
}

function applyBrand(brand: BrandProfile) {
  const vars = brandCssVariables(brand);
  for (const [key, value] of Object.entries(vars)) document.documentElement.style.setProperty(key, value);
  document.documentElement.dataset.brandButton = brand.buttonStyle;
  document.documentElement.dataset.brandCard = brand.cardStyle;
  document.documentElement.dataset.brandAnimation = brand.animationLevel;
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const { token, user, managingHome } = useAuth();
  const [brand, setBrand] = useState<BrandProfile>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return DEFAULT_BRAND_PROFILE;
    try {
      return { ...DEFAULT_BRAND_PROFILE, ...JSON.parse(cached) };
    } catch {
      return DEFAULT_BRAND_PROFILE;
    }
  });
  const [isBrandLoading, setIsBrandLoading] = useState(false);

  const setPreviewBrand = (nextBrand: BrandProfile) => {
    setBrand(nextBrand);
    localStorage.setItem(CACHE_KEY, JSON.stringify(nextBrand));
  };

  const refreshBrand = async () => {
    if (!token || isFamilyRole(user?.role)) return;
    if (user?.role === 'SUPER_ADMIN' && !managingHome) return;
    setIsBrandLoading(true);
    try {
      const profile = await api.getFuneralHomeProfile();
      setPreviewBrand(profile.brand || brandFromFuneralHome(profile as unknown as Record<string, unknown>));
    } finally {
      setIsBrandLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setPreviewBrand(DEFAULT_BRAND_PROFILE);
      return;
    }
    // Platform owners see the Memory Connect brand unless they are managing a
    // funeral home, in which case that home's brand is applied.
    if (user?.role === 'SUPER_ADMIN' && !managingHome) {
      setPreviewBrand(DEFAULT_BRAND_PROFILE);
      return;
    }
    if (isFamilyRole(user?.role)) return;
    void refreshBrand();
  }, [token, user?.funeralHomeId, user?.role, managingHome?.id]);

  useEffect(() => applyBrand(brand), [brand]);

  const value = useMemo(() => ({ brand, setPreviewBrand, refreshBrand, isBrandLoading }), [brand, isBrandLoading]);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within BrandProvider');
  return ctx;
}
