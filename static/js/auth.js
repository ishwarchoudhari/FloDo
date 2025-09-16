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

  // ------------------------------
  // Super-Admin Forgot Password (OTP) – zero reload
  // ------------------------------
  const fpToggle = document.getElementById('forgotPwdToggle');
  const fpWrap = document.getElementById('forgotPwdWrap');
  const fpStepSend = document.getElementById('fpStepSend');
  const fpStepOtp = document.getElementById('fpStepOtp');
  const fpStepReset = document.getElementById('fpStepReset');
  const fpSendBtn = document.getElementById('fpSendBtn');
  const fpOtpInput = document.getElementById('fpOtpInput');
  const fpVerifyBtn = document.getElementById('fpVerifyBtn');
  const fpNewPassword = document.getElementById('fpNewPassword');
  const fpResetBtn = document.getElementById('fpResetBtn');
  const fpMsg = document.getElementById('fpMsg');
  const fpCountdown = document.getElementById('fpCountdown');

  let countdownTimer = null;
  function showStep(step){
    if (!fpWrap) return;
    [fpStepSend, fpStepOtp, fpStepReset].forEach(s => s && s.classList.add('hidden'));
    if (step === 1 && fpStepSend) fpStepSend.classList.remove('hidden');
    if (step === 2 && fpStepOtp) fpStepOtp.classList.remove('hidden');
    if (step === 3 && fpStepReset) fpStepReset.classList.remove('hidden');
  }
  function setFpBusy(el, busy, labelBusy='Working…', labelIdle){
    if (!el) return;
    const txt = el.querySelector('[data-text]');
    const sp = el.querySelector('svg');
    el.disabled = !!busy;
    if (busy){
      el.classList.add('opacity-80','cursor-not-allowed');
      if (sp) sp.classList.remove('hidden');
      if (txt) txt.textContent = labelBusy;
    } else {
      el.classList.remove('opacity-80','cursor-not-allowed');
      if (sp) sp.classList.add('hidden');
      if (txt && labelIdle) txt.textContent = labelIdle;
    }
  }
  function setFpMsg(type, text){
    if (!fpMsg) return;
    fpMsg.textContent = text || '';
    fpMsg.classList.add('hidden');
    fpMsg.classList.remove('text-red-600','text-green-600');
    if (text){
      fpMsg.classList.remove('hidden');
      fpMsg.classList.add(type === 'error' ? 'text-red-600' : 'text-green-600');
    }
  }
  function startOtpCountdown(sec){
    if (!fpCountdown) return;
    if (countdownTimer) clearInterval(countdownTimer);
    let remaining = sec;
    fpCountdown.textContent = `Expires in ${remaining}s`;
    fpCountdown.classList.remove('hidden');
    countdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0){
        clearInterval(countdownTimer); countdownTimer = null;
        fpCountdown.textContent = 'Code expired. Request a new one.';
        return;
      }
      fpCountdown.textContent = `Expires in ${remaining}s`;
    }, 1000);
  }

  async function requestOtp(){
    if (fpMsg) setFpMsg('info','');
    setFpBusy(fpSendBtn, true, 'Sending…', 'Send OTP');
    try {
      const res = await fetchWithCSRF('/Super-Admin/auth/password-reset/request/', { method: 'POST' });
      const data = await res.json();
      showNotification('If an account exists, an OTP has been sent.', 'info');
      showStep(2);
      startOtpCountdown(600);
    } catch {
      setFpMsg('error','Network error. Try again.');
    } finally {
      setFpBusy(fpSendBtn, false, 'Sending…', 'Send OTP');
    }
  }

  async function verifyOtp(){
    setFpMsg('info','');
    const code = (fpOtpInput && fpOtpInput.value || '').trim();
    if (!/^\d{6}$/.test(code)){
      setFpMsg('error','Please enter a valid 6-digit code.');
      return;
    }
    setFpBusy(fpVerifyBtn, true, 'Verifying…', 'Verify Code');
    try {
      const fd = new FormData();
      fd.append('code', code);
      const res = await fetchWithCSRF('/Super-Admin/auth/password-reset/verify-otp/', { method: 'POST', body: fd });
      const data = await res.json();
      if (data && data.ok && data.verified){
        showNotification('OTP verified. You can set a new password now.', 'success');
        showStep(3);
      } else {
        setFpMsg('error','Incorrect or expired code. Try again.');
      }
    } catch {
      setFpMsg('error','Network error. Try again.');
    } finally {
      setFpBusy(fpVerifyBtn, false, 'Verifying…', 'Verify Code');
    }
  }

  async function confirmReset(){
    setFpMsg('info','');
    const npw = (fpNewPassword && fpNewPassword.value) || '';
    if (!npw || npw.length < 8){ setFpMsg('error','Password must be at least 8 characters.'); return; }
    setFpBusy(fpResetBtn, true, 'Updating…', 'Reset Password');
    try {
      const fd = new FormData();
      fd.append('new_password', npw);
      const res = await fetchWithCSRF('/Super-Admin/auth/password-reset/confirm/', { method: 'POST', body: fd });
      const data = await res.json();
      if (data && data.ok && data.reset){
        showNotification('Password reset successful. Please sign in.', 'success');
        // Return to step 1 and close panel
        showStep(1);
        if (fpWrap) fpWrap.classList.add('hidden');
      } else {
        setFpMsg('error', (data && data.error) || 'Unable to reset password.');
      }
    } catch {
      setFpMsg('error','Network error. Try again.');
    } finally {
      setFpBusy(fpResetBtn, false, 'Updating…', 'Reset Password');
    }
  }

  if (fpToggle && fpWrap){
    fpToggle.addEventListener('click', (e)=>{
      e.preventDefault();
      fpWrap.classList.toggle('hidden');
      showStep(1);
      setFpMsg('info','');
    });
  }
  if (fpSendBtn) fpSendBtn.addEventListener('click', (e)=>{ e.preventDefault(); requestOtp(); });
  if (fpVerifyBtn) fpVerifyBtn.addEventListener('click', (e)=>{ e.preventDefault(); verifyOtp(); });
  if (fpResetBtn) fpResetBtn.addEventListener('click', (e)=>{ e.preventDefault(); confirmReset(); });
});
