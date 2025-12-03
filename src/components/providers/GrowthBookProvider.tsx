'use client';

import { GrowthBookProvider as GBProvider } from '@growthbook/growthbook-react';
import { growthbook } from '@/lib/growthbook';

interface GrowthBookProviderProps {
  children: React.ReactNode;
}

export default function GrowthBookProvider({ children }: GrowthBookProviderProps) {
  return (
    <GBProvider growthbook={growthbook}>
      {children}
    </GBProvider>
  );
}