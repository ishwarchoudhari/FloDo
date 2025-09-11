// auth.js
// AJAX functions for login, signup, logout using Fetch API.

async function loginUser(formData) {
  const res = await fetchWithCSRF('/login/', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

async function signupUser(formData) {
  const res = await fetchWithCSRF('/signup/', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

async function logoutUser() {
  const res = await fetchWithCSRF('/logout/', {
    method: 'POST',
  });
  return res.json();
}

window.loginUser = loginUser;
window.signupUser = signupUser;
window.logoutUser = logoutUser;

// Attach login page interactions without inline JS
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) return; // not on login page

  const loader = document.getElementById('loginLoader');
  const errBox = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = document.getElementById('btnText');

  function setBusy(state){
    if (!btn || !btnSpinner || !btnText) return;
    if(state){
      btn.disabled = true; btn.classList.add('opacity-80','cursor-not-allowed');
      btnSpinner.classList.remove('hidden'); btnText.textContent = 'Signing in…';
    } else {
      btn.disabled = false; btn.classList.remove('opacity-80','cursor-not-allowed');
      btnSpinner.classList.add('hidden'); btnText.textContent = 'Sign in';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errBox) { errBox.classList.add('hidden'); errBox.textContent = ''; }
    setBusy(true);
    try {
      const data = new FormData(form);
      // Minimal client-side validation to avoid unnecessary requests
      const username = (data.get('username') || '').trim();
      const password = (data.get('password') || '');
      if (!username || !password) {
        if (errBox) { errBox.textContent = 'Please enter both username and password.'; errBox.classList.remove('hidden'); }
        setBusy(false);
        return;
      }
      const res = await loginUser(data);
      if (res && res.success) {
        if (window.updateAriaStatus) window.updateAriaStatus('Login successful. Redirecting to dashboard.');
        if (loader) { loader.classList.remove('hidden'); loader.classList.add('flex'); }
        if (form.parentElement) { form.parentElement.classList.add('opacity-0','translate-y-2'); }

        // Show progress loading effect in the center during the 3s wait
        try {
          // Reuse if already present to avoid duplicate IDs
          let loadingEl = document.getElementById('loading');
          if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'loading';
            loadingEl.textContent = 'Please wait...';
          }
          // Host: use the centered container's parent of the card wrapper (safe selector)
          // Structure: .min-h-[70vh] > .w-full.max-w-lg > .card > form
          const cardWrapper = form && form.closest('.w-full.max-w-lg');
          const host = (cardWrapper && cardWrapper.parentElement) || document.body;
          // Hide the original card to avoid visual overlap
          const card = form && form.parentElement ? form.parentElement : null;
          if (card) { card.classList.add('hidden'); }
          // Ensure loader is visible
          loadingEl.classList.remove('hidden');
          // Append loader if not already in DOM
          if (!loadingEl.isConnected) host.appendChild(loadingEl);
          // Optional: bring into view for smaller screens
          try { loadingEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch(_){}
        } catch(_) { /* no-op: graceful fallback */ }
        setTimeout(() => {
          window.location.href = res.redirect || '/dashboard/';
        }, 3000);
      } else {
        const msg = (res && (res.error || res.detail)) || 'Invalid username or password';
        if (errBox) { errBox.textContent = msg; errBox.classList.remove('hidden'); }
        if (window.updateAriaStatus) window.updateAriaStatus('Login failed. ' + msg);
        if (form.parentElement) {
          form.parentElement.classList.add('motion-safe:animate-[shake_0.3s]');
          setTimeout(()=> form.parentElement.classList.remove('motion-safe:animate-[shake_0.3s]'), 350);
        }
      }
    } catch (ex) {
      if (errBox) { errBox.textContent = 'Network error. Please try again.'; errBox.classList.remove('hidden'); }
      if (window.updateAriaStatus) window.updateAriaStatus('Network error during login.');
    } finally {
      setBusy(false);
    }
  });
});
