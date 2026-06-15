/* ============================================
   BFLFP — MASTER JS (app-shell: theme toggle, sidebar, role, route highlight)
   Loaded on every page.
   ============================================ */

(function () {
    'use strict';

    var THEME_KEY = 'bflfp.theme';
    var SIDEBAR_KEY = 'bflfp.sidebar.collapsed';

    // ============================================
    // THEME TOGGLE — light / dark
    // ============================================
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        var lbl = document.querySelector('.theme-toggle-label');
        if (lbl) lbl.textContent = theme === 'dark' ? 'Dark' : 'Light';
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
    }

    function initTheme() {
        var saved = null;
        try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
        // Respect OS preference if user has never chosen
        if (!saved) {
            saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        }
        applyTheme(saved);

        var btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.addEventListener('click', function () {
                var current = document.documentElement.getAttribute('data-theme') || 'light';
                applyTheme(current === 'dark' ? 'light' : 'dark');
            });
        }
    }

    // ============================================
    // SIDEBAR — desktop collapse + mobile drawer
    // ============================================
    function initSidebar() {
        var shell    = document.getElementById('app-shell');
        var sidebar  = document.getElementById('app-sidebar');
        var collapseBtn = document.getElementById('sidebar-collapse-btn');
        var menuBtn  = document.getElementById('topbar-menu-btn');
        var overlay  = document.getElementById('sidebar-overlay');

        if (!shell || !sidebar) return;

        // Restore collapsed state (desktop)
        var saved = null;
        try { saved = localStorage.getItem(SIDEBAR_KEY); } catch (e) { /* ignore */ }
        if (saved === '1') shell.classList.add('is-collapsed');

        // Desktop: collapse / expand
        if (collapseBtn) {
            collapseBtn.addEventListener('click', function () {
                var isCollapsed = shell.classList.toggle('is-collapsed');
                try { localStorage.setItem(SIDEBAR_KEY, isCollapsed ? '1' : '0'); } catch (e) { /* ignore */ }
            });
        }

        // Mobile: open / close drawer
        function openDrawer()  { sidebar.classList.add('is-open');  if (overlay) overlay.hidden = false; }
        function closeDrawer() { sidebar.classList.remove('is-open'); if (overlay) overlay.hidden = true;  }

        if (menuBtn) menuBtn.addEventListener('click', openDrawer);
        if (overlay) overlay.addEventListener('click', closeDrawer);

        // Close drawer on nav click (mobile only)
        sidebar.addEventListener('click', function (e) {
            var item = e.target.closest('a.nav-item');
            if (item && window.innerWidth <= 900) closeDrawer();
        });

        // Cmd/Ctrl+B keyboard shortcut to toggle sidebar
        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                if (window.innerWidth <= 900) {
                    if (sidebar.classList.contains('is-open')) closeDrawer(); else openDrawer();
                } else if (collapseBtn) {
                    collapseBtn.click();
                }
            }
        });
    }

    // ============================================
    // ACTIVE NAV ROUTE — highlight current item + mark containing group
    // ============================================
    function getCurrentRoute() {
        var h = (location.hash || '#dashboard').replace(/^#/, '').split('?')[0].split('/')[0];
        return h || 'dashboard';
    }
    function refreshActiveRoute() {
        var route = getCurrentRoute();
        // Clear previous
        document.querySelectorAll('.nav-group').forEach(function (g) { g.classList.remove('has-active'); });
        // Set active item + mark parent group
        document.querySelectorAll('.nav-item').forEach(function (a) {
            var isActive = a.getAttribute('data-route') === route;
            a.classList.toggle('active', isActive);
            if (isActive) {
                var grp = a.closest('.nav-group');
                if (grp) {
                    grp.classList.add('has-active');
                    // Auto-expand the group containing the active route
                    if (grp.classList.contains('is-collapsed')) {
                        grp.classList.remove('is-collapsed');
                        grp.classList.add('is-expanded');
                        var hdr = grp.querySelector('.nav-group-header');
                        if (hdr) hdr.setAttribute('aria-expanded', 'true');
                    }
                }
            }
        });
    }
    function initRouteHighlight() {
        refreshActiveRoute();
        window.addEventListener('hashchange', refreshActiveRoute);
    }

    // ============================================
    // COLLAPSIBLE NAV GROUPS — click header to toggle, persist state
    // ============================================
    var GROUP_STATE_KEY = 'bflfp.nav.groups';

    function loadGroupState() {
        try {
            var raw = localStorage.getItem(GROUP_STATE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }
    function saveGroupState(state) {
        try { localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }

    function initCollapsibleGroups() {
        var saved = loadGroupState();

        // Restore saved expand/collapse state per group
        document.querySelectorAll('.nav-group[data-group]').forEach(function (grp) {
            var key = grp.getAttribute('data-group');
            if (saved.hasOwnProperty(key)) {
                if (saved[key]) {
                    grp.classList.add('is-expanded');
                    grp.classList.remove('is-collapsed');
                } else {
                    grp.classList.add('is-collapsed');
                    grp.classList.remove('is-expanded');
                }
                var hdr = grp.querySelector('.nav-group-header');
                if (hdr) hdr.setAttribute('aria-expanded', saved[key] ? 'true' : 'false');
            }
        });

        // Wire click on each header to toggle
        document.querySelectorAll('.nav-group-header').forEach(function (hdr) {
            hdr.addEventListener('click', function () {
                var grp = hdr.closest('.nav-group');
                if (!grp) return;
                var key = grp.getAttribute('data-group');
                var isCollapsed = grp.classList.contains('is-collapsed');
                if (isCollapsed) {
                    grp.classList.remove('is-collapsed');
                    grp.classList.add('is-expanded');
                    hdr.setAttribute('aria-expanded', 'true');
                } else {
                    grp.classList.add('is-collapsed');
                    grp.classList.remove('is-expanded');
                    hdr.setAttribute('aria-expanded', 'false');
                }
                var state = loadGroupState();
                state[key] = !isCollapsed ? false : true;
                saveGroupState(state);
            });
        });
    }

    // ============================================
    // ANNOUNCEMENT DATE (now in topbar)
    // ============================================
    function initAnnouncementDate() {
        var el = document.getElementById('announcement-date');
        if (!el) return;
        var d = new Date();
        try {
            el.textContent = d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            el.textContent = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
        }
    }

    // ============================================
    // ROLE SWITCHER (kept from old layout, now in sidebar)
    // ============================================
    function initRoleSwitcher() {
        if (!window.BFLFP_User) return;
        var $btn    = document.getElementById('role-switcher-btn');
        var $menu   = document.getElementById('role-switcher-menu');
        var $icon   = document.getElementById('role-switcher-icon');
        var $label  = document.getElementById('role-switcher-label');
        var $avatar = document.querySelector('.role-switcher-avatar');
        if (!$btn || !$menu) return;

        function refreshButton() {
            $icon.textContent  = BFLFP_User.getRoleIcon();
            $label.textContent = BFLFP_User.getRoleLabel();
            if ($avatar) $avatar.style.background = BFLFP_User.getRoleColour();
            document.body.setAttribute('data-bflfp-role', BFLFP_User.getRole());
        }
        refreshButton();

        var menuHTML = '';
        BFLFP_User.switcherRoles().forEach(function (key) {
            var r = BFLFP_User.ROLES[key];
            var active = (BFLFP_User.getRole() === key);
            menuHTML += '<button type="button" class="role-menu-item ' + (active ? 'is-active' : '') + '" data-role="' + key + '">' +
                '<span class="role-menu-icon" style="color:' + r.colour + '">' + r.icon + '</span>' +
                '<span class="role-menu-label">' +
                  '<strong>' + r.label_en + '</strong>' +
                  '<small>' + r.label_th + '</small>' +
                '</span>' +
                (active ? '<span class="role-menu-check">✓</span>' : '') +
                '</button>';
        });
        $menu.innerHTML = menuHTML;

        $btn.addEventListener('click', function (e) {
            e.stopPropagation();
            $menu.hidden = !$menu.hidden;
        });
        document.addEventListener('click', function (e) {
            if (!$menu.contains(e.target) && !$btn.contains(e.target)) {
                $menu.hidden = true;
            }
        });
        $menu.addEventListener('click', function (e) {
            var item = e.target.closest('.role-menu-item');
            if (!item) return;
            var newRole = item.getAttribute('data-role');
            if (newRole && newRole !== BFLFP_User.getRole()) {
                BFLFP_User.setRole(newRole);
            } else {
                $menu.hidden = true;
            }
        });
    }

    // ============================================
    // QUICK FIND — Cmd/Ctrl+K focuses the sidebar search
    // ============================================
    function initQuickFind() {
        var input = document.getElementById('sidebar-search-input');
        if (!input) return;
        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                input.focus();
                input.select();
            }
        });
        // Live-filter nav items as user types
        input.addEventListener('input', function () {
            var q = (input.value || '').trim().toLowerCase();
            document.querySelectorAll('.nav-item').forEach(function (a) {
                var t = (a.textContent || '').toLowerCase();
                var route = (a.getAttribute('data-route') || '').toLowerCase();
                var match = !q || t.indexOf(q) !== -1 || route.indexOf(q) !== -1;
                a.style.display = match ? '' : 'none';
            });
            document.querySelectorAll('.nav-group').forEach(function (g) {
                var anyVisible = Array.prototype.some.call(g.querySelectorAll('.nav-item'), function (a) { return a.style.display !== 'none'; });
                g.style.display = anyVisible ? '' : 'none';
            });
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                input.value = '';
                input.dispatchEvent(new Event('input'));
                input.blur();
            }
        });
    }

    function init() {
        initTheme();
        initSidebar();
        initCollapsibleGroups();   /* restore expand/collapse state first */
        initRouteHighlight();      /* then auto-expand the group containing the active route */
        initAnnouncementDate();
        initRoleSwitcher();
        initQuickFind();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
