/* ============================================
   BFLFP ABOUT — JS
   Minimal: scroll reveal + smooth anchor scroll.
   ============================================ */

(function() {
    'use strict';

    // Smooth scroll for any in-page anchors
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function(link){
            link.addEventListener('click', function(e){
                var hash = this.getAttribute('href');
                if (!hash || hash.length <= 1) return;
                var target = document.querySelector(hash);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // Fade-in on scroll for the major content blocks
    function initReveal() {
        if (!('IntersectionObserver' in window)) return;
        var items = document.querySelectorAll(
            '.about-arch-step, .about-user-card, .about-stack-card, .about-faq-item, .about-mission-card, .about-stat'
        );
        items.forEach(function(el){
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        });
        var io = new IntersectionObserver(function(entries){
            entries.forEach(function(entry, idx){
                if (entry.isIntersecting) {
                    var el = entry.target;
                    setTimeout(function(){
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0)';
                    }, idx * 50);
                    io.unobserve(el);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        items.forEach(function(el){ io.observe(el); });
    }

    function init() {
        try { initSmoothScroll(); } catch (e) { console.warn('smoothScroll:', e); }
        try { initReveal(); } catch (e) { console.warn('reveal:', e); }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
