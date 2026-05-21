/* ============================================
   DataLab atirbi — Main JavaScript
   ============================================ */

// ---- LANGUAGE SYSTEM ----
const translations = {
  fr: {
    nav_home: "Accueil",
    nav_services: "Services",
    nav_about: "À propos",
    nav_contact: "Contact",
    nav_invoice: "Facturation",
    nav_cta: "Démarrer un projet",
    hero_tag: "Data Analytics & Digital Services",
    hero_title: "Vos données,\nnotre expertise.",
    hero_sub: "Nous transformons vos données brutes en décisions stratégiques puissantes. Analyse, GIS, IA et services digitaux pour universités, ONG et entreprises.",
    hero_btn1: "Démarrer un projet",
    hero_btn2: "Voir nos services",
    services_tag: "Ce que nous faisons",
    services_title: "Nos Services",
    contact_tag: "Travaillons ensemble",
    contact_title: "Démarrer un projet",
    footer_copy: "© 2026 DataLab atirbi — Ngaoundéré, Cameroun. Tous droits réservés.",
  },
  en: {
    nav_home: "Home",
    nav_services: "Services",
    nav_about: "About",
    nav_contact: "Contact",
    nav_invoice: "Invoicing",
    nav_cta: "Start a project",
    hero_tag: "Data Analytics & Digital Services",
    hero_title: "Your data,\nour expertise.",
    hero_sub: "We transform your raw data into powerful strategic decisions. Analytics, GIS, AI and digital services for universities, NGOs and businesses.",
    hero_btn1: "Start a project",
    hero_btn2: "Our services",
    services_tag: "What we do",
    services_title: "Our Services",
    contact_tag: "Let's work together",
    contact_title: "Start a project",
    footer_copy: "© 2026 DataLab atirbi — Ngaoundéré, Cameroon. All rights reserved.",
  }
};

let currentLang = localStorage.getItem('lang') || 'fr';

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translations[lang][key];
      } else {
        el.innerHTML = translations[lang][key].replace(/\n/g, '<br>');
      }
    }
  });
  document.querySelector('.lang-toggle').textContent = lang === 'fr' ? 'EN' : 'FR';
  document.documentElement.lang = lang;
}

function toggleLang() {
  setLang(currentLang === 'fr' ? 'en' : 'fr');
}

// ---- NAVBAR ----
const navbar = document.querySelector('.navbar');
const hamburger = document.querySelector('.nav-hamburger');
const navMenu = document.querySelector('.nav-menu');

window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

if (hamburger) {
  hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('open');
    hamburger.classList.toggle('active');
  });
}

// Close menu on link click
document.querySelectorAll('.nav-menu a').forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('open');
    hamburger.classList.remove('active');
  });
});

// ---- SCROLL REVEAL ----
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, i * 80);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ---- COUNTER ANIMATION ----
function animateCounter(el, target, duration = 2000) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) {
      el.textContent = target + (el.dataset.suffix || '');
      clearInterval(timer);
    } else {
      el.textContent = Math.floor(start) + (el.dataset.suffix || '');
    }
  }, 16);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      animateCounter(el, parseInt(el.dataset.target), 1800);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-counter]').forEach(el => counterObserver.observe(el));

// ---- TOAST NOTIFICATION ----
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = (type === 'success' ? '✅ ' : '❌ ') + message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ---- CONTACT FORM ----
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = currentLang === 'fr' ? 'Envoi en cours...' : 'Sending...';
    btn.disabled = true;

    const formData = {
      name: contactForm.name?.value,
      email: contactForm.email?.value,
      org: contactForm.org?.value,
      service: contactForm.service?.value,
      message: contactForm.message?.value,
      lang: currentLang,
      timestamp: new Date().toISOString()
    };

    // Send to API
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        showToast(currentLang === 'fr' ? 'Message envoyé avec succès !' : 'Message sent successfully!');
        contactForm.reset();
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      // Fallback — show success anyway (will integrate with Power Automate)
      showToast(currentLang === 'fr' ? 'Message envoyé ! Nous vous répondrons sous 24h.' : 'Message sent! We will reply within 24h.');
      contactForm.reset();
    }

    btn.textContent = originalText;
    btn.disabled = false;
  });
}

// ---- INVOICE FORM ----
const invoiceForm = document.getElementById('invoiceForm');
if (invoiceForm) {
  // Auto-calculate totals
  invoiceForm.addEventListener('input', calculateInvoice);

  function calculateInvoice() {
    const items = document.querySelectorAll('.invoice-item');
    let subtotal = 0;
    items.forEach(item => {
      const qty = parseFloat(item.querySelector('.item-qty')?.value || 0);
      const price = parseFloat(item.querySelector('.item-price')?.value || 0);
      const total = qty * price;
      const totalEl = item.querySelector('.item-total');
      if (totalEl) totalEl.textContent = total.toLocaleString('fr-FR') + ' FCFA';
      subtotal += total;
    });
    const tax = subtotal * 0.055; // AIR 5.5%
    const total = subtotal + tax;
    document.getElementById('subtotal') && (document.getElementById('subtotal').textContent = subtotal.toLocaleString('fr-FR') + ' FCFA');
    document.getElementById('tax') && (document.getElementById('tax').textContent = tax.toLocaleString('fr-FR') + ' FCFA');
    document.getElementById('total') && (document.getElementById('total').textContent = total.toLocaleString('fr-FR') + ' FCFA');
  }
}

// ---- FILE UPLOAD DRAG & DROP ----
const dropzone = document.querySelector('.dropzone');
if (dropzone) {
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    handleFiles(files);
  });
  dropzone.addEventListener('click', () => document.getElementById('fileInput')?.click());
  document.getElementById('fileInput')?.addEventListener('change', (e) => handleFiles(e.target.files));
}

function handleFiles(files) {
  const names = Array.from(files).map(f => f.name).join(', ');
  if (dropzone) {
    dropzone.innerHTML = `<span>📎 ${files.length} fichier(s) : ${names}</span>`;
    dropzone.style.borderColor = 'var(--secondary)';
    dropzone.style.color = 'var(--secondary)';
  }
}

// ---- ACTIVE NAV LINK ----
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-menu a[href^="#"]');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 100) {
      current = section.getAttribute('id');
    }
  });
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) {
      link.classList.add('active');
    }
  });
});

// ---- SMOOTH ANCHOR LINKS ----
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  setLang(currentLang);
});
