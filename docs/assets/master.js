/* ============================================
   BFLFP — MASTER JS (nav + announcement)
   Loaded on every page.
   ============================================ */

(function() {
    'use strict';

    // Announcement banner date
    function initAnnouncementDate() {
        var el = document.getElementById('announcement-date');
        if (!el) return;
        var d = new Date();
        try {
            el.textContent = d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            el.textContent = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
        }
    }

    // Mobile nav toggle
    function initNavToggle() {
        var toggle = document.getElementById('nav-toggle');
        var links = document.getElementById('nav-links');
        if (!toggle || !links) return;
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            var isOpen = links.classList.toggle('open');
            toggle.classList.toggle('open', isOpen);
        });
        document.addEventListener('click', function(e) {
            if (!links.contains(e.target) && !toggle.contains(e.target)) {
                links.classList.remove('open');
                toggle.classList.remove('open');
            }
        });
    }

    function init() {
        initAnnouncementDate();
        initNavToggle();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
