/* ============================================
   BFLFP — Shared PM completions localStorage helper
   Used by print/checklist.html (fill mode) and pages/pm-completions.html
   ============================================ */
window.BFLFP_PMStore = (function() {
    'use strict';
    var KEY = 'bflfp_pm_completions_v1';

    function getAll() {
        try {
            var raw = localStorage.getItem(KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('[PMStore] read failed:', e);
            return [];
        }
    }
    function save(arr) {
        try {
            localStorage.setItem(KEY, JSON.stringify(arr));
            return true;
        } catch (e) {
            console.error('[PMStore] write failed:', e);
            return false;
        }
    }
    function add(record) {
        var arr = getAll();
        if (!record.id) {
            record.id = 'pmc-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
        }
        if (!record.submitted_at) {
            record.submitted_at = new Date().toISOString();
        }
        arr.push(record);
        save(arr);
        return record;
    }
    function remove(id) {
        var arr = getAll().filter(function(r){ return r.id !== id; });
        save(arr);
    }
    function clear() {
        save([]);
    }
    function count() {
        return getAll().length;
    }
    function exportJSON() {
        var arr = getAll();
        return {
            version: 1,
            generated: new Date().toISOString().slice(0,10),
            count: arr.length,
            completions: arr
        };
    }
    function downloadJSON(filename) {
        var payload = exportJSON();
        var blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename || ('pm_completions_' + new Date().toISOString().slice(0,10) + '.json');
        document.body.appendChild(a);
        a.click();
        setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }
    function importJSON(json) {
        // Merge external completions with current localStorage
        var existing = getAll();
        var existingIds = {};
        existing.forEach(function(r){ existingIds[r.id] = true; });
        var added = 0;
        var arr = (json && json.completions) || [];
        arr.forEach(function(r){
            if (!existingIds[r.id]) { existing.push(r); added++; }
        });
        save(existing);
        return added;
    }

    return {
        getAll: getAll, add: add, remove: remove, clear: clear, count: count,
        exportJSON: exportJSON, downloadJSON: downloadJSON, importJSON: importJSON
    };
})();
