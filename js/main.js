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
  // Fallback: reveal anything still hidden after 2s (e.g. screenshot tools
  // that don't trigger IO, or users who disable JS intersection events).
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
})();
