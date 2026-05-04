// src/hooks/useRole.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/** Auth events that should trigger a profiles.role refetch — not TOKEN_REFRESHED (hourly). */
const ROLE_FETCH_EVENTS = new Set([
  'INITIAL_SESSION',
  'SIGNED_IN',
  'SIGNED_OUT',
  'USER_UPDATED',
]);

/**
 * useRole — fetches the current authenticated user's role from the profiles table.
 * Returns { role, isLoading, error }
 */
export function useRole() {
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchRole() {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          if (isMounted) {
            setRole(null);
            setIsLoading(false);
          }
          return;
        }

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;

        if (isMounted) {
          setRole(data?.role ?? null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message ?? 'Failed to fetch user role.');
          setRole(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!ROLE_FETCH_EVENTS.has(event)) return;
      fetchRole();
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { role, isLoading, error };
}
