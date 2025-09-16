// static/js/auth_signup.js
// Handles the signup form submission with basic client validation.
(function(){
  // Discover important URLs from meta tags to avoid inline scripts
  try {
    if (!window.__loginUrl) {
      var meta = document.getElementById('auth-urls');
      if (meta) { window.__loginUrl = meta.getAttribute('data-login-url') || window.__loginUrl; }
    }
  } catch(_){}
  function isValidEmail(email){
    try { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase()); } catch(_) { return false; }
  }
  function onSubmit(e){
    e.preventDefault();
    var form = e.target;
    var msg = document.getElementById('signupMsg');
    if (msg) { msg.className = 'mt-3 text-sm'; msg.textContent = ''; }

    var data = new FormData(form);
    var username = (data.get('username')||'').toString().trim();
    var email = (data.get('email')||'').toString().trim();
    var pw = (data.get('password')||'').toString();
    var pwc = (data.get('password_confirm')||'').toString();

    if (!username || !email || !pw || !pwc){
      if (msg) { msg.className = 'mt-3 text-sm text-red-700 dark:text-red-400'; msg.textContent = 'Please fill in all fields.'; }
      return;
    }
    if (!isValidEmail(email)){
      if (msg) { msg.className = 'mt-3 text-sm text-red-700 dark:text-red-400'; msg.textContent = 'Please enter a valid email address.'; }
      return;
    }
    if (pw !== pwc){
      if (msg) { msg.className = 'mt-3 text-sm text-red-700 dark:text-red-400'; msg.textContent = 'Passwords do not match.'; }
      return;
    }
    var p = (typeof window.signupUser === 'function') ? window.signupUser(data) : Promise.resolve({ success:false, error:'signupUser() not available'});
    p.then(function(res){
      if (res && res.success){
        if (msg) { msg.className = 'mt-3 text-sm text-green-700 dark:text-green-400'; msg.textContent = 'Account created. Please sign in.'; }
        try { window.location.href = (window.__loginUrl || '/auth/login/'); } catch(_) {}
      } else {
        var err = (res && (res.error || (res.errors && JSON.stringify(res.errors)))) || 'Signup failed';
        if (msg) { msg.className = 'mt-3 text-sm text-red-700 dark:text-red-400'; msg.textContent = err; }
      }
    }).catch(function(){ if (msg) { msg.className = 'mt-3 text-sm text-red-700 dark:text-red-400'; msg.textContent = 'Network error'; } });
  }

  function init(){
    var form = document.getElementById('signupForm');
    if (form && !form.__bound){ form.addEventListener('submit', onSubmit); form.__bound = true; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
