/* ============================================
   BFLFP — PM Completions Admin page
   ============================================ */
(function() {
    'use strict';

    // Ensure storage helper is loaded
    function ensureStore() {
        if (window.BFLFP_PMStore) return Promise.resolve();
        return new Promise(function(resolve, reject){
            var s = document.createElement('script');
            s.src = 'assets/pm-storage.js?v=' + Date.now();
            s.onload = resolve;
            s.onerror = function(){ reject(new Error('Failed to load pm-storage.js')); };
            document.head.appendChild(s);
        });
    }

    var $tbody = document.getElementById('pmc-tbody');
    var $sT = document.getElementById('pmc-stat-total');
    var $sP = document.getElementById('pmc-stat-pass');
    var $sF = document.getElementById('pmc-stat-fail');
    var $btnDl = document.getElementById('btn-download-all');
    var $btnClear = document.getElementById('btn-clear');
    var $btnImport = document.getElementById('btn-import');
    var $importFile = document.getElementById('pmc-import');
    var $modal = document.getElementById('pmc-modal');
    var $modalTitle = document.getElementById('pmc-modal-title');
    var $modalBody = document.getElementById('pmc-modal-body');
    var $modalClose = document.getElementById('pmc-modal-close');
    var $count = document.getElementById('pmc-count-note');

    function esc(s){
        return (s==null?'':String(s))
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function fmtDT(s){
        if (!s) return '—';
        var d = new Date(s);
        if (isNaN(d)) return s;
        return d.toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    }

    // In-memory cache of the merged dataset so detail view can find rows by id
    var mergedRows = [];

    function fetchCompletions() {
        // Pull from SharePoint flow if available; otherwise local only
        var localRows = window.BFLFP_PMStore ? window.BFLFP_PMStore.getAll() : [];
        // Tag local rows with source for display logic
        localRows.forEach(function(r){
            if (r.synced) r._source = 'sp-local';
            else r._source = 'local-pending';
        });

        if (window.BFLFP && window.BFLFP.data && window.BFLFP.data.completions) {
            return window.BFLFP.data.completions()
                .then(function(data){
                    var spRows = (data && data.completions) ? data.completions : (Array.isArray(data) ? data : []);
                    // Tag SharePoint rows
                    spRows.forEach(function(r){
                        r._source = 'sharepoint';
                        // Reshape task fields: SharePoint stores tasks as a JSON string
                        if (typeof r.tasks_json === 'string' && r.tasks_json && !r.tasks) {
                            try { r.tasks = JSON.parse(r.tasks_json.replace(/'/g, '"')); }
                            catch(e) { r.tasks = []; }
                        }
                        // Map fields to match local schema
                        if (!r.asset_name && r.asset_class) r.asset_name = r.asset_class;
                        if (!r.id) r.id = 'sp-' + (r.id_sharepoint || r.ID || Math.random().toString(36).slice(2));
                    });
                    // Dedupe: skip local-synced rows that match a SharePoint row
                    var spIds = {};
                    spRows.forEach(function(r){
                        var key = (r.asset_id||'') + '|' + (r.pm_date||'') + '|' + (r.technician||'');
                        spIds[key] = true;
                    });
                    var dedupedLocal = localRows.filter(function(r){
                        var key = (r.asset_id||'') + '|' + (r.pm_date||'') + '|' + (r.technician||'');
                        return !spIds[key]; // keep only local entries not already in SharePoint
                    });
                    return spRows.concat(dedupedLocal);
                })
                .catch(function(err){
                    console.warn('[PMC] SharePoint fetch failed, using local only:', err);
                    return localRows;
                });
        }
        return Promise.resolve(localRows);
    }

    function badgeForSource(src) {
        if (src === 'sharepoint')   return '<span class="src-badge src-cloud" title="Stored in SharePoint">☁ Cloud</span>';
        if (src === 'sp-local')     return '<span class="src-badge src-cloud" title="Synced to SharePoint">☁ Synced</span>';
        if (src === 'local-pending')return '<span class="src-badge src-local" title="Saved locally — not yet in SharePoint">⏳ Local</span>';
        return '';
    }

    function render() {
        fetchCompletions().then(function(arr){
            mergedRows = arr;
            var passCount = arr.filter(function(r){ return /pass/i.test(r.overall_result) && !/finding/i.test(r.overall_result); }).length;
            var failCount = arr.filter(function(r){ return /fail/i.test(r.overall_result) || /finding/i.test(r.overall_result); }).length;
            var pendingCount = arr.filter(function(r){ return r._source === 'local-pending'; }).length;

            $sT.textContent = arr.length;
            $sP.textContent = passCount;
            $sF.textContent = failCount;

            var localOnly = window.BFLFP_PMStore ? window.BFLFP_PMStore.getAll() : [];
            $btnClear.disabled = (localOnly.length === 0);
            $btnDl.disabled = (localOnly.length === 0);

            if (arr.length === 0) {
                $tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No PM completions yet. Submit one via the Print Checklist Fill Mode to get started.</td></tr>';
                $count.textContent = '';
                return;
            }
            // Sort newest first
            arr.sort(function(a,b){
                var sa = a.submitted_at || a.pm_date || '';
                var sb = b.submitted_at || b.pm_date || '';
                return sb.localeCompare(sa);
            });
            $tbody.innerHTML = arr.map(function(r){
                var taskSum = r.tasks ? (r.tasks.filter(function(t){return t.result==='R';}).length + '/' + r.tasks.length + ' OK')
                                       : (typeof r.tasks_passed !== 'undefined' ? (r.tasks_passed + '/' + (Number(r.tasks_passed)+Number(r.tasks_failed||0)+Number(r.tasks_na||0)) + ' OK') : '—');
                var resCls = /fail/i.test(r.overall_result) ? 'res-fail' : /finding/i.test(r.overall_result) ? 'res-warn' : 'res-pass';
                var showDelete = (r._source !== 'sharepoint'); // Don't allow deleting SharePoint rows from this UI
                return '<tr data-id="' + esc(r.id) + '">' +
                    '<td>' + fmtDT(r.submitted_at) + ' ' + badgeForSource(r._source) + '</td>' +
                    '<td><code>' + esc(r.asset_id||'—') + '</code><br><small>' + esc((r.asset_name||'').slice(0,30)) + '</small></td>' +
                    '<td>' + esc((r.pm_date||'').slice(0,10)) + '</td>' +
                    '<td>' + esc(r.technician||'—') + '</td>' +
                    '<td>' + esc(r.pm_type||'—') + '</td>' +
                    '<td><span class="res-pill ' + resCls + '">' + esc(r.overall_result||'—') + '</span></td>' +
                    '<td>' + taskSum + '</td>' +
                    '<td><small>' + esc((r.notes||'').slice(0,50)) + (r.notes && r.notes.length>50?'…':'') + '</small></td>' +
                    '<td>' +
                        '<button class="btn-view" data-id="' + esc(r.id) + '">View</button> ' +
                        (showDelete ? '<button class="btn-del" data-id="' + esc(r.id) + '" title="Delete local copy">🗑️</button>' : '') +
                    '</td>' +
                    '</tr>';
            }).join('');
            var src = arr.filter(function(r){ return r._source === 'sharepoint'; }).length;
            $count.textContent = arr.length + ' completion(s) total · ' + src + ' in SharePoint' + (pendingCount > 0 ? ' · ' + pendingCount + ' pending local upload' : '');
        });
    }

    function openDetail(id) {
        // Look in merged list (covers both SharePoint + local), fall back to local store
        var r = (mergedRows || []).find(function(x){ return x.id === id; }) ||
                (window.BFLFP_PMStore ? window.BFLFP_PMStore.getAll().find(function(x){ return x.id === id; }) : null);
        if (!r) return;
        $modalTitle.textContent = (r.asset_id||'?') + ' — ' + (r.asset_name||'') + ' — ' + (r.pm_date||'');
        var html = '<dl class="pmc-dl">';
        html += '<dt>Submitted at</dt><dd>' + fmtDT(r.submitted_at) + '</dd>';
        html += '<dt>Asset</dt><dd><code>' + esc(r.asset_id||'—') + '</code> — ' + esc(r.asset_name||'') + '</dd>';
        html += '<dt>PM Date</dt><dd>' + esc(r.pm_date||'—') + '</dd>';
        html += '<dt>Technician</dt><dd>' + esc(r.technician||'—') + '</dd>';
        html += '<dt>PM Type</dt><dd>' + esc(r.pm_type||'—') + '</dd>';
        html += '<dt>Overall Result</dt><dd>' + esc(r.overall_result||'—') + '</dd>';
        if (r.notes) html += '<dt>Notes</dt><dd>' + esc(r.notes) + '</dd>';
        html += '</dl>';
        if (r.tasks && r.tasks.length) {
            html += '<table class="pmc-task-table"><thead><tr><th>#</th><th>Description</th><th>Result</th><th>Measured</th><th>Finding</th><th>Action</th></tr></thead><tbody>';
            r.tasks.forEach(function(t){
                html += '<tr>' +
                    '<td>' + t.task_no + '</td>' +
                    '<td>' + esc(t.description||'') + '</td>' +
                    '<td><strong>' + esc(t.result||'') + '</strong></td>' +
                    '<td>' + esc(t.measured||'') + '</td>' +
                    '<td>' + esc(t.finding||'') + '</td>' +
                    '<td>' + esc(t.action||'') + '</td>' +
                    '</tr>';
            });
            html += '</tbody></table>';
        }
        $modalBody.innerHTML = html;
        $modal.hidden = false;
    }
    function closeDetail(){ $modal.hidden = true; }

    function bindEvents() {
        $btnDl.addEventListener('click', function(){
            window.BFLFP_PMStore.downloadJSON();
        });
        $btnClear.addEventListener('click', function(){
            if (!confirm('Clear all PM completions from THIS browser? Make sure you downloaded first!')) return;
            window.BFLFP_PMStore.clear();
            render();
        });
        $btnImport.addEventListener('click', function(){ $importFile.click(); });
        $importFile.addEventListener('change', function(e){
            var f = e.target.files[0];
            if (!f) return;
            var reader = new FileReader();
            reader.onload = function(ev){
                try {
                    var json = JSON.parse(ev.target.result);
                    var added = window.BFLFP_PMStore.importJSON(json);
                    alert('Imported. Added ' + added + ' new completion(s) to local browser.');
                    render();
                } catch (err) {
                    alert('Could not parse JSON: ' + err.message);
                }
                $importFile.value = '';
            };
            reader.readAsText(f);
        });
        $tbody.addEventListener('click', function(e){
            var v = e.target.closest('.btn-view');
            if (v) { openDetail(v.getAttribute('data-id')); return; }
            var d = e.target.closest('.btn-del');
            if (d) {
                if (confirm('Delete this completion from local browser?')) {
                    window.BFLFP_PMStore.remove(d.getAttribute('data-id'));
                    render();
                }
                return;
            }
        });
        $modalClose.addEventListener('click', closeDetail);
        $modal.addEventListener('click', function(e){ if (e.target === $modal) closeDetail(); });
        document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeDetail(); });
    }

    ensureStore().then(function(){
        bindEvents();
        render();
    }).catch(function(err){
        $tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Failed to load storage: ' + err.message + '</td></tr>';
    });
})();
