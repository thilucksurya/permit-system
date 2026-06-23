const SUPABASE_URL = 'https://xwjotmxpwtdbjfwbkjhq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3am90bXhwd3RkYmpmd2JramhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzM5MzYsImV4cCI6MjA5NzgwOTkzNn0.wbhxYaDxviwuBGhPfOgLELo78_byFk7Dhd36A2NZm_w';

var _supabaseClient = null;

(function initSupabase() {
    if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
        console.error('[Config] Supabase URL not configured.');
        return;
    }
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_ANON_KEY') {
        console.error('[Config] Supabase anon key not configured.');
        return;
    }
    if (typeof window === 'undefined' || !window.supabase || typeof window.supabase.createClient !== 'function') {
        console.error('[Config] Supabase CDN library not loaded. Check your internet connection.');
        return;
    }
    try {
        _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('[Config] Supabase client initialized.');
    } catch (e) {
        console.error('[Config] Failed to create Supabase client:', e.message);
    }
})();
