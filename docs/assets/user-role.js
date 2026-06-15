/* ============================================
   BFLFP — User & Role module
   Defines roles + permissions. Switchable via UI dropdown or ?role=XXX URL param.
   Public role hidden in switcher until ready for general access.
   Future: replace readRole() with a fetch from SharePoint UserRole list.
   ============================================ */
window.BFLFP_User = (function () {
    'use strict';

    var STORAGE_KEY = 'bflfp_user_role';
    var DEFAULT_LOCAL_ROLE  = 'admin';
    var DEFAULT_REMOTE_ROLE = 'technician';

    // Permission matrix — what each role can do
    var ROLES = {
        public: {
            label_en: 'Public Viewer',
            label_th: 'ผู้เยี่ยมชม',
            colour: '#94A3B8',
            icon: '👁',
            hidden_from_switcher: true,  // not ready for production
            can: {
                view_assets:      true,
                view_schedule:    true,
                view_dashboard:   true,
                view_maintenance: true,
                view_completions: true,
                view_reports:     true,
                print_checklist:  true,
                fill_pm:          false,
                edit_assets:      false,
                add_assets:       false,
                edit_checklists:  false,
                map_aliases:      false,
                bulk_print:       false,
                admin:            false
            }
        },
        technician: {
            label_en: 'Technician',
            label_th: 'ช่างเทคนิค',
            colour: '#16A34A',
            icon: '🔧',
            can: {
                view_assets:      true,
                view_schedule:    true,
                view_dashboard:   true,
                view_maintenance: true,
                view_completions: true,
                view_reports:     true,
                print_checklist:  true,
                fill_pm:          true,
                edit_assets:      false,
                add_assets:       false,
                edit_checklists:  false,
                map_aliases:      false,
                bulk_print:       true,
                admin:            false
            }
        },
        planner: {
            label_en: 'Planner',
            label_th: 'ผู้วางแผน',
            colour: '#F97316',
            icon: '📋',
            can: {
                view_assets:      true,
                view_schedule:    true,
                view_dashboard:   true,
                view_maintenance: true,
                view_completions: true,
                view_reports:     true,
                print_checklist:  true,
                fill_pm:          true,
                edit_assets:      true,
                add_assets:       true,
                edit_checklists:  true,
                map_aliases:      true,
                bulk_print:       true,
                admin:            false
            }
        },
        admin: {
            label_en: 'Administrator',
            label_th: 'ผู้ดูแลระบบ',
            colour: '#DC2626',
            icon: '⚙',
            can: {
                view_assets:      true,
                view_schedule:    true,
                view_dashboard:   true,
                view_maintenance: true,
                view_completions: true,
                view_reports:     true,
                print_checklist:  true,
                fill_pm:          true,
                edit_assets:      true,
                add_assets:       true,
                edit_checklists:  true,
                map_aliases:      true,
                bulk_print:       true,
                admin:            true
            }
        }
    };

    function readRole() {
        // Priority: URL param > localStorage > default per environment
        try {
            var p = new URLSearchParams(location.search);
            var fromUrl = p.get('role');
            if (fromUrl && ROLES[fromUrl]) {
                localStorage.setItem(STORAGE_KEY, fromUrl);
                return fromUrl;
            }
        } catch (e) {}
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored && ROLES[stored]) return stored;
        } catch (e) {}
        // Default — localhost = admin (dev), remote = technician
        var isLocal = location.hostname === 'localhost' ||
                      location.hostname === '127.0.0.1' ||
                      location.hostname === '';
        return isLocal ? DEFAULT_LOCAL_ROLE : DEFAULT_REMOTE_ROLE;
    }

    var currentRole = readRole();

    function getRole()       { return currentRole; }
    function getRoleObj()    { return ROLES[currentRole] || ROLES.public; }
    function getRoleLabel()  { return getRoleObj().label_en; }
    function getRoleIcon()   { return getRoleObj().icon; }
    function getRoleColour() { return getRoleObj().colour; }
    function can(action)     { return !!getRoleObj().can[action]; }
    function is(role)        { return currentRole === role; }
    function isAtLeast(role) {
        var order = ['public','technician','planner','admin'];
        return order.indexOf(currentRole) >= order.indexOf(role);
    }

    function setRole(role, reload) {
        if (!ROLES[role]) return false;
        currentRole = role;
        try { localStorage.setItem(STORAGE_KEY, role); } catch (e) {}
        document.dispatchEvent(new CustomEvent('bflfp:role-changed', { detail: { role: role } }));
        if (reload !== false) {
            // Reload page so all permission gates re-apply
            setTimeout(function () { location.reload(); }, 200);
        }
        return true;
    }

    // List of roles to show in the switcher (filters out hidden ones like 'public' for now)
    function switcherRoles() {
        return Object.keys(ROLES).filter(function (k) { return !ROLES[k].hidden_from_switcher; });
    }

    return {
        ROLES: ROLES,
        getRole: getRole,
        getRoleObj: getRoleObj,
        getRoleLabel: getRoleLabel,
        getRoleIcon: getRoleIcon,
        getRoleColour: getRoleColour,
        can: can,
        is: is,
        isAtLeast: isAtLeast,
        setRole: setRole,
        switcherRoles: switcherRoles
    };
})();
