/**
 * ELYON Landing Page - Minimal JavaScript
 * Antigravity Style - Focus on Performance
 */

// Configuration (mantido para compatibilidade)
const CONFIG = {
  whatsappGroupLink: 'https://chat.whatsapp.com/SEU_CODIGO_AQUI',
};


// Scroll Animations
function initScrollAnimations() {
  const fadeElements = document.querySelectorAll('.fade-in');
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    }
  );
  
  fadeElements.forEach((el) => observer.observe(el));
}

// Smooth Scroll
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initSmoothScroll();
  
  console.log('ELYON Landing Page - Professional Edition loaded');
});

// Expose config
window.ELYON_CONFIG = CONFIG;
