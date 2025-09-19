// Simple client-side auth using localStorage (can be swapped for real backend/wallet later)
// Public API: Auth.signup, Auth.login, Auth.logout, Auth.getSession, Auth.requireAuth
(function () {
  const STORAGE_KEY = 'ayurtrace_users_v1';
  const SESSION_KEY = 'ayurtrace_session_v1';

  function readUsers() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }
  function writeUsers(users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }
  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function normalizeEmail(email){ return String(email || '').trim().toLowerCase(); }

  const Auth = {
    async signup({ name, username, email, address, password, role }) {
      email = normalizeEmail(email);
      if (!email || !password || !role || !name || !username || !address) throw new Error('Missing required fields');
      const users = readUsers();
      if (users.some(u => u.email === email)) throw new Error('Email already registered');
      users.push({ id: crypto.randomUUID(), name: name || email, username, address, email, password, role });
      writeUsers(users);
      return true;
    },
    async login({ email, password, role }) {
      email = normalizeEmail(email);
      const users = readUsers();
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) throw new Error('Invalid credentials');
      // If a role was chosen, ensure it matches stored role
      if (role && user.role !== role) throw new Error(`This account is registered as ${user.role}`);
      setSession({ id: user.id, name: user.name, email: user.email, role: user.role });
      return true;
    },
    logout() { clearSession(); },
    getSession() { return getSession(); },
    requireAuth({ redirectTo } = {}) {
      const session = getSession();
      if (!session && redirectTo) {
        window.location.replace(redirectTo);
        return null;
      }
      return session;
    },
    // Utilities for user lookup (passwords removed)
    listUsers() {
      return readUsers().map(({password, ...safe}) => safe);
    },
    getUserById(id){
      const u = readUsers().find(u => u.id === id);
      if (!u) return null;
      const { password, ...safe } = u; return safe;
    },
    getUserByEmail(email){
      email = normalizeEmail(email);
      const u = readUsers().find(u => u.email === email);
      if (!u) return null;
      const { password, ...safe } = u; return safe;
    }
  };

  window.Auth = Auth;
})();
