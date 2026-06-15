/* ============================================
   BFLFP — Corrective Maintenance page
   Embeds the Maintanance BFLFP ver 2 Power Apps app.
   ============================================ */
(function () {
    'use strict';

    function init() {
        var iframe = document.getElementById('corrective-iframe');
        var loading = document.getElementById('corrective-loading');
        var reload = document.getElementById('corrective-reload');
        var help = document.getElementById('corrective-help');
        var helpClose = document.getElementById('corrective-help-close');

        if (!iframe) return;

        // Hide loading skeleton once the iframe finishes loading
        iframe.addEventListener('load', function () {
            if (loading) loading.hidden = true;
        });

        // If the iframe takes > 12s, assume it's loaded (Power Apps load event
        // sometimes doesn't fire reliably for cross-origin frames)
        setTimeout(function () { if (loading) loading.hidden = true; }, 12000);

        // Reload button
        if (reload) {
            reload.addEventListener('click', function () {
                if (loading) loading.hidden = false;
                // Force a reload by re-setting the src
                var src = iframe.getAttribute('src');
                iframe.setAttribute('src', '');
                setTimeout(function () { iframe.setAttribute('src', src); }, 60);
            });
        }

        // Dismissible help banner — remember dismissal in localStorage
        if (help && helpClose) {
            try {
                if (localStorage.getItem('bflfp.corrective.help.dismissed') === '1') {
                    help.hidden = true;
                }
            } catch (e) { /* ignore */ }

            helpClose.addEventListener('click', function () {
                help.hidden = true;
                try { localStorage.setItem('bflfp.corrective.help.dismissed', '1'); } catch (e) { /* ignore */ }
            });
        }

        // ---- FULLSCREEN MODE ----
        var fsBtn = document.getElementById('corrective-fullscreen');
        var fsExit = document.getElementById('corrective-exit-fs');

        function enterFullscreen() {
            document.body.classList.add('corrective-fullscreen');
            try { localStorage.setItem('bflfp.corrective.fullscreen', '1'); } catch (e) { /* ignore */ }
        }
        function exitFullscreen() {
            document.body.classList.remove('corrective-fullscreen');
            try { localStorage.removeItem('bflfp.corrective.fullscreen'); } catch (e) { /* ignore */ }
        }

        if (fsBtn)  fsBtn.addEventListener('click', enterFullscreen);
        if (fsExit) fsExit.addEventListener('click', exitFullscreen);

        // Esc to exit fullscreen
        var escHandler = function (e) {
            if (e.key === 'Escape' && document.body.classList.contains('corrective-fullscreen')) {
                exitFullscreen();
            }
        };
        document.addEventListener('keydown', escHandler);

        // Re-enter fullscreen if the user reloaded the page while in fullscreen
        try {
            if (localStorage.getItem('bflfp.corrective.fullscreen') === '1') enterFullscreen();
        } catch (e) { /* ignore */ }

        // Clean up when the user navigates to another portal page (SPA router
        // unloads this fragment by emptying #app — we listen on hash change).
        var cleanupOnNav = function () {
            // If user navigated away from #corrective, drop the fullscreen class
            // so the next page doesn't render under the hidden-chrome rules.
            if ((location.hash || '#home').replace(/^#/, '').split('?')[0] !== 'corrective') {
                document.body.classList.remove('corrective-fullscreen');
                document.removeEventListener('keydown', escHandler);
                window.removeEventListener('hashchange', cleanupOnNav);
            }
        };
        window.addEventListener('hashchange', cleanupOnNav);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
