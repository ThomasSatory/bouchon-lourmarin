(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const formatFrenchDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d)) return iso;
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return iso; }
  };

  const api = {
    async get(path) {
      const r = await fetch(path, { credentials: 'include' });
      if (r.status === 401) { showLogin(); throw new Error('unauthorized'); }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    async send(method, path, body) {
      const r = await fetch(path, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (r.status === 401) { showLogin(); throw new Error('unauthorized'); }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return data;
    },
    async upload(file) {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/admin/upload', {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (r.status === 401) { showLogin(); throw new Error('unauthorized'); }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'upload_failed');
      return data;
    },
  };

  // ============================================================
  // TOAST
  // ============================================================
  const toast = (msg, kind = 'success') => {
    const el = $('#toast');
    el.className = 'toast';
    el.classList.add(kind === 'error' ? 'is-error' : 'is-success');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 3500);
  };

  // ============================================================
  // AUTH VIEWS
  // ============================================================
  const showLogin = () => {
    $('#loginView').hidden = false;
    $('#dashView').hidden = true;
    setTimeout(() => $('#loginPassword')?.focus(), 50);
  };
  const showDash = () => {
    $('#loginView').hidden = true;
    $('#dashView').hidden = false;
    loadAll();
  };

  const loginForm = $('#loginForm');
  const loginSubmit = $('#loginSubmit');
  const loginError = $('#loginError');
  const togglePwd = $('#togglePwd');

  togglePwd.addEventListener('click', () => {
    const input = $('#loginPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    loginSubmit.classList.add('is-loading');
    loginSubmit.disabled = true;
    try {
      await api.send('POST', '/api/admin/login', { password: $('#loginPassword').value });
      showDash();
    } catch (err) {
      loginError.hidden = false;
      $('#loginPassword').focus();
      $('#loginPassword').select();
    } finally {
      loginSubmit.classList.remove('is-loading');
      loginSubmit.disabled = false;
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await api.send('POST', '/api/admin/logout');
    showLogin();
  });

  // ============================================================
  // TABS
  // ============================================================
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.tab;
      $$('.tab').forEach(b => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
      $$('.panel').forEach(p => p.classList.toggle('is-active', p.dataset.panel === key));
      if (key === 'map' && typeof pickerMap !== 'undefined' && pickerMap) {
        setTimeout(() => pickerMap.invalidateSize(), 50);
      }
    });
  });

  // ============================================================
  // STATE
  // ============================================================
  let content = null;

  const loadAll = async () => {
    try {
      content = await api.get('/api/admin/content');
      renderNewsTable();
      renderPhotosPanel();
      fillMapForm();
      fillContactForm();
      renderHoursEditor();
    } catch (e) {
      if (e.message !== 'unauthorized') toast('Chargement impossible', 'error');
    }
  };

  // ============================================================
  // NEWS
  // ============================================================
  const newsModal = $('#newsModal');
  const newsForm = $('#newsForm');
  const newsImageInput = $('#newsImageInput');
  const newsImagePreview = $('#newsImagePreview');
  const newsImageClear = $('#newsImageClear');
  const newsSubmit = $('#newsSubmit');

  const openNewsModal = (item = null) => {
    newsForm.reset();
    newsForm.elements.id.value = item?.id || '';
    newsForm.elements.title.value = item?.title || '';
    newsForm.elements.body.value = item?.body || '';
    newsForm.elements.date.value = item?.date || new Date().toISOString().slice(0, 10);
    newsForm.elements.published.checked = item ? item.published !== false : true;
    setImagePreview(item?.image || null);
    $('#newsModalTitle').textContent = item ? 'Modifier l\'actualité' : 'Nouvelle actualité';
    newsModal.hidden = false;
    setTimeout(() => newsForm.elements.title.focus(), 50);
  };
  const closeModal = (modal) => { modal.hidden = true; };

  $$('[data-close]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.closest('.modal')));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $$('.modal').forEach(m => { if (!m.hidden) m.hidden = true; });
  });

  const setImagePreview = (url) => {
    newsForm.elements.image.value = url || '';
    if (url) {
      newsImagePreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Aperçu" />`;
      newsImageClear.hidden = false;
    } else {
      newsImagePreview.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-7 7"/></svg>
        <span>Aucune image</span>`;
      newsImageClear.hidden = true;
    }
  };

  $('#newsImagePick').addEventListener('click', () => newsImageInput.click());
  newsImageClear.addEventListener('click', () => setImagePreview(null));
  newsImageInput.addEventListener('change', async () => {
    const file = newsImageInput.files?.[0];
    if (!file) return;
    newsImagePreview.innerHTML = '<span>Upload…</span>';
    try {
      const { url } = await api.upload(file);
      setImagePreview(url);
    } catch {
      toast('Upload impossible', 'error');
      setImagePreview(newsForm.elements.image.value || null);
    } finally {
      newsImageInput.value = '';
    }
  });

  $('#newsAddBtn').addEventListener('click', () => openNewsModal());

  newsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      title: newsForm.elements.title.value.trim(),
      body: newsForm.elements.body.value.trim(),
      date: newsForm.elements.date.value || null,
      image: newsForm.elements.image.value || null,
      published: newsForm.elements.published.checked,
    };
    if (!data.title || !data.body) {
      toast('Titre et texte obligatoires', 'error');
      return;
    }
    const id = newsForm.elements.id.value;
    newsSubmit.classList.add('is-loading'); newsSubmit.disabled = true;
    try {
      if (id) await api.send('PUT', `/api/admin/news/${id}`, data);
      else await api.send('POST', '/api/admin/news', data);
      closeModal(newsModal);
      toast(id ? 'Actualité mise à jour' : 'Actualité publiée');
      await loadAll();
    } catch {
      toast('Enregistrement impossible', 'error');
    } finally {
      newsSubmit.classList.remove('is-loading'); newsSubmit.disabled = false;
    }
  });

  const renderNewsTable = () => {
    const tbody = $('#newsTbody');
    const list = [...(content.news || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('#newsCount').textContent = String(list.length);
    if (!list.length) {
      tbody.innerHTML = `<tr class="table__empty"><td colspan="5">Aucune actualité pour le moment — cliquez sur « Nouvelle actualité ».</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(n => `
      <tr data-id="${escapeHtml(n.id)}">
        <td>
          <div class="thumb">
            ${n.image
              ? `<img src="${escapeHtml(n.image)}" alt="" loading="lazy" />`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-7 7"/></svg>`
            }
          </div>
        </td>
        <td><div class="table__title">${escapeHtml(n.title)}</div></td>
        <td><span class="table__date">${escapeHtml(formatFrenchDate(n.date))}</span></td>
        <td>
          ${n.published === false
            ? `<span class="badge badge--draft">Brouillon</span>`
            : `<span class="badge badge--ok">En ligne</span>`}
        </td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-act="edit" aria-label="Modifier">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            </button>
            <button class="icon-btn icon-btn--danger" data-act="delete" aria-label="Supprimer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.closest('tr').dataset.id;
        const item = content.news.find(n => n.id === id);
        if (!item) return;
        if (btn.dataset.act === 'edit') openNewsModal(item);
        else if (btn.dataset.act === 'delete') confirmDelete(item);
      });
    });
  };

  // CONFIRM
  const confirmModal = $('#confirmModal');
  const confirmOk = $('#confirmOk');
  let confirmAction = null;
  const confirmDelete = (item) => {
    $('#confirmTitle').textContent = 'Supprimer cette actualité ?';
    $('#confirmText').textContent = `« ${item.title} » sera définitivement retirée du site.`;
    confirmOk.textContent = 'Supprimer';
    confirmAction = async () => {
      try {
        await api.send('DELETE', `/api/admin/news/${item.id}`);
        toast('Actualité supprimée');
        closeModal(confirmModal);
        await loadAll();
      } catch { toast('Suppression impossible', 'error'); }
    };
    confirmModal.hidden = false;
  };
  confirmOk.addEventListener('click', () => confirmAction && confirmAction());

  // ============================================================
  // PHOTOS
  // ============================================================
  // Scanned from index.html markup
  const PHOTO_KEYS = [
    { key: 'hero-01',   label: 'Hero — image principale',       defaultSrc: '/assets/photos/hero-01.jpg' },
    { key: 'histoire',  label: 'Notre histoire — photo',        defaultSrc: '/assets/photos/plat-14.jpg' },
    { key: 'strip-1',   label: 'Bande photos — 1',              defaultSrc: '/assets/photos/plat-01.jpg' },
    { key: 'strip-2',   label: 'Bande photos — 2',              defaultSrc: '/assets/photos/plat-04.jpg' },
    { key: 'strip-3',   label: 'Bande photos — 3',              defaultSrc: '/assets/photos/hero-02.jpg' },
    { key: 'strip-4',   label: 'Bande photos — 4',              defaultSrc: '/assets/photos/plat-02.jpg' },
    { key: 'strip-5',   label: 'Bande photos — 5',              defaultSrc: '/assets/photos/plat-09.jpg' },
    { key: 'strip-6',   label: 'Bande photos — 6',              defaultSrc: '/assets/photos/plat-06.jpg' },
    { key: 'strip-7',   label: 'Bande photos — 7',              defaultSrc: '/assets/photos/plat-13.jpg' },
    { key: 'strip-8',   label: 'Bande photos — 8',              defaultSrc: '/assets/photos/hero-03.jpg' },
    { key: 'gallery-1', label: 'Galerie — grande (verticale)',  defaultSrc: '/assets/photos/plat-04.jpg' },
    { key: 'gallery-2', label: 'Galerie — 2',                   defaultSrc: '/assets/photos/plat-01.jpg' },
    { key: 'gallery-3', label: 'Galerie — 3',                   defaultSrc: '/assets/photos/plat-06.jpg' },
    { key: 'gallery-4', label: 'Galerie — large (horizontale)', defaultSrc: '/assets/photos/plat-11.jpg' },
    { key: 'gallery-5', label: 'Galerie — 5',                   defaultSrc: '/assets/photos/plat-13.jpg' },
    { key: 'gallery-6', label: 'Galerie — 6',                   defaultSrc: '/assets/photos/plat-05.jpg' },
    { key: 'gallery-7', label: 'Galerie — 7',                   defaultSrc: '/assets/photos/plat-07.jpg' },
  ];

  const renderPhotosPanel = () => {
    const grid = $('#photosGrid');
    const overrides = content.site?.photos || {};
    $('#photosCount').textContent = String(Object.keys(overrides).length);
    grid.innerHTML = PHOTO_KEYS.map(p => {
      const current = overrides[p.key] || p.defaultSrc;
      const isOverride = !!overrides[p.key];
      return `
        <div class="photo-card" data-key="${escapeHtml(p.key)}">
          <div class="photo-card__media"><img src="${escapeHtml(current)}" alt="${escapeHtml(p.label)}" loading="lazy" /></div>
          <div class="photo-card__info">
            <div class="photo-card__label">${escapeHtml(p.label)}</div>
            <div class="photo-card__name">${isOverride ? 'Personnalisée' : 'Photo d\'origine'}</div>
          </div>
          <div class="photo-card__actions">
            <button type="button" class="btn btn--ghost" data-act="replace">Remplacer</button>
            ${isOverride ? `<button type="button" class="btn btn--text" data-act="reset">Réinitialiser</button>` : ''}
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.photo-card').forEach(card => {
      const key = card.dataset.key;
      card.querySelector('[data-act="replace"]').addEventListener('click', () => pickPhoto(card, key));
      card.querySelector('[data-act="reset"]')?.addEventListener('click', async () => {
        const next = { ...(content.site.photos || {}) };
        delete next[key];
        // Server merges, so we send full photos object
        try {
          await saveSitePatch({ photos: null, __replacePhotos: next });
          toast('Photo réinitialisée');
        } catch { toast('Erreur', 'error'); }
      });
    });
  };

  const pickPhoto = (card, key) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      card.classList.add('is-loading');
      try {
        const { url } = await api.upload(file);
        const photos = { ...(content.site.photos || {}), [key]: url };
        await saveSitePatch({ photos: null, __replacePhotos: photos });
        toast('Photo mise à jour');
      } catch {
        toast('Upload impossible', 'error');
      } finally {
        card.classList.remove('is-loading');
      }
    };
    input.click();
  };

  const saveSitePatch = async (patch) => {
    if (patch.__replacePhotos !== undefined) {
      await api.send('PUT', '/api/admin/site-photos', patch.__replacePhotos);
    } else {
      await api.send('PUT', '/api/admin/site', patch);
    }
    await loadAll();
  };

  // ============================================================
  // MAP FORM
  // ============================================================
  const mapForm = $('#mapForm');

  const LOURMARIN_DEFAULT = [43.7639, 5.3621];
  let pickerMap = null;
  let pickerMarker = null;
  const coordsReadout = $('#mapPickerCoords');

  const setPickerCoords = (lat, lng) => {
    mapForm.elements.latitude.value = lat.toFixed(6);
    mapForm.elements.longitude.value = lng.toFixed(6);
    if (coordsReadout) coordsReadout.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const initPickerMap = (lat, lng) => {
    const el = document.getElementById('mapPicker');
    if (!el || typeof L === 'undefined') return;
    if (!pickerMap) {
      pickerMap = L.map(el, { scrollWheelZoom: false }).setView([lat, lng], 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(pickerMap);
      pickerMarker = L.marker([lat, lng], { draggable: true }).addTo(pickerMap);
      pickerMarker.on('dragend', () => {
        const { lat: la, lng: ln } = pickerMarker.getLatLng();
        setPickerCoords(la, ln);
      });
      pickerMap.on('click', (e) => {
        pickerMarker.setLatLng(e.latlng);
        setPickerCoords(e.latlng.lat, e.latlng.lng);
      });
      // Fix sizing if panel was hidden during init
      setTimeout(() => pickerMap.invalidateSize(), 50);
    } else {
      pickerMap.setView([lat, lng], pickerMap.getZoom() || 17);
      pickerMarker.setLatLng([lat, lng]);
      setTimeout(() => pickerMap.invalidateSize(), 50);
    }
    setPickerCoords(lat, lng);
  };

  const fillMapForm = () => {
    const m = content.site?.map || {};
    mapForm.elements.address1.value = m.address1 || '';
    mapForm.elements.address2.value = m.address2 || '';
    mapForm.elements.address3.value = m.address3 || '';
    mapForm.elements.mapsUrl.value = m.mapsUrl || '';
    const lat = Number.isFinite(parseFloat(m.latitude)) ? parseFloat(m.latitude) : LOURMARIN_DEFAULT[0];
    const lng = Number.isFinite(parseFloat(m.longitude)) ? parseFloat(m.longitude) : LOURMARIN_DEFAULT[1];
    initPickerMap(lat, lng);
  };
  mapForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const map = {
      address1: mapForm.elements.address1.value.trim(),
      address2: mapForm.elements.address2.value.trim(),
      address3: mapForm.elements.address3.value.trim(),
      latitude: parseFloat(mapForm.elements.latitude.value) || null,
      longitude: parseFloat(mapForm.elements.longitude.value) || null,
      mapsUrl: mapForm.elements.mapsUrl.value.trim(),
    };
    try {
      await api.send('PUT', '/api/admin/site', { map });
      toast('Carte enregistrée');
      await loadAll();
    } catch { toast('Erreur d\'enregistrement', 'error'); }
  });

  // ============================================================
  // CONTACT + HOURS
  // ============================================================
  const contactForm = $('#contactForm');
  const fillContactForm = () => {
    const c = content.site?.contact || {};
    contactForm.elements.phone.value = c.phone || '';
    contactForm.elements.phoneIntl.value = c.phoneIntl || '';
    contactForm.elements.instagram.value = c.instagram || '';
    contactForm.elements.instagramHandle.value = c.instagramHandle || '';
  };
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contact = {
      phone: contactForm.elements.phone.value.trim(),
      phoneIntl: contactForm.elements.phoneIntl.value.trim(),
      instagram: contactForm.elements.instagram.value.trim(),
      instagramHandle: contactForm.elements.instagramHandle.value.trim(),
    };
    try {
      await api.send('PUT', '/api/admin/site', { contact });
      toast('Contact enregistré');
      await loadAll();
    } catch { toast('Erreur', 'error'); }
  });

  const hoursRows = $('#hoursRows');
  const renderHoursEditor = () => {
    const hours = content.site?.hours || [];
    hoursRows.innerHTML = hours.map((h, i) => hourRowHtml(h, i)).join('');
    attachHoursHandlers();
  };
  const hourRowHtml = (h, i) => `
    <div class="hours-row" data-i="${i}">
      <input class="input" data-f="days" type="text" value="${escapeHtml(h.days || '')}" placeholder="Ex. : Mardi – Jeudi" />
      <input class="input" data-f="value" type="text" value="${escapeHtml(h.value || '')}" placeholder="Ex. : 19h00 – 01h00" />
      <label class="hours-row__closed">
        <input type="checkbox" data-f="closed" ${h.closed ? 'checked' : ''} />
        Fermé
      </label>
      <button type="button" class="hours-row__remove" aria-label="Supprimer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
  `;
  const attachHoursHandlers = () => {
    hoursRows.querySelectorAll('.hours-row__remove').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.hours-row').remove());
    });
  };
  $('#addHourRow').addEventListener('click', () => {
    hoursRows.insertAdjacentHTML('beforeend', hourRowHtml({ days: '', value: '', closed: false }, Date.now()));
    attachHoursHandlers();
  });
  $('#hoursForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rows = $$('.hours-row', hoursRows).map(r => ({
      days: r.querySelector('[data-f="days"]').value.trim(),
      value: r.querySelector('[data-f="value"]').value.trim(),
      closed: r.querySelector('[data-f="closed"]').checked,
    })).filter(r => r.days || r.value);
    try {
      await api.send('PUT', '/api/admin/site', { hours: rows });
      toast('Horaires enregistrés');
      await loadAll();
    } catch { toast('Erreur', 'error'); }
  });

  // ============================================================
  // INIT
  // ============================================================
  (async () => {
    try {
      const me = await fetch('/api/admin/me', { credentials: 'include' }).then(r => r.json());
      if (me.authenticated) showDash();
      else showLogin();
    } catch {
      showLogin();
    }
  })();
})();
