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
  if (form) {
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
            try { loadingEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch(_){ }
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
  }

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
  const fpConfirmPassword = document.getElementById('fpConfirmPassword');
  const fpResetBtn = document.getElementById('fpResetBtn');
  const fpMsg = document.getElementById('fpMsg');
  const fpCountdown = document.getElementById('fpCountdown');
  const fpCountdownOtp = document.getElementById('fpCountdownOtp');
  const fpProgressOtp = document.getElementById('fpProgressOtp');
  const fpOtpFill = document.getElementById('fpOtpFill');
  const fpOtpLive = document.getElementById('fpOtpLive');
  const loginPasswordField = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');

  // OTP split boxes (6 inputs) – support both original fp* IDs and user's otp* IDs
  const fpOtpGroup = document.getElementById('fpOtpGroup');
  const fpOtpBoxes = [0,1,2,3,4,5].map(i=> document.getElementById('fpOtpBox'+i)).filter(Boolean);
  const otpGroupCompat = document.getElementById('otpGroup');
  const otpBoxesCompat = [0,1,2,3,4,5].map(i=> document.getElementById('otp'+i)).filter(Boolean);
  const fpOtpClear = document.getElementById('fpOtpClear') || document.getElementById('otpClear');
  const fpResendBtn = document.getElementById('fpResendBtn');
  const fpResendLabel = document.getElementById('fpResendLabel');
  const countdownCompat = document.getElementById('countdown');
  const progressBarCompat = document.getElementById('progressBar');
  const progressTextCompat = document.getElementById('progressText');

  // Effective OTP elements (prefer fp* if present, else otp* variants)
  const OTP = {
    group: fpOtpGroup || otpGroupCompat,
    boxes: (fpOtpBoxes && fpOtpBoxes.length ? fpOtpBoxes : otpBoxesCompat),
    clearBtn: fpOtpClear,
    progressFill: fpOtpFill || progressBarCompat,
    progressText: progressTextCompat,
    countdownText: fpCountdownOtp || countdownCompat,
  };
  let otpSubmitting = false;
  let resendCooldownTimer = null;

  function ariaAnnounce(msg){
    try {
      if (!fpOtpLive) return;
      // Clear then set to ensure SRs read changes
      fpOtpLive.textContent = '';
      // Minor delay helps some screen readers pick up changes reliably
      setTimeout(()=>{ fpOtpLive.textContent = msg; }, 10);
    } catch(_){ }
  }

  function getOtpString(){
    if (!OTP.boxes || !OTP.boxes.length) return '';
    return OTP.boxes.map(b => (b && b.value) ? b.value.replace(/\D/g,'') : '').join('').slice(0,6);
  }
  function setOtpHidden(){
    if (fpOtpInput) fpOtpInput.value = getOtpString();
  }
  function updateOtpFill(){
    if (!OTP.progressFill && !OTP.progressText) return;
    const len = getOtpString().length;
    const pct = Math.max(0, Math.min(100, Math.round((len/6)*100)));
    try { if (OTP.progressFill) OTP.progressFill.style.width = pct + '%'; } catch(_){ }
    try { if (OTP.progressText) OTP.progressText.textContent = `${len}/6`; } catch(_){ }
  }
  function clearOtp(){
    (OTP.boxes || []).forEach(b=>{ if (b) b.value=''; });
    setOtpHidden();
    updateOtpFill();
    if (OTP.boxes && OTP.boxes[0]) OTP.boxes[0].focus();
  }
  function otpErrorFeedback(){
    try{
      if (OTP.group){
        OTP.group.classList.add('animate-shake');
        setTimeout(()=> OTP.group.classList.remove('animate-shake'), 350);
      }
      (OTP.boxes || []).forEach(b=>{
        if (!b) return;
        b.classList.remove('ring-2','ring-green-500','border-green-500');
        b.classList.add('ring-2','ring-red-500','border-red-500');
        setTimeout(()=>{ b.classList.remove('ring-2','ring-red-500','border-red-500'); }, 800);
      });
    } catch(_){ }
  }
  function focusNext(index){
    if (!OTP.boxes || !OTP.boxes.length) return;
    const next = OTP.boxes[index+1];
    if (next) next.focus();
  }
  function focusPrev(index){
    if (!OTP.boxes || !OTP.boxes.length) return;
    const prev = OTP.boxes[index-1];
    if (prev) prev.focus();
  }
  function handleOtpAutoSubmit(){
    const code = getOtpString();
    setOtpHidden();
    updateOtpFill();
    if (code.length === 6 && !otpSubmitting){
      otpSubmitting = true;
      // Small delay to allow UI focus to settle
      ariaAnnounce('Code submitted');
      setTimeout(async ()=>{
        try { await verifyOtp(); } finally { otpSubmitting = false; }
      }, 50);
    }
  }
  function initOtpBoxes(){
    if (!OTP.boxes || !OTP.boxes.length) return;
    OTP.boxes.forEach((box, idx)=>{
      // sanitize non-digit
      const sanitize = ()=>{ box.value = (box.value || '').replace(/\D/g,'').slice(0,1); };
      box.addEventListener('input', (e)=>{
        sanitize();
        if (box.value){ focusNext(idx); }
        handleOtpAutoSubmit();
        // Announce progress for screen readers
        try { const entered = getOtpString().length; ariaAnnounce(`Digit ${entered} of 6 entered`); } catch(_){ }
      });
      box.addEventListener('keydown', (e)=>{
        if (e.key === 'Backspace'){
          if (!box.value){ focusPrev(idx); }
        } else if (e.key && /^[0-9]$/.test(e.key)){
          // Allow digits
        } else if (e.key.length === 1){
          // Block non-digits
          e.preventDefault();
        }
      });
      box.addEventListener('paste', (e)=>{
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text') || '';
        const digits = text.replace(/\D/g,'').slice(0,6);
        if (!digits) return;
        // Fill starting from current index
        for (let i=0;i<digits.length && (idx+i)<OTP.boxes.length;i++){
          const target = OTP.boxes[idx+i];
          if (target){ target.value = digits[i]; }
        }
        const lastIdx = Math.min(idx + digits.length, OTP.boxes.length-1);
        const last = OTP.boxes[lastIdx];
        if (last) last.focus();
        handleOtpAutoSubmit();
      });
      // Improve touch targets slightly (already big)
      box.setAttribute('inputmode','numeric');
      box.setAttribute('aria-label', `OTP digit ${idx+1}`);
    });
    // Set hidden input on init
    setOtpHidden();
    updateOtpFill();
  }

  let countdownTimer = null;
  function showStep(step){
    if (!fpWrap) return;
    [fpStepSend, fpStepOtp, fpStepReset].forEach(s => s && s.classList.add('hidden'));
    if (step === 1 && fpStepSend) fpStepSend.classList.remove('hidden');
    if (step === 2 && fpStepOtp){
      fpStepOtp.classList.remove('hidden');
      // Ensure OTP boxes initialized and focus first box
      try { initOtpBoxes(); } catch(_){ }
      if (OTP.boxes && OTP.boxes[0]) OTP.boxes[0].focus();
    }
    if (step === 3 && fpStepReset) fpStepReset.classList.remove('hidden');
  }
  function toggleLoginInputs(disabled){
    try {
      if (loginPasswordField){
        if (disabled){
          loginPasswordField.dataset._prevDisplay = loginPasswordField.style.display || '';
          loginPasswordField.closest('div')?.classList.add('hidden');
          loginPasswordField.setAttribute('disabled','disabled');
        } else {
          loginPasswordField.closest('div')?.classList.remove('hidden');
          loginPasswordField.removeAttribute('disabled');
        }
      }
      if (loginBtn){
        if (disabled){
          loginBtn.dataset._prevDisabled = '1';
          loginBtn.classList.add('opacity-60','cursor-not-allowed');
          loginBtn.setAttribute('disabled','disabled');
        } else {
          loginBtn.classList.remove('opacity-60','cursor-not-allowed');
          loginBtn.removeAttribute('disabled');
        }
      }
    } catch(_){ }
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
  function updatePwMatch(){
    if (!fpNewPassword || !fpConfirmPassword) return;
    const iconConfirmOk = document.getElementById('fpPwMatchIcon');
    const iconNewOk = document.getElementById('fpPwNewIconOk');
    const iconNewBad = document.getElementById('fpPwNewIconBad');
    const iconConfirmBad = document.getElementById('fpPwConfirmIconBad');
    const npw = (fpNewPassword.value || '').trim();
    const cpw = (fpConfirmPassword.value || '').trim();
    const npwOk = npw.length >= 8; // basic length rule for visual feedback
    const cpwOk = cpw.length >= 8;
    const match = npwOk && cpwOk && npw === cpw;
    try {
      // Toggle icons
      if (iconConfirmOk) iconConfirmOk.classList.toggle('hidden', !match);
      if (iconNewOk) iconNewOk.classList.toggle('hidden', !(match && npwOk));
      if (iconNewBad) iconNewBad.classList.toggle('hidden', !(cpw.length > 0 && npw.length > 0 && !match));
      if (iconConfirmBad) iconConfirmBad.classList.toggle('hidden', !(cpw.length > 0 && !match));

      // Border feedback for both fields
      const okCls = ['ring-2','ring-green-500','border-green-500'];
      const badCls = ['ring-2','ring-red-500','border-red-500'];
      fpNewPassword.classList.remove('ring-2','ring-green-500','border-green-500','ring-red-500','border-red-500');
      fpConfirmPassword.classList.remove('ring-2','ring-green-500','border-green-500','ring-red-500','border-red-500');
      if (npw.length > 0){
        if (match) okCls.forEach(c=>fpNewPassword.classList.add(c));
        else if (cpw.length > 0) badCls.forEach(c=>fpNewPassword.classList.add(c));
      }
      if (cpw.length > 0){
        if (match) okCls.forEach(c=>fpConfirmPassword.classList.add(c));
        else badCls.forEach(c=>fpConfirmPassword.classList.add(c));
      }

      // Enable/disable Reset button strictly when match is true
      const resetBtn = document.getElementById('fpResetBtn');
      if (resetBtn){
        if (match){
          resetBtn.removeAttribute('disabled');
          resetBtn.classList.remove('opacity-60','cursor-not-allowed');
        } else {
          resetBtn.setAttribute('disabled','disabled');
          if (!resetBtn.classList.contains('opacity-60')) resetBtn.classList.add('opacity-60');
          if (!resetBtn.classList.contains('cursor-not-allowed')) resetBtn.classList.add('cursor-not-allowed');
        }
      }
    } catch(_){ }
  }
  function startOtpCountdown(sec){
    if (!fpCountdown && !fpCountdownOtp && !fpProgressOtp && !OTP.countdownText) return;
    if (countdownTimer) clearInterval(countdownTimer);
    let remaining = sec;
    // Step 1 hint (send step)
    if (fpCountdown){
      fpCountdown.textContent = `Expires in ${remaining}s`;
      fpCountdown.classList.remove('hidden');
      fpCountdown.classList.remove('text-red-600','text-yellow-600','text-green-600','animate-pulse');
      fpCountdown.classList.add('text-green-600');
    }
    // Step 2 elements (OTP entry)
    const cdText = OTP.countdownText || fpCountdownOtp;
    if (cdText){
      cdText.textContent = `Expires in ${remaining}s`;
      cdText.classList?.remove('text-red-600','text-yellow-600','text-green-600','animate-pulse');
      cdText.classList?.add('text-green-600');
    }
    if (fpProgressOtp){
      fpProgressOtp.style.width = '100%';
      fpProgressOtp.classList.remove('bg-red-600','bg-yellow-500','bg-blue-600');
      fpProgressOtp.classList.add('bg-blue-600');
    }
    countdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0){
        clearInterval(countdownTimer); countdownTimer = null;
        if (fpCountdown){
          fpCountdown.textContent = 'Code expired. Request a new one.';
          fpCountdown.classList.remove('text-green-600','text-yellow-600');
          fpCountdown.classList.add('text-red-600');
          fpCountdown.classList.remove('animate-pulse');
        }
        if (cdText){
          cdText.textContent = 'Code expired';
          cdText.classList?.remove('text-green-600','text-yellow-600');
          cdText.classList?.add('text-red-600');
          cdText.classList?.remove('animate-pulse');
        }
        if (fpProgressOtp){
          fpProgressOtp.style.width = '0%';
          fpProgressOtp.classList.remove('bg-blue-600','bg-yellow-500');
          fpProgressOtp.classList.add('bg-red-600');
        }
        // Clear persisted expiry once expired
        try { sessionStorage.removeItem('fpOtpExpiry'); } catch(_){ }
        return;
      }
      if (fpCountdown) fpCountdown.textContent = `Expires in ${remaining}s`;
      if (cdText) cdText.textContent = `Expires in ${remaining}s`;
      if (fpProgressOtp){
        const pct = Math.max(0, Math.min(100, Math.round((remaining / sec) * 100)));
        fpProgressOtp.style.width = pct + '%';
      }
      // Color/animation thresholds
      if (remaining <= 30){
        if (fpCountdown){
          fpCountdown.classList.remove('text-green-600','text-yellow-600');
          fpCountdown.classList.add('text-red-600','animate-pulse');
        }
        if (cdText){
          cdText.classList?.remove('text-green-600','text-yellow-600');
          cdText.classList?.add('text-red-600','animate-pulse');
        }
        if (fpProgressOtp){
          fpProgressOtp.classList.remove('bg-blue-600','bg-yellow-500');
          fpProgressOtp.classList.add('bg-red-600');
        }
      } else if (remaining <= 120){
        if (fpCountdown){
          fpCountdown.classList.remove('text-green-600');
          fpCountdown.classList.add('text-yellow-600');
          fpCountdown.classList.remove('animate-pulse');
        }
        if (cdText){
          cdText.classList?.remove('text-green-600');
          cdText.classList?.add('text-yellow-600');
          cdText.classList?.remove('animate-pulse');
        }
        if (fpProgressOtp){
          fpProgressOtp.classList.remove('bg-blue-600');
          fpProgressOtp.classList.add('bg-yellow-500');
        }
      }
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
      // Persist expiry so countdown survives a refresh
      try { sessionStorage.setItem('fpOtpExpiry', String(Date.now() + 600*1000)); } catch(_){ }
      startOtpCountdown(600);
      try { updatePwMatch(); } catch(_){ }
      // Kickoff resend 30s cooldown
      startResendCooldown(30);
    } catch {
      setFpMsg('error','Network error. Try again.');
    } finally {
      setFpBusy(fpSendBtn, false, 'Sending…', 'Send OTP');
    }
  }

  async function verifyOtp(){
    setFpMsg('info','');
    const code = (fpOtpInput && fpOtpInput.value || getOtpString() || '').trim();
    if (!/^\d{6}$/.test(code)){
      setFpMsg('error','Please enter a valid 6-digit code.');
      otpErrorFeedback();
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
        try { sessionStorage.removeItem('fpOtpExpiry'); } catch(_){ }
        // Initialize match state/icons/button on entering reset step
        try { updatePwMatch(); } catch(_){ }
      } else {
        setFpMsg('error','Incorrect or expired code. Try again.');
        otpErrorFeedback();
        ariaAnnounce('Code incorrect or expired');
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
    const cpw = (fpConfirmPassword && fpConfirmPassword.value) || '';
    if (!npw || npw.length < 8){ setFpMsg('error','Password must be at least 8 characters.'); return; }
    if (cpw !== npw){ setFpMsg('error','Passwords do not match.'); return; }
    setFpBusy(fpResetBtn, true, 'Updating…', 'Reset Password');
    try {
      const fd = new FormData();
      fd.append('new_password', npw);
      const res = await fetchWithCSRF('/Super-Admin/auth/password-reset/confirm/', { method: 'POST', body: fd });
      const data = await res.json();
      if (data && data.ok && data.reset){
        // Show inline success for 4 seconds before returning to login
        setFpMsg('success','✔ Password reset successful. You can now sign in.');
        // Also show global toast
        showNotification('Password reset successful. Please sign in.', 'success');
        // Hold the panel visible briefly for confirmation
        setTimeout(() => {
          showStep(1);
          if (fpWrap) fpWrap.classList.add('hidden');
          // Re-enable login inputs so user can sign in with new password
          toggleLoginInputs(false);
          // Clear fields
          try { fpNewPassword.value = ''; fpConfirmPassword.value = ''; updatePwMatch(); } catch(_){ }
        }, 4000);
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
      // When panel is opened, hide/disable login password field and button to guide user
      const isOpen = !fpWrap.classList.contains('hidden');
      toggleLoginInputs(isOpen);
      if (isOpen){ try { updatePwMatch(); } catch(_){ } }
    });
  }
  if (fpSendBtn) fpSendBtn.addEventListener('click', (e)=>{ e.preventDefault(); requestOtp(); });
  if (fpVerifyBtn) fpVerifyBtn.addEventListener('click', (e)=>{ e.preventDefault(); verifyOtp(); });
  if (fpResetBtn) fpResetBtn.addEventListener('click', (e)=>{ e.preventDefault(); confirmReset(); });
  const _bindPwEvents = (el) => {
    if (!el) return;
    el.addEventListener('input', updatePwMatch);
    el.addEventListener('keyup', updatePwMatch);
    el.addEventListener('change', updatePwMatch);
    el.addEventListener('paste', ()=> setTimeout(updatePwMatch, 0));
  };
  _bindPwEvents(fpNewPassword);
  _bindPwEvents(fpConfirmPassword);

  // Clear all OTP boxes
  if (OTP.clearBtn) OTP.clearBtn.addEventListener('click', (e)=>{ e.preventDefault(); clearOtp(); });

  // Resend cooldown and click handler
  function setResendState(enabled, seconds){
    if (!fpResendBtn || !fpResendLabel) return;
    if (enabled){
      fpResendBtn.removeAttribute('disabled');
      fpResendBtn.classList.remove('cursor-not-allowed','opacity-60');
      fpResendLabel.textContent = 'Resend OTP';
    } else {
      fpResendBtn.setAttribute('disabled','disabled');
      if (!fpResendBtn.classList.contains('cursor-not-allowed')) fpResendBtn.classList.add('cursor-not-allowed');
      if (!fpResendBtn.classList.contains('opacity-60')) fpResendBtn.classList.add('opacity-60');
      fpResendLabel.textContent = `Resend in ${seconds}s`;
    }
  }
  function startResendCooldown(seconds){
    if (!fpResendBtn) return;
    let remain = seconds;
    if (resendCooldownTimer) clearInterval(resendCooldownTimer);
    setResendState(false, remain);
    resendCooldownTimer = setInterval(()=>{
      remain -= 1;
      if (remain <= 0){
        clearInterval(resendCooldownTimer); resendCooldownTimer = null;
        setResendState(true, 0);
      } else {
        setResendState(false, remain);
      }
    }, 1000);
  }
  if (fpResendBtn) fpResendBtn.addEventListener('click', async (e)=>{
    e.preventDefault();
    if (fpResendBtn.hasAttribute('disabled')) return;
    await requestOtp();
  });

  // Auto-run countdown on login.html if an unexpired OTP exists
  try {
    const raw = sessionStorage.getItem('fpOtpExpiry');
    const expiry = raw ? parseInt(raw, 10) : 0;
    const now = Date.now();
    if (expiry && expiry > now){
      const remainingMs = expiry - now;
      const remainingSec = Math.max(1, Math.floor(remainingMs / 1000));
      if (fpWrap){ fpWrap.classList.remove('hidden'); }
      showStep(2);
      initOtpBoxes();
      toggleLoginInputs(true);
      startOtpCountdown(remainingSec);
      // On page reload resume, ensure resend shows a short cooldown to prevent spam
      startResendCooldown(15);
    }
  } catch(_){ }
});
