/* ============================================
   BFLFP — SPA ROUTER
   Hash-based single-page app routing.
   - Reads location.hash
   - Fetches the matching page fragment from /pages/*.html
   - Injects it into #app
   - Loads the page-specific JS once per visit
   - Updates the active nav state
   - Cleans up Chart.js instances when leaving a page
   ============================================ */

(function() {
    'use strict';

    var ROUTES = {
        'home':            { fragment: 'pages/home.html',            script: 'assets/home.js',            title: 'Home' },
        'dashboard':       { fragment: 'pages/dashboard.html',       script: 'assets/dashboard.js',       title: 'Dashboard' },
        'assets':          { fragment: 'pages/assets.html',          script: 'assets/assets.js',          title: 'Assets' },
        'pm-schedule':     { fragment: 'pages/pm-schedule.html',     script: 'assets/pm-schedule.js',     title: 'PM Schedule' },
        'maintenance-log': { fragment: 'pages/maintenance-log.html', script: 'assets/maintenance-log.js', title: 'Maintenance Log' },
        'corrective':      { fragment: 'pages/corrective.html',      script: 'assets/corrective.js',      title: 'Corrective Maintenance' },
        'pm-completions':  { fragment: 'pages/pm-completions.html',  script: 'assets/pm-completions.js',  title: 'PM Completions' },
        'pm-reports':      { fragment: 'pages/pm-reports.html',      script: 'assets/pm-reports.js',      title: 'PM Reports' },
        'repair-reports':  { fragment: 'pages/repair-reports.html',  script: 'assets/repair-reports.js',  title: 'Repair Form (F-SP-ENG02-03)' },
        'history':         { fragment: 'pages/history.html',         script: 'assets/history.js',         title: 'Machine History (F-SP-ENG02-02)' },
        'tools-used':      { fragment: 'pages/tools-used.html',      script: 'assets/tools-used.js',      title: 'Tool Authorization (F-SP-ENG02-04)' },
        'daily-report':    { fragment: 'pages/daily-report.html',    script: 'assets/daily-report.js',    title: 'Daily Report (F-SP-ENG02-06)' },
        'reports':         { fragment: 'pages/reports.html',         script: 'assets/reports.js',         title: 'Reports' },
        'about':           { fragment: 'pages/about.html',           script: 'assets/about.js',           title: 'About' }
    };
    var DEFAULT_ROUTE = 'home';

    var app = document.getElementById('app');
    var fragmentCache = {};
    var loadedScripts = {}; // not used to skip — we always re-execute on nav

    // --------------------------------------------
    // Get current route from hash
    // --------------------------------------------
    function currentRoute() {
        var h = (location.hash || '').replace(/^#\/?/, '').toLowerCase();
        // Strip query string ?key=value from the route key
        var qIdx = h.indexOf('?');
        if (qIdx >= 0) h = h.substring(0, qIdx);
        if (!h || !ROUTES[h]) return DEFAULT_ROUTE;
        return h;
    }

    // --------------------------------------------
    // Update active nav link
    // --------------------------------------------
    function updateActiveNav(route) {
        document.querySelectorAll('.nav-links a').forEach(function(a){
            a.classList.remove('active');
            var href = (a.getAttribute('href') || '').replace(/^#\/?/, '').toLowerCase();
            if (href === route || (route === DEFAULT_ROUTE && (href === '' || href === DEFAULT_ROUTE))) {
                a.classList.add('active');
            }
        });
        // Close mobile nav if open
        var links = document.getElementById('nav-links');
        var toggle = document.getElementById('nav-toggle');
        if (links) links.classList.remove('open');
        if (toggle) toggle.classList.remove('open');
    }

    // --------------------------------------------
    // Cleanup before navigating away
    // --------------------------------------------
    function cleanup() {
        // Destroy any Chart.js instances
        if (window.Chart && window.Chart.instances) {
            try {
                // Chart.js v4 uses a Map-like registry
                var instances = window.Chart.instances;
                if (typeof instances.forEach === 'function') {
                    instances.forEach(function(chart){ try { chart.destroy(); } catch(_){} });
                } else {
                    Object.keys(instances).forEach(function(k){
                        try { instances[k].destroy(); } catch(_){}
                    });
                }
            } catch (e) {}
        }
        // Clear any timers tracked on window
        if (window.__bflfp_intervals) {
            window.__bflfp_intervals.forEach(function(id){ clearInterval(id); });
            window.__bflfp_intervals = [];
        }
    }

    // --------------------------------------------
    // Fetch a fragment (with cache)
    // --------------------------------------------
    function loadFragment(url) {
        if (fragmentCache[url]) {
            return Promise.resolve(fragmentCache[url]);
        }
        return fetch(url).then(function(r){
            if (!r.ok) throw new Error('Fragment 404: ' + url);
            return r.text();
        }).then(function(html){
            fragmentCache[url] = html;
            return html;
        });
    }

    // --------------------------------------------
    // Load Chart.js if needed (only once)
    // --------------------------------------------
    var chartJsLoaded = false;
    function ensureChartJs() {
        if (chartJsLoaded || window.Chart) {
            chartJsLoaded = true;
            return Promise.resolve();
        }
        return new Promise(function(resolve, reject){
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
            s.onload = function(){ chartJsLoaded = true; resolve(); };
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // --------------------------------------------
    // Load and execute a page script (always re-execute on nav)
    // We append a unique query string each time so the IIFE re-runs and rebinds to fresh DOM.
    // --------------------------------------------
    function loadPageScript(src) {
        return new Promise(function(resolve, reject){
            // Remove any previous instance of this script tag
            var existing = document.querySelector('script[data-bflfp-page]');
            if (existing) existing.parentNode.removeChild(existing);

            var s = document.createElement('script');
            s.src = src + '?t=' + Date.now();
            s.dataset.bflfpPage = '1';
            s.onload = resolve;
            s.onerror = reject;
            document.body.appendChild(s);
        });
    }

    // --------------------------------------------
    // Main render function
    // --------------------------------------------
    var rendering = false;
    function render() {
        if (rendering) return;
        rendering = true;

        var route = currentRoute();
        var conf = ROUTES[route];
        document.title = conf.title + ' — BFLFP Maintenance Portal';

        // Show loading state
        app.innerHTML = '<div class="spa-loader"><div class="spa-spinner"></div><p>Loading…</p></div>';
        updateActiveNav(route);

        // Cleanup outgoing page
        cleanup();

        // Pages that need Chart.js
        var needsChartJs = (route === 'dashboard' || route === 'reports');

        var prep = needsChartJs ? ensureChartJs() : Promise.resolve();

        prep
            .then(function(){ return loadFragment(conf.fragment); })
            .then(function(html){
                app.innerHTML = html;
                // Strip any <script src="chart.js"> tags from the injected fragment — we handle that ourselves
                var injectedScripts = app.querySelectorAll('script[src*="chart.js"]');
                injectedScripts.forEach(function(s){ s.parentNode.removeChild(s); });
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'instant' in window.scrollTo ? 'instant' : 'auto' });
                return loadPageScript(conf.script);
            })
            .then(function(){
                rendering = false;
            })
            .catch(function(err){
                console.error('[SPA] Render failed:', err);
                app.innerHTML = '<div class="spa-error">' +
                    '<h2>Could not load page</h2>' +
                    '<p>' + (err.message || 'Unknown error') + '</p>' +
                    '<button onclick="location.reload()">Reload</button>' +
                    '</div>';
                rendering = false;
            });
    }

    // --------------------------------------------
    // Intercept clicks on hash links so we re-render even if hash didn't change
    // --------------------------------------------
    function initNavClicks() {
        document.addEventListener('click', function(e){
            var a = e.target.closest && e.target.closest('a');
            if (!a) return;
            var href = a.getAttribute('href') || '';
            if (href.charAt(0) !== '#') return;
            // If clicking the currently-active link, do nothing extra
            if (location.hash === href || (href === '#home' && (!location.hash || location.hash === '#'))) {
                // Already there — scroll to top
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    // --------------------------------------------
    // Initial render + hashchange listener
    // --------------------------------------------
    function init() {
        if (!app) {
            console.error('[SPA] No #app container found');
            return;
        }
        // Normalize hash on load
        if (!location.hash || location.hash === '#') {
            history.replaceState(null, '', '#home');
        }
        initNavClicks();
        window.addEventListener('hashchange', render);
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
