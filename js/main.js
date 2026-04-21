/* ============================================
   MPL PUBLIC — main.js
   Shared across all public website pages
   ============================================ */

/* ── Navbar scroll effect ── */
var navbar = document.querySelector('.navbar');
if (navbar) {
  window.addEventListener('scroll', function () {
    if (window.scrollY > 20) navbar.classList.add('scrolled');
    else                     navbar.classList.remove('scrolled');
  });
}

/* ── Mobile nav toggle ── */
var navToggle = document.querySelector('.nav-toggle');
var navLinks  = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', function () {
    navLinks.classList.toggle('open');
    navToggle.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
  });

  document.querySelectorAll('.nav-links a').forEach(function (link) {
    link.addEventListener('click', function () {
      navLinks.classList.remove('open');
      if (navToggle) navToggle.textContent = '☰';
    });
  });
}

/* ── Fade-in on scroll ── */
var fadeObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in').forEach(function (el) {
  fadeObserver.observe(el);
});

/* ── Number counter animation ── */
var counterObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      var target = +entry.target.dataset.count;
      if (!target) return;
      var count = 0;
      var step  = Math.ceil(target / 40);
      function tick() {
        count += step;
        if (count >= target) {
          entry.target.textContent = target;
        } else {
          entry.target.textContent = count;
          requestAnimationFrame(tick);
        }
      }
      tick();
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.hero-stat-num').forEach(function (c) {
  counterObserver.observe(c);
});

/* ── Live banner: auto-show if a live match exists ── */
document.addEventListener('DOMContentLoaded', function () {
  var banner = document.querySelector('.live-banner');
  if (!banner) return;

  try {
    var matches = JSON.parse(localStorage.getItem('mpl_matches') || '[]');
    var hasLive = matches.some(function (m) { return m.status === 'live'; });
    banner.style.display = hasLive ? 'flex' : 'none';
  } catch (e) {
    banner.style.display = 'none';
  }
});
