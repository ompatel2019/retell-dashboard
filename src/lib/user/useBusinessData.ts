import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { getCurrentUserBusiness, BusinessData } from './utils';

export function useBusinessData(user: User | null) {
  const [businessData, setBusinessData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBusinessData(null);
      setError(null);
      return;
    }

    const fetchBusinessData = async () => {
      setLoading(true);
      setError(null);
      
      console.log('Fetching business data for user:', user);
      
      try {
        const data = await getCurrentUserBusiness(user);
        console.log('Business data result:', data);
        if (data) {
          setBusinessData(data);
        } else {
          setError('No business data found for this user. Please run the setup script or contact your administrator.');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch business data';
        console.error('Business data fetch error:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchBusinessData();
  }, [user]);

  const refetch = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    console.log('Refetching business data for user:', user);
    
    try {
      const data = await getCurrentUserBusiness(user);
      console.log('Business data refetch result:', data);
              if (data) {
          setBusinessData(data);
        } else {
          setError('No business data found for this user. Please run the setup script or contact your administrator.');
        }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch business data';
      console.error('Business data refetch error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    businessData,
    loading,
    error,
    refetch
  };
}
