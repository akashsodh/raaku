/* ============================================
   MPL ADMIN - Authentication
   ============================================ */

const MPL_AUTH = {
  // Change password here anytime
  PASSWORD: 'mpl@2025',

  // Session duration: 8 hours
  SESSION_DURATION: 8 * 60 * 60 * 1000,

  // --------- Login ---------
  login(password, username = 'Scorer') {
    if (password !== this.PASSWORD) {
      return { success: false, message: 'Galat password! Dobara try karo.' };
    }

    const session = {
      user:      username || 'Scorer',
      loginTime: Date.now(),
      expiresAt: Date.now() + this.SESSION_DURATION
    };

    localStorage.setItem('mpl_auth', JSON.stringify(session));
    return { success: true, session };
  },

  // --------- Logout ---------
  logout() {
    localStorage.removeItem('mpl_auth');
    window.location.href = 'index.html';
  },

  // --------- Check if logged in ---------
  isLoggedIn() {
    try {
      const session = JSON.parse(localStorage.getItem('mpl_auth'));
      if (!session) return false;
      if (Date.now() > session.expiresAt) {
        this.logout();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  // --------- Get current user ---------
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('mpl_auth'));
    } catch {
      return null;
    }
  },

  // --------- Protect page (redirect if not logged in) ---------
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  // --------- Redirect if already logged in ---------
  redirectIfLoggedIn() {
    if (this.isLoggedIn()) {
      window.location.href = 'dashboard.html';
    }
  }
};

window.MPL_AUTH = MPL_AUTH;