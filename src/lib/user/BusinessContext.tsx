"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { useBusinessData } from './useBusinessData';
import { BusinessData } from './utils';

interface BusinessContextType {
  businessData: BusinessData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

interface BusinessProviderProps {
  children: ReactNode;
  user: User | null;
}

export function BusinessProvider({ children, user }: BusinessProviderProps) {
  const businessDataHook = useBusinessData(user);

  return (
    <BusinessContext.Provider value={businessDataHook}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusinessContext must be used within a BusinessProvider');
  }
  return context;
}
