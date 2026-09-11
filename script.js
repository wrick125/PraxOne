const navToggle = document.getElementById('navToggle');
  const navBurger = document.getElementById('navBurger');

  // Keep aria-expanded in sync for screen readers
  navToggle.addEventListener('change', () => {
    navBurger.setAttribute('aria-expanded', navToggle.checked ? 'true' : 'false');
  });

  // Keyboard support: Enter / Space toggles the label's checkbox
  navBurger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navToggle.checked = !navToggle.checked;
      navToggle.dispatchEvent(new Event('change'));
    }
  });

  // Smooth-scroll to any in-page section from a nav link, and give the
  // landing section a brief spotlight glow so navigating there feels
  // intentional rather than an abrupt jump. Applies to both the
  // desktop nav links and the mobile dropdown links (mailto CTAs are
  // untouched since their href doesn't start with "#").
  //
  // For mobile-panel links specifically: close the menu first and
  // wait a couple of animation frames before starting the scroll.
  // Closing a blurred (backdrop-filter) panel at the exact same
  // instant a smooth scroll begins is a real iOS/Android bug where
  // the browser's compositor can leave the blur visually "stuck" on
  // screen even though it's already display:none in the DOM. To make
  // this bulletproof, we don't rely on the CSS :checked cascade alone —
  // we forcibly pull the panel out of the render tree with an inline
  // style, wait for that to actually settle, then scroll.
  const navMobilePanel = document.getElementById('navMobilePanel');

  function forceCloseMobileMenu(){
    navToggle.checked = false;
    navBurger.setAttribute('aria-expanded', 'false');
    if (navMobilePanel){
      navMobilePanel.style.display = 'none';
    }
  }

  function releaseMobileMenuOverride(){
    if (navMobilePanel){
      navMobilePanel.style.display = '';
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();

      const runScroll = () => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.remove('nav-pulse');
        void target.offsetWidth; // restart animation cleanly on repeat clicks
        target.classList.add('nav-pulse');
        setTimeout(() => target.classList.remove('nav-pulse'), 1600);
      };

      const isMobileMenuLink = link.closest('.nav-mobile-panel') !== null;

      if (isMobileMenuLink){
        forceCloseMobileMenu();
        // Fixed delay (not just animation frames) so this is reliable
        // even on slower/older mobile devices — gives the browser real
        // time to drop the blurred panel before the scroll starts.
        setTimeout(() => {
          releaseMobileMenuOverride();
          runScroll();
        }, 220);
      } else {
        runScroll();
      }
    });
  });

  // The mobile CTA is a mailto: link (not a "#" hash), so it's outside
  // the handler above — still force-close the menu when it's tapped.
  document.querySelectorAll('.nav-mobile-cta').forEach(link => {
    link.addEventListener('click', () => {
      forceCloseMobileMenu();
      setTimeout(releaseMobileMenuOverride, 220);
    });
  });

  // ----- Scroll-reveal + stat counters -----
  // All of this is purely a visual enhancement. Content is visible by
  // default in the CSS with no JS running at all. The hidden/animated
  // starting state is only switched on (via the "js-ready" class on
  // <html>) once we've confirmed IntersectionObserver is available —
  // and even then, everything below is wrapped so a script error or a
  // restricted preview environment (in-app file viewers, etc.) can
  // never leave content permanently invisible.

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.reveal');
  const statBoxes = document.querySelectorAll('.stat-pop-wrap.pop-in');

  function animateCount(el){
    const target = parseFloat(el.getAttribute('data-target'));
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1300;

    if (prefersReducedMotion){
      el.textContent = target + suffix;
      return;
    }

    const start = performance.now();

    function easeOutExpo(t){
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function tick(now){
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const current = Math.round(target * eased);
      el.textContent = current + suffix;

      if (progress < 1){
        requestAnimationFrame(tick);
      } else {
        el.textContent = target + suffix;
      }
    }

    requestAnimationFrame(tick);

    // Safety net: if rAF ever stalls or gets interrupted partway
    // (backgrounded tab, restricted mobile WebView, etc.), guarantee
    // the number still lands on the correct final value.
    setTimeout(() => { el.textContent = target + suffix; }, duration + 400);
  }

  function triggerStatBox(box){
    if (box.dataset.popped === 'true') return;
    box.dataset.popped = 'true';
    box.classList.add('popped');
    const numEl = box.querySelector('.stat-num[data-target]');
    if (numEl) animateCount(numEl);
  }

  function revealAllImmediately(){
    revealEls.forEach(el => el.classList.add('in-view'));
    statBoxes.forEach(triggerStatBox);
  }

  try {
    if ('IntersectionObserver' in window){
      // Only now do we switch CSS into "start hidden, animate in" mode —
      // confirmed the browser can actually observe scroll position.
      document.documentElement.classList.add('js-ready');

      if (revealEls.length){
        const io = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting){
              entry.target.classList.add('in-view');
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        revealEls.forEach(el => io.observe(el));
      }

      if (statBoxes.length){
        // threshold 0 + no negative rootMargin: fires as soon as even
        // a sliver of the box is visible — more reliable on short
        // mobile viewports (dynamic browser toolbars, small screens).
        const statIo = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting){
              triggerStatBox(entry.target);
              statIo.unobserve(entry.target);
            }
          });
        }, { threshold: 0, rootMargin: '0px' });

        statBoxes.forEach(box => statIo.observe(box));
      }
    } else {
      // No IntersectionObserver support: never add js-ready, so the
      // CSS hidden state is never switched on and content just stays
      // visible as normal, unanimated.
      revealAllImmediately();
    }
  } catch (err) {
    // Any unexpected failure: make sure content is visible.
    document.documentElement.classList.remove('js-ready');
    revealAllImmediately();
  }

  // Absolute hard fallback: no matter what happened above (observer
  // never fired, a restricted WebView blocked something, timing
  // quirks, etc.), force everything visible after a short delay so
  // the page can never be left permanently blank.
  window.addEventListener('load', () => {
    setTimeout(revealAllImmediately, 1500);
  });
  setTimeout(revealAllImmediately, 3000);

  // FAQ accordion is now native <details>/<summary> — it opens and
  // closes with zero JavaScript required, in every browser. No JS
  // logic needed here at all; the fade-in on the answer content is
  // handled purely by the CSS animation on .faq-answer-inner.


  // Back to Top is now a plain <a href="#top"> anchor — it works with
  // zero JavaScript via native browser navigation + the global
  // scroll-behavior:smooth on <html>, and is automatically picked up
  // by the generic hash-link smooth-scroll handler above when JS is
  // available, for the spotlight-free but still-smooth experience.

  // ----- How It Works: scroll progress line -----
  // A glowing overlay grows down the timeline's center line as the
  // user scrolls through the steps, and each dot lights up once the
  // fill passes it. Purely additive — the dim static line underneath
  // is always fully visible on its own, so nothing breaks if this
  // fails to run for any reason.
  try {
    if (!prefersReducedMotion && 'requestAnimationFrame' in window){
      const stepsTrack = document.querySelector('.steps-track');
      const stepsFill = document.querySelector('.steps-line-fill');
      const stepDots = document.querySelectorAll('.step-dot');

      if (stepsTrack && stepsFill && stepDots.length){
        let ticking = false;

        function updateStepsProgress(){
          ticking = false;
          const rect = stepsTrack.getBoundingClientRect();
          const vh = window.innerHeight || document.documentElement.clientHeight;

          // progress starts once the track enters the lower part of
          // the viewport, and finishes once its bottom nears the
          // upper part — feels tied to natural reading position
          // rather than the very top/bottom edges of the screen.
          const startLine = vh * 0.85;
          const endLine = vh * 0.3;
          const span = rect.height + (startLine - endLine);
          const scrolled = startLine - rect.top;
          let progress = span > 0 ? scrolled / span : 0;
          progress = Math.max(0, Math.min(1, progress));

          stepsFill.style.height = (progress * 100) + '%';

          const fillLineY = rect.top + rect.height * progress;
          stepDots.forEach(dot => {
            const dotRect = dot.getBoundingClientRect();
            const dotCenter = dotRect.top + dotRect.height / 2;
            if (dotCenter <= fillLineY + 30){
              dot.classList.add('active');
            }
          });
        }

        function onStepsScroll(){
          if (!ticking){
            requestAnimationFrame(updateStepsProgress);
            ticking = true;
          }
        }

        window.addEventListener('scroll', onStepsScroll, { passive: true });
        window.addEventListener('resize', onStepsScroll);
        window.addEventListener('load', updateStepsProgress);
        updateStepsProgress();
      }
    }
  } catch (err) {
    // Silent fail-safe: the static line and plain reveal animation
    // are unaffected either way.
  }

  // ----- Proof section: play videos only while in view -----
  // Each video already has native autoplay+muted+loop+playsinline
  // attributes, so it will attempt to play on its own even if this
  // script never runs. This just adds a nicer, more deliberate
  // "plays exactly when it scrolls into view" behavior and pauses
  // off-screen clips to save bandwidth/battery.
  try {
    const proofVideos = document.querySelectorAll('.proof-video');
    if ('IntersectionObserver' in window && proofVideos.length){
      const proofIo = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const video = entry.target;
          const card = video.closest('.proof-card');
          if (entry.isIntersecting){
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function'){
              playPromise.catch(() => { /* ignore autoplay rejection */ });
            }
            if (card) card.classList.add('playing');
          } else {
            video.pause();
            if (card) card.classList.remove('playing');
          }
        });
      }, { threshold: 0.55 });

      proofVideos.forEach(video => proofIo.observe(video));
    }
  } catch (err) {
    // Native autoplay attributes already cover playback either way.
  }
