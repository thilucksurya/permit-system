var __DEBUG = false;

function _getClient() {
    if (!_supabaseClient) {
        throw new Error('Unable to connect to authentication service. Please check your configuration.');
    }
    return _supabaseClient;
}

function _clearSupabaseStorage() {
    try {
        const keys = [];
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
                keys.push(key);
                localStorage.removeItem(key);
            }
        }
        __DEBUG && console.log('[Auth] Cleared Supabase keys:', keys.length, keys);
    } catch (e) {
        __DEBUG && console.error('[Auth] Error clearing storage:', e.message);
    }
}

const Auth = {
    user: null,
    profile: null,
    _initialized: false,

    async init() {
        if (this._initialized) {
            __DEBUG && console.log('[Auth] Already initialized, skipping');
            return;
        }

        try {
            const client = _getClient();
            const { data: { session }, error } = await client.auth.getSession();
            __DEBUG && console.log('[Auth] getSession result:', !!session, 'user:', session?.user?.email, 'error:', error?.message);

            if (session && session.user) {
                this.user = session.user;
                await this._loadProfile();
                __DEBUG && console.log('[Auth] Session valid, user:', this.user.email);
            } else {
                this.user = null;
                this.profile = null;
                __DEBUG && console.log('[Auth] No session found');
            }

            client.auth.onAuthStateChange(async (event, session) => {
                __DEBUG && console.log('[Auth] Event:', event, 'session:', !!session, 'user:', session?.user?.email);

                if (event === 'SIGNED_OUT') {
                    this.user = null;
                    this.profile = null;
                    this._initialized = false;
                    _clearSupabaseStorage();
                    __DEBUG && console.log('[Auth] Signed out, storage cleared');
                    return;
                }

                if (event === 'INITIAL_SESSION' && session) {
                    this.user = session.user;
                    __DEBUG && console.log('[Auth] Initial session:', this.user?.email);
                }

                if (event === 'SIGNED_IN' && session) {
                    this.user = session.user;
                    await this._loadProfile();
                    __DEBUG && console.log('[Auth] Signed in:', this.user?.email);
                }

                if (event === 'TOKEN_REFRESHED' && session) {
                    this.user = session.user;
                    __DEBUG && console.log('[Auth] Token refreshed');
                }
            });

            this._initialized = true;
        } catch (e) {
            __DEBUG && console.error('[Auth] Init error:', e.message);
            this.user = null;
            this.profile = null;
            this._initialized = true;
        }
    },

    async _loadProfile() {
        if (!this.user) return;
        try {
            const client = _getClient();
            const { data, error } = await client
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .single();
            this.profile = data;
            __DEBUG && console.log('[Auth] Profile loaded:', data?.full_name || 'none', 'error:', error?.message);
        } catch (e) {
            __DEBUG && console.log('[Auth] Profile load failed:', e.message);
            this.profile = null;
        }
    },

    async signUp(email, password, name) {
        __DEBUG && console.log('[Auth] SignUp attempt:', email);
        const client = _getClient();
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name },
                emailRedirectTo: window.location.origin + window.location.pathname.replace(/\/pages\/.*$/, '') + '/pages/verify-email.html'
            }
        });
        if (error) {
            __DEBUG && console.error('[Auth] SignUp error:', error.message);
            const m = (error.message || '').toLowerCase();
            if (m.includes('already') || m.includes('registered')) {
                throw new Error('An account with this email already exists.');
            }
            if (m.includes('password')) {
                throw new Error('Password does not meet requirements. Use at least 6 characters.');
            }
            throw new Error(error.message || 'Unable to create account. Please try again.');
        }
        __DEBUG && console.log('[Auth] SignUp success:', data?.user?.email);
        return data;
    },

    async signIn(email, password) {
        __DEBUG && console.log('[Auth] SignIn attempt:', email);
        const client = _getClient();
        const { data, error } = await client.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) {
            __DEBUG && console.error('[Auth] SignIn error:', error.message);
            const m = (error.message || '').toLowerCase();
            if (m.includes('email not confirmed')) {
                throw new Error('Please verify your email before signing in.');
            }
            if (m.includes('invalid') || m.includes('wrong')) {
                throw new Error('Invalid email or password.');
            }
            if (m.includes('not found')) {
                throw new Error('No account found with this email.');
            }
            if (m.includes('too many')) {
                throw new Error('Too many attempts. Please wait a moment.');
            }
            throw new Error(error.message || 'Unable to sign in. Please try again.');
        }
        this.user = data.user;
        await this._loadProfile();
        __DEBUG && console.log('[Auth] SignIn success:', data.user?.email);
        return data;
    },

    async signOut() {
        __DEBUG && console.log('[Auth] ===== SIGN OUT START =====');

        this.user = null;
        this.profile = null;

        _clearSupabaseStorage();

        try {
            const client = _getClient();
            await client.auth.signOut({ scope: 'local' });
            __DEBUG && console.log('[Auth] Supabase signOut OK');
        } catch (e) {
            __DEBUG && console.error('[Auth] Supabase signOut error:', e.message);
        }

        _clearSupabaseStorage();

        this._initialized = false;

        __DEBUG && console.log('[Auth] Redirecting to login...');
        window.location.replace('../index.html');
    },

    async resetPassword(email) {
        __DEBUG && console.log('[Auth] Password reset requested:', email);
        const client = _getClient();
        const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname.replace(/\/pages\/.*$/, '') + '/pages/reset-password.html'
        });
        if (error) {
            __DEBUG && console.error('[Auth] Reset error:', error.message);
            const m = (error.message || '').toLowerCase();
            if (m.includes('not found') || m.includes('user')) {
                throw new Error('No account found with this email.');
            }
            throw new Error(error.message || 'Unable to send reset link. Please try again.');
        }
        __DEBUG && console.log('[Auth] Reset email sent:', email);
    },

    async updatePassword(pw) {
        __DEBUG && console.log('[Auth] Password update attempt');
        const client = _getClient();
        const { error } = await client.auth.updateUser({ password: pw });
        if (error) {
            __DEBUG && console.error('[Auth] Password update error:', error.message);
            throw new Error(error.message || 'Unable to update password. Please try again.');
        }
        __DEBUG && console.log('[Auth] Password updated successfully');
    },

    async resendVerification(email) {
        __DEBUG && console.log('[Auth] Resend verification:', email);
        const client = _getClient();
        const { error } = await client.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: window.location.origin + window.location.pathname.replace(/\/pages\/.*$/, '') + '/pages/verify-email.html'
            }
        });
        if (error) {
            __DEBUG && console.error('[Auth] Resend error:', error.message);
            const m = (error.message || '').toLowerCase();
            if (m.includes('rate limit')) {
                throw new Error('Too many requests. Please wait a moment and try again.');
            }
            throw new Error(error.message || 'Unable to resend verification email. Please try again.');
        }
        __DEBUG && console.log('[Auth] Verification resent:', email);
    },

    isAuth() { return !!this.user; },
    isAdmin() { return this.profile?.role === 'admin'; },
    isApprover() { return ['admin', 'approver'].includes(this.profile?.role); },
    get uid() { return this.user?.id; },
    get email() { return this.user?.email || ''; },

    guard() {
        if (!this.isAuth()) {
            __DEBUG && console.log('[Auth] Guard BLOCKED - not authenticated');
            window.location.replace('../index.html');
            return false;
        }
        return true;
    },
    guardAdmin() {
        if (!this.guard()) return false;
        if (!this.isAdmin()) {
            window.location.replace('../pages/dashboard.html');
            return false;
        }
        return true;
    }
};
