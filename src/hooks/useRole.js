// src/hooks/useRole.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useRole — fetches the current authenticated user's role from the profiles table.
 * Returns { role, isLoading, error }
 *
 * Usage:
 *   const { role, isLoading, error } = useRole();
 *   if (role === 'super_admin') { ... }
 */
export function useRole() {
  const [role, setRole]         = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchRole() {
      try {
        setIsLoading(true);
        setError(null);

        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          if (isMounted) {
            setRole(null);
            setIsLoading(false);
          }
          return;
        }

        // Fetch the profile row for the current user
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

    // Re-fetch on auth state changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { role, isLoading, error };
}
