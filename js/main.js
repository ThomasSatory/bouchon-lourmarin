(() => {
  document.documentElement.classList.add('js');
  const nav = document.getElementById('nav');
  const burger = nav.querySelector('.nav__burger');
  const mobile = document.getElementById('mobileMenu');

  // Scrolled state
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu toggle
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    mobile.hidden = !open;
  });
  mobile.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      nav.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      mobile.hidden = true;
    }
  });

  // Reveal on scroll (with safety fallback)
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-in'));
  }
  setTimeout(() => {
    document.querySelectorAll('.reveal:not(.is-in)').forEach(el => el.classList.add('is-in'));
  }, 2000);

  // Duplicate strip track for seamless marquee
  const track = document.querySelector('.strip__track');
  if (track) {
    track.innerHTML += track.innerHTML;
  }

  // Year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // ----- Dynamic content: photos, map, news -----
  const formatFrenchDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d)) return iso;
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return iso; }
  };

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const applySiteConfig = (site) => {
    if (!site) return;
    // Photos overrides
    if (site.photos) {
      document.querySelectorAll('[data-photo-key]').forEach(img => {
        const key = img.getAttribute('data-photo-key');
        if (site.photos[key]) img.src = site.photos[key];
      });
    }
    // Map / address
    if (site.map) {
      document.querySelectorAll('[data-map-field]').forEach(el => {
        const f = el.getAttribute('data-map-field');
        if (site.map[f]) el.textContent = site.map[f];
      });
      if (site.map.mapsUrl) {
        const mapLink = document.getElementById('mapLink');
        const footerMap = document.getElementById('footerMapLink');
        if (mapLink) mapLink.href = site.map.mapsUrl;
        if (footerMap) footerMap.href = site.map.mapsUrl;
      }
    }
    // Hours
    if (Array.isArray(site.hours) && site.hours.length) {
      const list = document.getElementById('hoursList');
      if (list) {
        list.innerHTML = site.hours.map(h => {
          const parts = String(h.value || '').split('·').map(s => s.trim()).filter(Boolean);
          const spans = (parts.length ? parts : ['']).map(p => `<span>${escapeHtml(p)}</span>`).join('');
          return `
          <div${h.closed ? ' class="hours__closed"' : ''}>
            <dt>${escapeHtml(h.days || '')}</dt>
            <dd>${spans}</dd>
          </div>`;
        }).join('');
      }
    }
  };

  const renderNews = (items) => {
    const grid = document.getElementById('newsGrid');
    const empty = document.getElementById('newsEmpty');
    if (!grid) return;
    if (!items || items.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = items.map(n => {
      const hasImg = n.image && typeof n.image === 'string';
      const date = formatFrenchDate(n.date);
      return `
        <article class="news-card reveal ${hasImg ? '' : 'news-card--no-image'}">
          ${hasImg ? `<div class="news-card__media"><img src="${escapeHtml(n.image)}" alt="${escapeHtml(n.title)}" loading="lazy" /></div>` : ''}
          <div class="news-card__body">
            ${date ? `<span class="news-card__date">${escapeHtml(date)}</span>` : ''}
            <h3 class="news-card__title">${escapeHtml(n.title || '')}</h3>
            <p class="is-clamped" data-full="${escapeHtml(n.body || '')}">${escapeHtml(n.body || '')}</p>
            ${(n.body && n.body.length > 220) ? `<button type="button" class="news-card__more">Lire la suite →</button>` : ''}
          </div>
        </article>`;
    }).join('');

    // Expand/collapse
    grid.querySelectorAll('.news-card__more').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.parentElement.querySelector('p');
        const clamped = p.classList.toggle('is-clamped');
        btn.textContent = clamped ? 'Lire la suite →' : 'Réduire ↑';
      });
    });

    // Animate in
    grid.querySelectorAll('.reveal').forEach(el => el.classList.add('is-in'));
  };

  const loadDynamic = async () => {
    try {
      const [siteRes, newsRes] = await Promise.all([
        fetch('/api/site', { cache: 'no-store' }).catch(() => null),
        fetch('/api/news', { cache: 'no-store' }).catch(() => null),
      ]);
      if (siteRes && siteRes.ok) applySiteConfig(await siteRes.json());
      if (newsRes && newsRes.ok) renderNews(await newsRes.json());
      else renderNews([]);
    } catch {
      renderNews([]);
    }
  };
  loadDynamic();
})();
