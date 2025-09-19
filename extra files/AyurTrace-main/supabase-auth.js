// Supabase configuration (replace with your actual project URL and public key)
const supabaseUrl = window.config.SUPABASE_URL;
const supabaseAnonKey = window.config.SUPABASE_ANON_KEY;

let supabase = null;

// Initialize Supabase client only if valid credentials are provided
if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL') {
    // Assuming @supabase/supabase-js is loaded globally via a <script> tag
    // e.g., <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    supabase = supabase_js.createClient(supabaseUrl, supabaseAnonKey);
} else {
    console.warn("Supabase credentials are not properly configured in config.js. Using simulated authentication.");
}

async function signIn(actorId, password, role) {
    console.log(`Attempting to sign in with Actor ID: ${actorId}, Role: ${role}`);

    // Hardcoded simulated user data
    const hardcodedUsers = {
        "FARM001": { password: "farmerpass", role: 1, actorId: "FARM001", name: "Farmer John" },
        "COLL001": { password: "collpass", role: 2, actorId: "COLL001", name: "Collector Jane" },
        "AUDI001": { password: "audipass", role: 3, actorId: "AUDI001", name: "Auditor Alex" },
        "MANU001": { password: "manupass", role: 4, actorId: "MANU001", name: "Manufacturer Mike" },
        "DIST001": { password: "distpass", role: 5, actorId: "DIST001", name: "Distributor David" },
    };

    // Retrieve dynamically registered users from localStorage
    let registeredUsers = {};
    try {
        const storedUsers = localStorage.getItem('ayurtrace_registered_users');
        if (storedUsers) {
            registeredUsers = JSON.parse(storedUsers);
        }
    } catch (e) {
        console.error("Error parsing registered users from localStorage:", e);
    }

    // Combine hardcoded and registered users (registered users take precedence)
    const allUsers = { ...hardcodedUsers, ...registeredUsers };

    const user = allUsers[actorId];

    if (user && user.password === password && user.role === role) {
        console.log("Login successful (simulated)", user);
        return user; // Return simulated user data
    } else {
        console.log("Login failed (simulated)");
        return null; // Simulated failed login
    }

    // Real Supabase authentication would look something like this:
    /*
    if (supabase) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: actorId, // Assuming actorId can be used as email for Supabase Auth
                password: password,
            });

            if (error) {
                console.error("Supabase sign-in error:", error.message);
                return null;
            }

            // You might need to fetch additional user metadata (like role) from a 'profiles' table
            // after successful authentication, as Supabase auth primarily handles email/password.
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, actor_id, name')
                .eq('user_id', data.user.id)
                .single();

            if (profileError) {
                console.error("Error fetching profile:", profileError.message);
                return null;
            }

            if (profile.role === role) {
                return { ...data.user, ...profile };
            } else {
                console.log("Role mismatch");
                await supabase.auth.signOut(); // Sign out if role doesn't match
                return null;
            }

        } catch (error) {
            console.error("Unexpected error during sign-in:", error.message);
            return null;
        }
    } else {
        console.warn("Supabase client not initialized. Falling back to simulated authentication.");
        // Fallback to simulated login if Supabase client is not initialized
        const user = users[actorId];
        if (user && user.password === password && user.role === role) {
            console.log("Login successful (simulated)", user);
            return user;
        } else {
            console.log("Login failed (simulated)");
            return null;
        }
    }
    */
}

async function signOut() {
    console.log("Signing out (simulated)");
    sessionStorage.removeItem('ayurtrace_currentUserKey');
    // In a real Supabase app, you would call await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// Expose signIn and signOut to the global scope
window.signIn = signIn;
window.signOut = signOut;