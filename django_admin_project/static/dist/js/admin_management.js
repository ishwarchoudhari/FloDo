(()=>{(function(){function i(e,a){return(a||document).querySelector(e)}function j(e,a){return Array.prototype.slice.call((a||document).querySelectorAll(e))}function T(){try{if(typeof window.getCookie=="function"){let t=window.getCookie("csrftoken");if(t)return t}let e="csrftoken=",a=(document.cookie||"").split(";");for(let t=0;t<a.length;t++){let s=a[t].trim();if(s.startsWith(e))return decodeURIComponent(s.substring(e.length))}try{let t=document.querySelector('input[name="csrfmiddlewaretoken"]');if(t&&t.value)return String(t.value)}catch{}return""}catch{return""}}function g(e,a){window.showNotification&&window.showNotification(e,a||"info")}function b(e){let a=document.createElement("div");return a.textContent=String(e??""),a.innerHTML}let _=[],$=null,P=null;function R(e){try{return Array.prototype.slice.call(e.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"])')).filter(function(a){return a.offsetParent!==null||a===document.activeElement})}catch{return[]}}function H(e){try{let r=function(c){if(c.key!=="Tab")return;let u=R(e),f=u[0],m=u[u.length-1];!f||!m||(c.shiftKey?document.activeElement===f&&(c.preventDefault(),m.focus()):document.activeElement===m&&(c.preventDefault(),f.focus()))},n=function(c){if(!e.contains(c.target)){let u=R(e);u[0]&&u[0].focus()}};var a=r,t=n;if(!e||e._focusTrapHandlers)return;let s=R(e),o=s[0],d=s[s.length-1];document.addEventListener("keydown",r,!0),document.addEventListener("focusin",n,!0);try{o&&o.focus()}catch{}e._focusTrapHandlers={onKeydown:r,onFocusin:n}}catch{}}function O(e){try{if(!e||!e._focusTrapHandlers)return;let{onKeydown:a,onFocusin:t}=e._focusTrapHandlers;document.removeEventListener("keydown",a,!0),document.removeEventListener("focusin",t,!0),delete e._focusTrapHandlers}catch{}}function G(e){let a=i("#admin-add-portal");if(!a){g("Portal not found","error");return}a.classList.remove("pointer-events-none");let t=document.createElement("div");t.setAttribute("data-recover-host","");let s=(e.full_name||e.username||e.user_name||"").toString();t.innerHTML=`
      <div class="fixed inset-0 z-40 bg-black/40 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="w-[90vw] sm:w-full max-w-xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Recover Password">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 class="text-lg font-semibold">Recover Password</h3>
              <button type="button" class="text-gray-500 hover:text-gray-900 dark:hover:text-white text-2xl leading-none" data-cancel aria-label="Close">&times;</button>
            </div>
            <div class="px-6 py-5 space-y-5">
              <div class="rounded-lg p-3 border border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 text-sm">
                <strong class="font-semibold">Caution:</strong> Changing this password will immediately update the admin\u2019s credentials. Share the new password securely and ensure it meets your policy.
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div class="flex items-baseline gap-2"><span class="text-gray-500 dark:text-gray-400">ID:</span><span class="font-medium">${b(e.id)}</span></div>
                <div class="flex items-baseline gap-2"><span class="text-gray-500 dark:text-gray-400">Username:</span><span class="font-medium break-all">${b(e.user_name||"\u2014")}</span></div>
                <div class="flex items-baseline gap-2"><span class="text-gray-500 dark:text-gray-400">Name:</span><span class="font-medium break-all">${b(s)}</span></div>
                <div class="flex items-baseline gap-2"><span class="text-gray-500 dark:text-gray-400">City:</span><span class="font-medium">${b(e.city||"\u2014")}</span></div>
                <div class="flex items-baseline gap-2"><span class="text-gray-500 dark:text-gray-400">Phone:</span><span class="font-medium">${b(e.phone||"\u2014")}</span></div>
              </div>
              <div class="space-y-3">
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Enter new password</span>
                  <input type="password" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" data-new-pass autocomplete="new-password" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Confirm password</span>
                  <input type="password" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" data-confirm-pass autocomplete="new-password" />
                </label>
                <p class="text-xs text-gray-500 dark:text-gray-400">Minimum 12 characters, including upper, lower, digit, and symbol.</p>
                <p class="text-xs text-red-600 dark:text-red-400 hidden" data-error></p>
              </div>
              <div class="flex items-center justify-end gap-3">
                <button type="button" class="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700" data-cancel>Cancel</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" data-save disabled>Save</button>
              </div>
            </div>
          </div>
        </div>
      </div>`,a.appendChild(t),requestAnimationFrame(function(){let l=i("[data-overlay]",t),p=i(".transform",t);l&&l.classList.add("opacity-100"),p&&(p.classList.remove("scale-95","opacity-0"),p.classList.add("scale-100","opacity-100"))});let o=i("[data-overlay]",t),d=t.querySelector("[data-cancel]"),r=t.querySelector("[data-save]"),n=t.querySelector("[data-new-pass]"),c=t.querySelector("[data-confirm-pass]"),u=t.querySelector("[data-error]");function f(){try{O(t),t.remove()}catch{}}function m(){let l=i(".transform",t),p=i("[data-overlay]",t);p&&p.classList.remove("opacity-100"),l&&(l.classList.remove("scale-100","opacity-100"),l.classList.add("scale-95","opacity-0")),setTimeout(f,200)}function w(){try{let l=n.value||"",p=c.value||"",y=l.length>=12,h=/[A-Z]/.test(l),x=/[a-z]/.test(l),v=/\d/.test(l),k=/[^A-Za-z0-9]/.test(l),C=l===p&&l.length>0,E=y&&h&&x&&v&&k,S=E&&C;r&&(r.disabled=!S),!C&&(l||p)?(u.textContent="Passwords do not match.",u.classList.remove("hidden")):(l||"").length&&!E?(u.textContent="Password too weak. Follow the policy.",u.classList.remove("hidden")):(u.textContent="",u.classList.add("hidden"))}catch{}}n&&n.addEventListener("input",w),c&&c.addEventListener("input",w),o&&o.addEventListener("click",m);try{t.querySelectorAll("[data-cancel]").forEach(function(l){l.addEventListener("click",function(p){p.preventDefault(),p.stopPropagation(),m()})})}catch{d&&d.addEventListener("click",m)}document.addEventListener("keydown",function l(p){p.key==="Escape"&&(document.removeEventListener("keydown",l),m())}),r&&r.addEventListener("click",async function(){try{let l=n&&n.value||"",p=c&&c.value||"";if(!l||l!==p){g("Passwords must match","error");return}let y=r.innerHTML;r.disabled=!0,r.classList.add("opacity-70","cursor-wait"),r.innerHTML='<svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>Saving...';let h=new FormData;h.append("_method","PUT"),h.append("action","recover_password"),h.append("password",l);let x=()=>fetch(`/dashboard/api/admins/${e.id}/`,{method:"POST",headers:{"X-CSRFToken":T()},body:h}),v=await(window.withLoading?window.withLoading(x()):x()),k=null;try{k=await v.json()}catch{k=v.ok?{success:!0}:{success:!1}}if(v.ok&&k&&k.success){g(`Password changed for ${e.full_name||e.username||e.user_name||e.id}`,"success");try{typeof window.bumpNotificationsNow=="function"&&window.bumpNotificationsNow()}catch{}m()}else g(k&&k.error||`Failed (HTTP ${v.status})`,"error"),r.innerHTML=y,r.classList.remove("opacity-70","cursor-wait"),r.disabled=!1}catch{g("Network error","error"),r.innerHTML="Save",r.classList.remove("opacity-70","cursor-wait"),r.disabled=!1}});try{n&&n.focus()}catch{}H(t)}async function Q(e){let a=new URL("/dashboard/api/admins/",window.location.origin);e&&a.searchParams.set("q",e);try{try{P&&P.abort()}catch{}P=typeof AbortController<"u"?new AbortController:null;let t=await fetch(a,{headers:{"X-Requested-With":"XMLHttpRequest"},signal:P&&P.signal||void 0,cache:"no-store",credentials:"same-origin"});if(!t.ok)throw new Error("Failed to load admins");return t.json()}finally{try{P=null}catch{}}}function ee(e){try{let a=i("#admin-card-grid");if(a){let t=a.querySelector(`[data-id="${e}"]`);t&&t.remove()}}catch{}try{Array.isArray(_)&&(_=_.filter(function(a){return String(a&&a.id)!==String(e)}))}catch{}}function z(e){e=e||{};let a=e.title||"Confirm",t=e.message||"Are you sure?",s=e.confirmText||"Confirm",o=e.confirmClass||"bg-blue-600 hover:bg-blue-700",d=typeof e.onConfirm=="function"?e.onConfirm:null,r=i("#admin-add-portal");if(!r)return g("Portal not found","error"),Promise.resolve(!1);r.classList.remove("pointer-events-none");let n=document.createElement("div");return n.setAttribute("data-confirm-host",""),n.innerHTML=`
      <div class="fixed inset-0 z-[60] bg-black/50 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 z-[70] flex items-center justify-center p-3">
        <div class="w-full max-w-2xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-label="${b(a)}">
            <div class="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">${b(a)}</h3>
              <button type="button" class="text-gray-500 hover:text-gray-900 dark:hover:text-white" data-cancel aria-label="Close">&times;</button>
            </div>
            <div class="px-6 py-5">
              <p class="text-sm text-gray-700 dark:text-gray-300">${b(t)}</p>
              <div class="mt-6 flex items-center gap-3 justify-end">
                <button type="button" class="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 dark:text-gray-100" data-cancel>Cancel</button>
                <button type="button" class="px-4 py-2 rounded-lg text-white ${o}" data-confirm>${b(s)}</button>
              </div>
            </div>
          </div>
        </div>
      </div>`,r.appendChild(n),new Promise(function(c){requestAnimationFrame(function(){let p=i("[data-overlay]",n),y=i(".transform",n);p&&p.classList.add("opacity-100"),y&&(y.classList.remove("scale-95","opacity-0"),y.classList.add("scale-100","opacity-100"))});function u(p){let y=i("[data-overlay]",n),h=i(".transform",n);y&&y.classList.remove("opacity-100"),h&&(h.classList.remove("scale-100","opacity-100"),h.classList.add("scale-95","opacity-0")),setTimeout(function(){try{n.remove()}catch{}c(p)},200)}function f(p){p.key==="Escape"&&(document.removeEventListener("keydown",f),u(!1))}document.addEventListener("keydown",f);let m=i("[data-overlay]",n);m&&m.addEventListener("click",function(){document.removeEventListener("keydown",f),u(!1)});let w=n.querySelector("[data-cancel]"),l=n.querySelector("[data-confirm]");w&&w.addEventListener("click",function(){document.removeEventListener("keydown",f),u(!1)}),l&&l.addEventListener("click",async function(){if(document.removeEventListener("keydown",f),d)try{let p=l.innerHTML;l.disabled=!0,l.classList.add("opacity-70","cursor-wait","pointer-events-none"),l.innerHTML='<svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>'+b(s||"Please wait\u2026");let y=await d();l.innerHTML=p,l.classList.remove("opacity-70","cursor-wait","pointer-events-none"),l.disabled=!1,u(!!y);return}catch(p){console.error("Confirm onConfirm error:",p),g(p&&p.message?String(p.message):"Action failed","error"),u(!1);return}u(!0)});try{l&&l.focus()}catch{}H(n)})}function te(e,a){let t=i("#admin-add-portal");if(!t)return g("Portal not found","error"),Promise.resolve();try{a.classList.add("transition-all","duration-500","border-l-4","border-indigo-500")}catch{}t.classList.remove("pointer-events-none");let s=`
      <div class="fixed inset-0 z-40 bg-black/40 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="w-[90vw] sm:w-full max-w-xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-card text-card-foreground border-border bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Loading profile">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div class="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div class="px-6 py-8 space-y-6">
              <div class="grid sm:grid-cols-2 gap-6">
                <div class="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div class="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div class="h-4 w-44 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              <div class="pt-6 flex items-center gap-3 justify-center">
                <div class="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div class="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div class="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`,o=`
      <div class="fixed inset-0 z-40 bg-black/40 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="w-[90vw] sm:w-full max-w-xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-card text-card-foreground border-border bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Admin profile">
            <div class="px-6 py-2 relative border-b border-gray-100 dark:border-gray-700">
              <div class="grid grid-cols-3 items-center">
                <div class="justify-self-start text-2xl font-extrabold">${b(e.full_name||e.username)}</div>
                <div class="justify-self-center">
                  <span class="inline-flex items-center text-sm px-3 py-1.5 rounded-full ${e.status==="online"?"bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300":"bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}">${b(e.role||"Admin")} \u2022 ${e.status==="online"?"Online":"Offline"}</span>
                </div>
                <div class="justify-self-end flex items-center gap-2 relative">
                  <button type="button" class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-haspopup="menu" aria-expanded="false" aria-label="Options" data-menu-trigger>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  </button>
                  <div class="absolute right-0 top-10 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 hidden" data-menu>
                    <button class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" data-mode="edit">${N("edit")}<span>Edit</span></button>
                    <button class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" data-act="pause">${N("pause")}<span>Pause</span></button>
                    <button class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" data-act="delete">${N("trash")}<span>Delete</span></button>
                  </div>
                  <button type="button" class="p-1.5 rounded-full text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-3xl leading-none" title="Close" aria-label="Close" data-close>&times;</button>
                </div>
              </div>
            </div>
            <div class="px-6 py-8 space-y-8" data-view>
              ${e.updated_at?`<div class="text-xs text-gray-500 dark:text-gray-400">Last updated: ${D(new Date(e.updated_at))} ago</div>`:""}
              <div class="space-y-6">
                <div class="space-y-3">
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300">Personal Info</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">ID:</span><span class="text-base font-medium">${b(e.id)}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Username:</span><span class="text-base font-medium break-all">${b(e.user_name||"\u2014")}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Email:</span><span class="text-base font-medium break-all">${b(e.email||"\u2014")}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Phone:</span><span class="text-base font-medium">${b(e.phone||"\u2014")}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">City:</span><span class="text-base font-medium">${b(e.city||"\u2014")}</span></div>
                  </div>
                </div>
                <div class="space-y-3">
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300">Account Details</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Created:</span><span class="text-base font-medium">${e.date_joined?D(new Date(e.date_joined))+" ago":"\u2014"}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Updated:</span><span class="text-base font-medium">${e.updated_at?D(new Date(e.updated_at))+" ago":"\u2014"}</span></div>
                    <div class="flex items-baseline gap-2"><span class="text-sm text-gray-500 dark:text-gray-400">Password:</span><span class="text-base font-medium tracking-widest">********</span></div>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" data-extra-fields></div>
              </div>
              <div class="pt-6 flex flex-wrap items-center justify-center gap-3" data-actions>
                <button class="px-4 py-2 text-base rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 ring-offset-2 ring-blue-500 flex items-center gap-2" data-act="message" aria-label="Message">${N("chat")}<span>Message</span><span class="hidden md:inline"> (${b(e.user_name||e.username||"")})</span></button>
                <button class="px-4 py-2 text-base rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600" type="button" data-act="recover" aria-label="Recover Password">Recover Password</button>
              </div>
            </div>
            <form class="px-6 py-8 space-y-8 hidden" data-edit-form>
              <div class="space-y-6">
                <div class="space-y-3">
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300">Personal Info</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label class="block w-full text-base"><span class="block mb-1 text-sm text-gray-700 dark:text-gray-300">Name</span>
                      <input name="username" type="text" value="${b(e.full_name||e.username||"")}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" />
                    </label>
                    <label class="block w-full text-base"><span class="block mb-1 text-sm text-gray-700 dark:text-gray-300">City</span>
                      <input name="city" type="text" value="${b(e.city||"")}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" />
                    </label>
                    <label class="block w-full text-base"><span class="block mb-1 text-sm text-gray-700 dark:text-gray-300">Phone</span>
                      <input name="phone" type="tel" value="${b(e.phone||"")}" pattern="\\d{10}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" />
                    </label>
                    <label class="block w-full text-base md:col-span-2"><span class="block mb-1 text-sm text-gray-700 dark:text-gray-300">Role</span>
                      <select name="role" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                        <option value="admin" ${String(e.role||"").toLowerCase()==="admin"?"selected":""}>Admin</option>
                        <option value="user" ${String(e.role||"").toLowerCase()==="user"?"selected":""}>User</option>
                        <option value="super" ${String(e.role||"").toLowerCase()==="super"?"selected":""}>Super</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
              <div class="pt-2 grid grid-cols-2 gap-3">
                <button type="submit" class="px-4 py-2 text-base rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 ring-offset-2 ring-blue-500">Save</button>
                <button type="button" class="px-4 py-2 text-base rounded-lg bg-gray-200 dark:bg-gray-800 dark:text-gray-100" data-cancel>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>`;t.innerHTML=s,requestAnimationFrame(function(){let r=i("[data-overlay]",t),n=i(".transform",t);r&&r.classList.add("opacity-100"),n&&(n.classList.remove("scale-95","opacity-0"),n.classList.add("scale-100","opacity-100"))}),setTimeout(function(){t.innerHTML=o,requestAnimationFrame(function(){let r=i("[data-overlay]",t),n=i(".transform",t);r&&r.classList.add("opacity-100"),n&&(n.classList.remove("scale-95","opacity-0"),n.classList.add("scale-100","opacity-100"))});try{ae(e,t)}catch{}d()},120);function d(){function r(){let x=i("[data-overlay]",t),v=i(".transform",t);x&&x.classList.remove("opacity-100"),v&&(v.classList.remove("scale-100","opacity-100"),v.classList.add("scale-95","opacity-0"));try{a.classList.contains("border-indigo-500")&&(a.classList.remove("border-indigo-500"),a.classList.add("border-indigo-500/0"))}catch{}setTimeout(function(){t.innerHTML="",t.classList.add("pointer-events-none"),document.removeEventListener("keydown",n),O(t);try{a.classList.remove("border-l-4","border-indigo-500/0","transition-all","duration-500")}catch{}},200)}function n(x){x.key==="Escape"&&r()}document.addEventListener("keydown",n);let c=i("[data-overlay]",t);c&&c.addEventListener("click",r);let u=i("[data-close]",t);u&&u.addEventListener("click",r);let f=i("[data-menu-trigger]",t),m=i("[data-menu]",t),w=!1;function l(){!m||!f||(m.classList.add("hidden"),f.setAttribute("aria-expanded","false"),w=!1)}function p(x){if(!m||!f)return;x&&x.preventDefault(),m.classList.contains("hidden")?(m.classList.remove("hidden"),f.setAttribute("aria-expanded","true"),w=!0):l()}f&&m&&(f.addEventListener("click",p),document.addEventListener("click",function(v){if(!w)return;let k=v.target;f.contains(k)||m.contains(k)||l()}),document.addEventListener("keydown",function(v){v.key==="Escape"&&l()}));let y=i("[data-view]",t),h=i("[data-edit-form]",t);t.addEventListener("click",function(x){let v=x.target&&x.target.closest("[data-act], [data-mode]");if(x.target&&x.target.closest("[data-cancel]")){y&&h&&(h.classList.add("hidden"),y.classList.remove("hidden"));try{B(!1)}catch{}x.preventDefault();return}if(!v)return;x.preventDefault();let C=v.getAttribute("data-act"),E=v.getAttribute("data-mode");try{let L=i("[data-menu]",t);L&&L.classList.add("hidden");let q=i("[data-menu-trigger]",t);q&&q.setAttribute("aria-expanded","false")}catch{}if(!(h&&!h.classList.contains("hidden")&&v.hasAttribute("data-disabled-when-edit"))){if(C==="message"){r(),openMessageOverlay(e).catch(()=>{});return}if(C==="delete"){z({title:"Delete Admin",message:"This will permanently delete the admin from the database and cannot be undone. Are you sure?",confirmText:"Delete",confirmClass:"bg-red-600 hover:bg-red-700",onConfirm:async function(){try{let L=await J(e.id,(e.full_name||e.username||e.user_name||"").toString());return L&&r(),L}catch(L){return console.error("Delete error:",L),g("Delete failed","error"),!1}}});return}if(C==="pause"){r(),K(e.id).catch(()=>{});return}if(C==="recover"){G(e);return}if(E==="edit"&&y&&h){y.classList.add("hidden"),h.classList.remove("hidden");try{B(!0)}catch{}let L=h.querySelector("input,select,textarea");try{L&&L.focus()}catch{}}}}),h&&h.addEventListener("submit",async function(x){x.preventDefault();let v=new FormData(h);v.append("_method","PUT");let k=(v.get("phone")||"").toString().trim();if(k&&!/^\d{10}$/.test(k)){g("Phone must be exactly 10 digits","error");return}let C=()=>fetch(`/dashboard/api/admins/${e.id}/`,{method:"POST",headers:{"X-CSRFToken":T(),"X-Requested-With":"XMLHttpRequest"},credentials:"same-origin",body:v}),E=await(window.withLoading?window.withLoading(C()):C()),S=null;try{S=await E.json()}catch{if(!E.ok){g(`Update failed (HTTP ${E.status})`,"error");return}}if(E.ok&&S&&S.success){g("Admin updated","success");try{typeof window.bumpNotificationsNow=="function"&&window.bumpNotificationsNow()}catch{}r(),await A()}else g(S&&S.error||`Update failed${E.ok?"":` (HTTP ${E.status})`}`,"error")}),H(t)}return Promise.resolve()}function B(e){try{let a=i("#admin-add-portal");if(!a)return;a.querySelectorAll("[data-disabled-when-edit]").forEach(function(s){e?(s.setAttribute("aria-disabled","true"),s.setAttribute("disabled","disabled"),s.classList.add("opacity-50","pointer-events-none","cursor-not-allowed")):(s.removeAttribute("aria-disabled"),s.removeAttribute("disabled"),s.classList.remove("opacity-50","pointer-events-none","cursor-not-allowed"))})}catch{}}function ae(e,a){let t=i("[data-extra-fields]",a);if(!t||!e||typeof e!="object")return;let s=new Set(["id","user_name","username","full_name","email","phone","city","role","status","is_active","date_joined","created_at","updated_at","message_preview","tickets_solved","last_login","created_by","role_approved_by"]),o=Object.keys(e).filter(function(r){return!s.has(r)}).sort();if(!o.length)return;let d=document.createDocumentFragment();o.forEach(function(r){let n=e[r];if(n===null||typeof n>"u"||typeof n=="string"&&n.trim()==="")return;let c=re(r,n),u=document.createElement("div");u.className="flex items-center gap-2";let f=document.createElement("span");f.className="text-gray-500 dark:text-gray-400",f.textContent=r.replace(/_/g," ").replace(/\b\w/g,w=>w.toUpperCase())+":";let m=document.createElement("span");m.className="font-medium break-all",m.textContent=c,u.appendChild(f),u.appendChild(m),d.appendChild(u)}),t.appendChild(d)}function re(e,a){try{if(typeof a=="boolean")return a?"Yes":"No";if(typeof a=="number")return String(a);if(a&&typeof a=="object"){if(Array.isArray(a))return a.join(", ");let s=JSON.stringify(a);return s.length>120?s.slice(0,117)+"...":s}let t=String(a);if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(t))try{return D(new Date(t))+" ago"}catch{return t}return t}catch{return String(a)}}async function se(e){let a=await fetch(e,{headers:{"X-Requested-With":"XMLHttpRequest"}});if(!a.ok)throw new Error("Request failed");return a.json()}function ne(e){try{let u=function(f,m){let w=document.createElement("span");return w.className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full "+m,w.textContent=f,w};var a=u;let t=i("#admin-summary");if(!t)return;let s=Array.isArray(e)?e:[],o=s.length,d=s.filter(function(f){return String(f.status||"").toLowerCase()==="online"}).length,r=s.filter(function(f){return!!f.is_active}).length,n=o-r,c=document.createDocumentFragment();c.appendChild(u(`Total: ${o}`,"bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300")),c.appendChild(u(`Online: ${d}`,"bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300")),c.appendChild(u(`Active: ${r}`,"bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")),c.appendChild(u(`Paused: ${n}`,"bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300")),t.innerHTML="",t.appendChild(c)}catch{}}function X(e){let a=i("#admin-card-grid"),t=i("#admin-count");if(!a)return;let s=document.createDocumentFragment();s.appendChild(oe());let o=Array.isArray(e)?e:[],d=o.filter(function(n){return!!n.is_active}),r=o.filter(function(n){return!n.is_active});d.length&&s.appendChild(W("Active")),d.forEach(function(n){s.appendChild(U(n))}),r.length&&s.appendChild(W("Disabled")),r.forEach(function(n){s.appendChild(U(n))}),a.innerHTML="",a.appendChild(s),t&&(t.textContent=`${(e||[]).length} admin(s)`),ne(e),I(a),ue()}function W(e){let a=document.createElement("div");return a.setAttribute("data-role","section-header"),a.className="col-span-full flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 mt-2 mb-1",a.innerHTML=`
      <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M7 5l5 5-5 5" />
      </svg>
      <span>${b(String(e||""))}</span>
    `,a}function I(e){try{let a=i('[data-role="load-more-container"]',e.parentElement||e);if(a&&a.remove(),!$)return;let t=document.createElement("div");t.setAttribute("data-role","load-more-container"),t.className="flex justify-center mt-4";let s=document.createElement("button");s.className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm",s.type="button",s.textContent="Load more",s.addEventListener("click",function(){ce().catch(()=>{})}),t.appendChild(s),e.parentElement.appendChild(t)}catch{}}function oe(){let e=document.createElement("div");return e.className="group relative bg-white dark:bg-gray-900 dark:border-gray-700 rounded-xl shadow-sm border hover:shadow-md transition p-4 flex items-center justify-center min-h-[180px]",e.innerHTML=`
      <button type="button" class="w-full h-full flex flex-col items-center justify-center text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white" data-act="add-open">
        <svg class="w-12 h-12" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        <span class="mt-2 text-sm">Add New Admin</span>
      </button>
    `,e.querySelector('[data-act="add-open"]').addEventListener("click",function(){ie()}),e}function ie(){let e=i("#admin-add-portal");if(!e){g("Portal not found","error");return}e.classList.remove("pointer-events-none"),e.innerHTML=`
      <div class="fixed inset-0 bg-black/40 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <div class="w-full max-w-xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div class="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
              <h3 class="text-lg font-semibold">Add New Admin</h3>
              <div class="flex items-center gap-3">
                <button type="button" class="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-gray-800" data-toggle-theme>Toggle Theme</button>
                <button type="button" class="text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Close" data-close>&times;</button>
              </div>
            </div>
            <form class="px-5 py-4 space-y-4" data-add-form>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Name</span>
                  <input name="username" type="text" required class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="Jane Admin" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">City</span>
                  <input name="city" type="text" required class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="Pune" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Phone</span>
                  <input name="phone" type="tel" required pattern="\\d{10}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="10 digits" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Password</span>
                  <input name="password" type="password" required class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="Strong password" />
                </label>
                <label class="block text-sm sm:col-span-2">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Role</span>
                  <select name="role" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                    <option value="super">Super</option>
                  </select>
                </label>
              </div>
              <div class="flex items-center gap-3 pt-2">
                <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 ring-offset-2 ring-blue-500">Create</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 dark:text-gray-100" data-close>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `,requestAnimationFrame(function(){let d=i("[data-overlay]",e),r=i(".transform",e);d&&d.classList.add("opacity-100"),r&&(r.classList.remove("scale-95","opacity-0"),r.classList.add("scale-100","opacity-100"))}),j("[data-close]",e).forEach(function(d){d.addEventListener("click",M)});let t=i("[data-overlay]",e);t&&t.addEventListener("click",M),document.addEventListener("keydown",V);let s=i("[data-toggle-theme]",e);s&&s.addEventListener("click",function(){try{let r=document.documentElement.classList.contains("dark")?"light":"dark";localStorage.setItem("theme",r),document.documentElement.classList.toggle("dark",r==="dark")}catch{}});let o=i("[data-add-form]",e);o&&o.addEventListener("submit",de),H(e)}function V(e){e.key==="Escape"&&M()}function M(){let e=i("#admin-add-portal");if(!e)return;let a=i("[data-overlay]",e),t=i(".transform",e);a&&a.classList.remove("opacity-100"),t&&(t.classList.remove("scale-100","opacity-100"),t.classList.add("scale-95","opacity-0")),setTimeout(function(){e.innerHTML="",e.classList.add("pointer-events-none"),document.removeEventListener("keydown",V),O(e)},200)}async function de(e){e.preventDefault();let a=e.currentTarget,t=new FormData(a);try{t.append("csrfmiddlewaretoken",T())}catch{}let s=(t.get("phone")||"").toString().trim();if(!/^\d{10}$/.test(s)){g("Phone must be exactly 10 digits","error");return}let o=()=>fetch("/dashboard/api/admins/",{method:"POST",headers:{"X-CSRFToken":T(),"X-Requested-With":"XMLHttpRequest"},credentials:"same-origin",body:t}),d=await(window.withLoading?window.withLoading(o()):o()),r=null;try{r=await d.json()}catch{if(!d.ok){g(`Create failed (HTTP ${d.status})`,"error");return}}if(d.ok&&r&&r.success){g("Admin created","success");try{typeof window.bumpNotificationsNow=="function"&&window.bumpNotificationsNow()}catch{}M(),await A()}else{let n="Create failed";r&&r.error?n=r.error:d.ok||(n=`Create failed (HTTP ${d.status})`),g(n,"error")}}function U(e){let a=e.status==="online"?"Online":"Offline",t=document.createElement("div");t.className="bg-white dark:bg-gray-900 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl shadow-sm border hover:shadow-md hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-indigo-500 transition transition-transform p-4 flex flex-col",t.setAttribute("data-id",String(e.id));let s=(e.user_name||e.username||"").toString();return t.innerHTML=`
      <div class="flex items-start justify-between">
        <div>
          <div class="text-xs text-gray-500 dark:text-gray-400">ID #${e.id}</div>
          <h3 class="text-lg font-semibold">${b(e.full_name||e.username)}</h3>
          <div class="text-xs text-gray-500 dark:text-gray-400">${b(e.role||"Admin")}</div>
        </div>
        <div class="text-xs sm:text-sm font-medium">
          <span class="inline-flex items-center px-2.5 py-1 rounded-full ${e.status==="online"?"bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300":"bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}" title="${a}">
            ${e.status==="online"?Z("green"):Z("red")}
            <span class="ml-1 hidden sm:inline">${a}</span>
          </span>
          <span class="block mt-1 text-center ${e.is_active?"text-green-700 dark:text-green-400":"text-gray-500 dark:text-gray-400"}">${e.is_active?"Active":"Disabled"}</span>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2 text-sm">
        <div class="flex items-center gap-2"><span class="text-gray-500 dark:text-gray-400">Phone:</span><span class="font-medium">${b(e.phone||"\u2014")}</span></div>
      </div>
      <div class="mt-4 flex items-center gap-2">
        <button class="px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-[0.95rem] rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 ring-offset-2 ring-blue-500 flex items-center gap-2" data-act="message" title="Message" aria-label="Message">
          ${N("chat")}<span class="hidden xs:inline">Message</span><span class="hidden md:inline"> (${b(s)})</span>
        </button>
      </div>
    `,t.addEventListener("click",function(o){let d=o.target&&o.target.closest("[data-act]"),r=e.id;if(d){let n=d.getAttribute("data-act");n==="message"?openMessageOverlay(e).catch(()=>{}):n==="edit"?le(e).catch(()=>{}):n==="delete"?z({title:"Delete Admin",message:"This will permanently delete the admin from the database and cannot be undone. Are you sure?",confirmText:"Delete",confirmClass:"bg-red-600 hover:bg-red-700"}).then(async function(c){if(c)try{await J(r,(e.full_name||e.username||e.user_name||"").toString())}catch{}}):n==="pause"?K(r).catch(()=>{}):n==="recover"&&g("Recover Password is not available in frontend-only mode.","warning");return}te(e,t).catch(()=>{})}),t}async function fe(e){}function le(e){let a=i("#admin-add-portal");if(!a)return g("Portal not found","error"),Promise.resolve();a.classList.remove("pointer-events-none"),a.innerHTML=`
      <div class="fixed inset-0 bg-black/40 opacity-0 transition-opacity duration-200" data-overlay></div>
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <div class="w-full max-w-xl transform scale-95 opacity-0 transition-all duration-200">
          <div class="bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div class="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
              <h3 class="text-lg font-semibold">Edit Admin #${e.id}</h3>
              <button type="button" class="text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Close" data-close>&times;</button>
            </div>
            <form class="px-5 py-4 space-y-4" data-edit-form>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Name</span>
                  <input name="username" type="text" value="${b(e.full_name||e.username||"")}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">City</span>
                  <input name="city" type="text" value="" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="Leave blank to keep" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Phone</span>
                  <input name="phone" type="tel" value="${b(e.phone||"")}" pattern="\\d{10}" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" />
                </label>
                <label class="block text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">New Password</span>
                  <input name="password" type="password" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700" placeholder="Leave blank to keep" />
                </label>
                <label class="block text-sm sm:col-span-2">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">Role</span>
                  <select name="role" class="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                    <option value="admin" ${String(e.role||"").toLowerCase()==="admin"?"selected":""}>Admin</option>
                    <option value="user" ${String(e.role||"").toLowerCase()==="user"?"selected":""}>User</option>
                    <option value="super" ${String(e.role||"").toLowerCase()==="super"?"selected":""}>Super</option>
                  </select>
                </label>
              </div>
              <div class="flex items-center gap-3 pt-2">
                <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 ring-offset-2 ring-blue-500">Save</button>
                <button type="button" class="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 dark:text-gray-100" data-close>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `,requestAnimationFrame(function(){let s=i("[data-overlay]",a),o=i(".transform",a);s&&s.classList.add("opacity-100"),o&&(o.classList.remove("scale-95","opacity-0"),o.classList.add("scale-100","opacity-100"))}),j("[data-close]",a).forEach(function(s){s.addEventListener("click",M)});let t=i("[data-edit-form]",a);return t&&t.addEventListener("submit",async function(s){s.preventDefault();let o=new FormData(t);try{o.append("csrfmiddlewaretoken",T())}catch{}o.append("_method","PUT");let d=(o.get("phone")||"").toString().trim();if(d&&!/^\d{10}$/.test(d)){g("Phone must be exactly 10 digits","error");return}let r=()=>fetch(`/dashboard/api/admins/${e.id}/`,{method:"POST",headers:{"X-CSRFToken":T(),"X-Requested-With":"XMLHttpRequest"},credentials:"same-origin",body:o}),n=await(window.withLoading?window.withLoading(r()):r()),c=null;try{c=await n.json()}catch{if(!n.ok){g(`Update failed (HTTP ${n.status})`,"error");return}}n.ok&&c&&c.success?(g("Admin updated","success"),M(),await A()):g(c&&c.error||`Update failed${n.ok?"":` (HTTP ${n.status})`}`,"error")}),H(a),Promise.resolve()}async function J(e,a){let t=new FormData;try{t.append("csrfmiddlewaretoken",T())}catch{}t.append("_method","DELETE");let s=()=>fetch(`/dashboard/api/admins/${e}/`,{method:"POST",headers:{"X-CSRFToken":T(),"X-Requested-With":"XMLHttpRequest"},credentials:"same-origin",body:t}),o=await(window.withLoading?window.withLoading(s()):s()),d=null;try{d=await o.json()}catch{if(!o.ok)return g(`Delete failed (HTTP ${o.status})`,"error"),!1}if(!(o.ok&&d&&d.success))try{o=await fetch(`/dashboard/api/admins/${e}/`,{method:"DELETE",headers:{"X-CSRFToken":T()},credentials:"same-origin"});try{d=await o.json()}catch{if(!o.ok)return g(`Delete failed (HTTP ${o.status})`,"error"),!1}}catch{return g("Delete failed","error"),!1}if(o.ok&&d&&d.success){let r=(a||"").toString().trim();g(`Admin/user ${r||e} Deleted Successfully`,"success");try{typeof window.bumpNotificationsNow=="function"&&window.bumpNotificationsNow()}catch{}try{ee(e)}catch{}return await A(),!0}else{let r="Delete failed";return d&&d.error?r=d.error:o.ok||(r=`Delete failed (HTTP ${o.status})`),g(r,"error"),!1}}async function K(e){if(!await z({title:"Pause Admin",message:"Are you sure you want to pause this admin?",confirmText:"Pause",confirmClass:"bg-yellow-600 hover:bg-yellow-700"}))return;let a=new FormData;try{a.append("csrfmiddlewaretoken",T())}catch{}a.append("_method","PUT"),a.append("action","pause");let t=()=>fetch(`/dashboard/api/admins/${e}/`,{method:"POST",headers:{"X-CSRFToken":T(),"X-Requested-With":"XMLHttpRequest"},credentials:"same-origin",body:a}),s=await(window.withLoading?window.withLoading(t()):t()),o=null;try{o=await s.json()}catch{if(!s.ok){g(`Pause failed (HTTP ${s.status})`,"error");return}}if(s.ok&&o&&o.success){g("Admin paused","success");try{typeof window.bumpNotificationsNow=="function"&&window.bumpNotificationsNow()}catch{}await A()}else g(o&&o.error||`Pause failed${s.ok?"":` (HTTP ${s.status})`}`,"error")}async function A(){let e=i("#admin-card-grid");e&&Y(e,8);let a=i("#admin-search")&&i("#admin-search").value.trim()||"";_=[],$=null;let t=await Q(a);t&&(Array.isArray(t.results)||typeof t.results=="object")?(_=(t.results||[]).slice(),$=t.next||null,X(_)):t&&t.success?(_=(t.results||[]).slice(),$=null,X(_)):(_=(Array.isArray(t)?t:[]).slice(),$=null,X(_))}async function ce(){if($)try{let e=i("#admin-card-grid");e&&Y(e,4);let a=await se($),t=a&&a.results?a.results:[];$=a&&a.next?a.next:null,_=_.concat(t);let s=document.createDocumentFragment();(t||[]).forEach(function(o){s.appendChild(U(o))}),e&&(e.appendChild(s),I(e))}catch{g("Failed to load more","error")}}let F=null;function ue(){F&&(clearInterval(F),F=null),F=setInterval(function(){j("[data-last-login]").forEach(function(e){let a=e.getAttribute("data-last-login");if(!a){e.textContent="\u2014";return}let t=new Date(a);if(isNaN(t.getTime())){e.textContent="\u2014";return}e.textContent=D(t)})},1e3)}function D(e){let t=Math.max(0,Math.floor((new Date-e)/1e3)),s=Math.floor(t/3600),o=Math.floor(t%3600/60),d=t%60,r=[];return s&&r.push(s+"h"),(s||o)&&r.push(o+"m"),r.push(d+"s"),r.join(" ")}function pe(){let e=i("#admin-mgmt-root");if(!e||e.getAttribute("data-initialized")==="1")return;let a=i("#admin-refresh");a&&a.addEventListener("click",function(){A().catch(()=>{})});let t=i("#admin-search");t&&t.addEventListener("input",ge(function(){A().catch(()=>{})},250)),e.setAttribute("data-initialized","1"),A().catch(function(){g("Failed to load admins","error")}),e._poller||(e._poller=setInterval(function(){A().catch(()=>{})},6e4));try{if(!e._ws_init){let w=function(){let y=u;u=Math.min(f,Math.floor(u*1.8)),setTimeout(p,y)},l=function(){let y=Date.now();y-m<800||(m=y,A().catch(()=>{}))},p=function(){try{c=new WebSocket(n),c.onopen=function(){u=1e3;try{e._poller&&(clearInterval(e._poller),e._poller=null)}catch{}try{window.__adminMgmtWS=c}catch{}},c.onmessage=function(y){try{let h=JSON.parse(y.data||"{}");if(h&&h.type==="activity_log"){let v=((h.data||{}).table_name||"").toString();(v==="Table1"||/admin/i.test(v))&&l()}}catch{}},c.onerror=function(){},c.onclose=function(){try{e._poller||(e._poller=setInterval(function(){A().catch(()=>{})},6e4))}catch{}try{window.__adminMgmtWS===c&&(window.__adminMgmtWS=null)}catch{}w()}}catch{w()}};var s=w,o=l,d=p;e._ws_init=!0;let n=`${location.protocol==="https:"?"wss":"ws"}://${location.host}/ws/notifications/`,c=null,u=1e3,f=2e4,m=0;setTimeout(p,300)}}catch{}}function ge(e,a){let t;return function(){let s=this,o=arguments;clearTimeout(t),t=setTimeout(function(){e.apply(s,o)},a)}}window.initAdminManagement=function(){try{pe()}catch{}};function Z(e){return`<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${e==="green"?"text-green-600":"text-red-600"}" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="10" cy="10" r="6" /></svg>`}function N(e){switch(e){case"chat":return'<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 5.75A2.75 2.75 0 014.75 3h14.5A2.75 2.75 0 0122 5.75v8.5A2.75 2.75 0 0119.25 17H8.664l-3.66 3.05A1 1 0 013 19.25V17H4.75A2.75 2.75 0 012 14.25v-8.5z"/></svg>';case"edit":return'<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>';case"trash":return'<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 7h12v2H6V7zm1 3h10l-1 10H8L7 10zm3-5h4v2h-4V5z"/></svg>';case"pause":return'<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';default:return""}}function Y(e,a){try{let t=document.createDocumentFragment();for(let s=0;s<a;s++){let o=document.createElement("div");o.className="rounded-xl border shadow-sm p-4 bg-white dark:bg-gray-900 dark:border-gray-700 animate-pulse",o.innerHTML=`
          <div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div class="mt-3 space-y-2">
            <div class="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2">
            <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>`,t.appendChild(o)}e.innerHTML="",e.appendChild(t)}catch{}}})();})();
//# sourceMappingURL=admin_management.js.map
