// Dashboard Artist Applications: lightweight modal controller (no dependencies)
(() => {
  // Smooth expand/collapse utility for details panels
  function expandSection(el) {
    if (!el) return;
    el.classList.remove('hidden');
    el.style.overflow = 'hidden';
    el.style.maxHeight = '0px';
    // Force layout
    void el.offsetHeight; // reflow
    const target = el.scrollHeight;
    el.style.transition = 'max-height 300ms ease';
    el.style.maxHeight = target + 'px';
    function onEnd() {
      el.style.maxHeight = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.removeEventListener('transitionend', onEnd);
    }
    el.addEventListener('transitionend', onEnd);
  }
  function collapseSection(el) {
    if (!el || el.classList.contains('hidden')) return;
    el.style.overflow = 'hidden';
    const start = el.scrollHeight;
    el.style.maxHeight = start + 'px';
    // Force layout
    void el.offsetHeight;
    el.style.transition = 'max-height 250ms ease';
    el.style.maxHeight = '0px';
    function onEnd() {
      el.classList.add('hidden');
      el.style.maxHeight = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.removeEventListener('transitionend', onEnd);
    }
    el.addEventListener('transitionend', onEnd);
  }

  function setLinkedVisibility(detailsId, open) {
    const selector = `[data-details-footer="${detailsId}"]`;
    document.querySelectorAll(selector).forEach((node) => {
      if (open) node.classList.remove('hidden'); else node.classList.add('hidden');
    });
    const selector2 = `[data-details-actions="${detailsId}"]`;
    document.querySelectorAll(selector2).forEach((node) => {
      if (open) node.classList.remove('hidden'); else node.classList.add('hidden');
    });
  }

  function closeOtherAccordions(exceptId) {
    document.querySelectorAll('[id^="details-"]').forEach((panel) => {
      if (panel.id !== exceptId && !panel.classList.contains('hidden')) {
        collapseSection(panel);
        setLinkedVisibility(panel.id, false);
        const btn = document.querySelector(`[data-toggle="${panel.id}"]`);
        if (btn) btn.setAttribute('aria-expanded', 'false');
        const icon = btn && btn.querySelector('svg');
        if (icon) icon.style.transform = 'rotate(0deg)';
      }
    });
  }
  function openModal(el) {
    el.classList.remove('hidden');
    el.classList.add('flex');
    document.body.classList.add('overflow-hidden');
  }
  function closeModal(el) {
    el.classList.add('hidden');
    el.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
  }
  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-modal-open]');
    if (openBtn) {
      const id = openBtn.getAttribute('data-modal-open');
      const modal = document.getElementById(id);
      if (modal) openModal(modal);
      return;
    }
    const closeBtn = e.target.closest('[data-modal-close]');
    if (closeBtn) {
      const modal = closeBtn.closest('[data-modal]');
      if (modal) closeModal(modal);
      return;
    }
    const modalEl = e.target.closest('[data-modal]');
    if (modalEl && (e.target === modalEl || e.target.closest('[data-modal-overlay]'))) {
      // click on the dark overlay or on the overlay container
      closeModal(modalEl);
    }

    // Copy-to-clipboard buttons
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      const text = copyBtn.getAttribute('data-copy');
      if (text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(() => {});
        } else {
          const t = document.createElement('textarea');
          t.value = text;
          document.body.appendChild(t);
          t.select();
          try { document.execCommand('copy'); } catch (_) {}
          document.body.removeChild(t);
        }
        copyBtn.classList.add('ring-1','ring-emerald-300');
        setTimeout(() => copyBtn.classList.remove('ring-1','ring-emerald-300'), 500);
      }
      return;
    }

    // 'Open' toggle for details (accordion)
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      const id = toggle.getAttribute('data-toggle');
      const target = document.getElementById(id);
      if (target) {
        const isOpen = !target.classList.contains('hidden');
        if (isOpen) {
          collapseSection(target);
          setLinkedVisibility(id, false);
          toggle.setAttribute('aria-expanded', 'false');
          const icon = toggle.querySelector('svg');
          if (icon) icon.style.transform = 'rotate(0deg)';
        } else {
          closeOtherAccordions(id);
          expandSection(target);
          setLinkedVisibility(id, true);
          toggle.setAttribute('aria-expanded', 'true');
          const icon = toggle.querySelector('svg');
          if (icon) icon.style.transform = 'rotate(180deg)';
          // Scroll the card into view smoothly without jumping header
          const card = toggle.closest('.group');
          if (card && 'scrollIntoView' in card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
    }
  });

  // Sticky tabs shadow on scroll + refresh spinner
  const tabsBar = document.getElementById('apps-tabs-bar');
  if (tabsBar) {
    const onScroll = () => {
      const scrolled = window.scrollY > 0;
      tabsBar.classList.toggle('shadow-sm', scrolled);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const refreshLink = document.getElementById('appsRefresh');
  if (refreshLink) {
    refreshLink.addEventListener('click', () => {
      const spinner = refreshLink.querySelector('[data-spinner]');
      if (spinner) spinner.classList.remove('hidden');
    });
  }
})();
