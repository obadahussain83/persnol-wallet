import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; // public anon/publishable key only, never service-role

export const powersyncUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL;

// null => app runs local-only (no cloud configured yet).
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        // PKCE: email links come back as ?code=…, which works the same on web and via native deep links.
        auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
      })
    : null;
