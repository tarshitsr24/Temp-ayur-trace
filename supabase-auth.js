// supabase-auth.js (table-based auth using public.users_plain)
const supabaseClient = window.supabase.createClient(
    window.config.SUPABASE_URL,
    window.config.SUPABASE_ANON_KEY
);

// Local session helpers
const SESSION_KEY = 'ayurtrace_user';

// Role mapping for consistent role handling
const ROLE_MAPPING = {
    1: 'farmer',
    2: 'collector',
    3: 'auditor',
    4: 'manufacturer',
    5: 'distributor'
};

function saveSession(user) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch { }
}
function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch { }
}
function readSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

/**
 * Sign up a new user by inserting into public.users_plain
 * Columns: actorId, password, fullName, phone, address, role
 * Unique: (actorId, role)
 */
async function signUp(actorId, password, role, fullName, phone, address) {
    try {
        const payload = {
            actorId,
            password,
            fullName,
            phone,
            address,
            role
        };

        const { data, error } = await supabaseClient
            .from('users_plain')
            .insert([payload])
            .select()
            .single();

        if (error) {
            // 23505 = unique_violation
            if (error.code === '23505') {
                error.message = 'This Actor ID with the selected role already exists.';
            }
            return { user: null, error };
        }

        return { user: data, error: null };
    } catch (error) {
        console.error('Sign-up error:', error);
        return { user: null, error };
    }
}

/**
 * Sign in by matching credentials in public.users_plain
 */
async function signIn(actorId, password, role) {
    try {
        const { data: user, error } = await supabaseClient
            .from('users_plain')
            .select('*')
            .eq('actorId', actorId)
            .eq('role', role)
            .single();

        if (error || !user) {
            return null;
        }

        // WARNING: Insecure plain-text password comparison! For production, use hashed passwords and secure comparison.
        if (user.password !== password) {
            console.warn('Insecure password check: passwords should be hashed and compared securely!');
            return null;
        }

        const sessionUser = {
            id: user.id,
            actorId: user.actorId,
            role: ROLE_MAPPING[user.role] || 'unknown', // Convert numeric role to string
            roleId: user.role, // Keep numeric role for reference
            name: user.fullName || user.actorId
        };
        saveSession(sessionUser);

        // Sync optional on-chain profile (non-blocking)
        try { await syncOnChainProfile(sessionUser); } catch (e) { console.warn('Profile sync skipped:', e?.message || e); }
        return sessionUser;
    } catch (error) {
        console.error('Sign-in error:', error);
        return null;
    }
}

/** Sign out: clear local session only */
async function signOut() {
    clearSession();
    window.location.href = 'index.html';
}

/** Get current user from local session */
async function getCurrentUser() {
    return readSession();
}

/** Is user authenticated? */
async function isAuthenticated() {
    return !!readSession();
}

// Sync profile to blockchain (optional, additive; no registration required)
async function syncOnChainProfile(sessionUser) {
    if (!window.Blockchain || !window.Blockchain.contractRW) return; // No chain yet
    const name = sessionUser.name || sessionUser.actorId;
    const username = sessionUser.actorId; // Use actorId as global username
    const role = sessionUser.role;

    try {
        await window.Blockchain.init();
        const c = window.Blockchain.contractRW;

        if (role === 'farmer') await c.setFarmerProfile(name, username);
        else if (role === 'collector') await c.setCollectorProfile(name, username);
        else if (role === 'auditor') await c.setAuditorProfile(name, username);
        else if (role === 'manufacturer') await c.setManufacturerProfile(name, username);
        else if (role === 'distributor') await c.setDistributorProfile(name, username);

        console.log(`✅ Synced ${role} profile: ${name} (${username})`);
    } catch (e) {
        console.warn(`⚠️ Profile sync failed for ${role}:`, e?.message || e);
    }
}

// Get current user's actorId (username) for blockchain operations
async function getCurrentActorId() {
    const user = await getCurrentUser();
    return user?.actorId || null;
}

// Expose globals
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.getCurrentUser = getCurrentUser;
window.getCurrentActorId = getCurrentActorId;
window.isAuthenticated = isAuthenticated;
window.supabaseClient = supabaseClient;