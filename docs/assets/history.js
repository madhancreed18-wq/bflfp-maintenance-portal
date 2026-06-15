/* ============================================
   BFLFP — Machine History Report (F-SP-ENG02-02)
   Reads MaintenanceLog filtered by asset.
   ============================================ */

(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }
    function fmtDateLong(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        var be = d.getFullYear() + 543;
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + be;
    }
    function fmtDateISO(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }

    var $asset    = $('hist-asset');
    var $from     = $('hist-from');
    var $to       = $('hist-to');
    var $jobtype  = $('hist-jobtype');
    var $gen      = $('hist-generate');
    var $print    = $('hist-print');
    var $report   = $('hist-report-container');

    function setStat(id, v) { var el = $(id); if (el) el.textContent = (v == null ? '—' : v); }

    function populateAssets(assets) {
        if (!$asset) return;
        var html = '<option value="">Pick an asset…</option>';
        var sorted = (assets || [])
            .filter(function (a) { return a && a.asset_id; })
            .sort(function (a, b) { return a.asset_id.localeCompare(b.asset_id); });
        sorted.forEach(function (a) {
            html += '<option value="' + esc(a.asset_id) + '">' +
                esc(a.asset_id) + ' · ' + esc(a.name || a.class_name || '') +
                '</option>';
        });
        $asset.innerHTML = html;
        // Optionally preselect from URL hash query (?asset=W01AC01)
        var hash = location.hash || '';
        var m = hash.match(/[?&]asset=([A-Z0-9]+)/);
        if (m) $asset.value = m[1];
    }

    function inDateRange(iso, fromStr, toStr) {
        if (!iso) return false;
        var d = new Date(iso);
        if (isNaN(d.getTime())) return false;
        if (fromStr) { var fd = new Date(fromStr); if (d < fd) return false; }
        if (toStr)   { var td = new Date(toStr); td.setHours(23,59,59); if (d > td) return false; }
        return true;
    }

    function render(rows, asset) {
        var totals = { total: rows.length, pm: 0, corr: 0, bd: 0 };
        rows.forEach(function (r) {
            var jt = r.JobType || '';
            if (jt === 'Preventive')             totals.pm++;
            if (jt === 'Corrective' || jt === 'Repair') totals.corr++;
            if (jt === 'Breakdown')              totals.bd++;
        });
        setStat('hist-stat-total', totals.total);
        setStat('hist-stat-pm',    totals.pm);
        setStat('hist-stat-corr',  totals.corr);
        setStat('hist-stat-bd',    totals.bd);

        var html = '';
        html += '<div class="rep-doc">';
        html += '  <div class="rep-doc-header">';
        html += '    <img src="./assets/Bluefalo.png" alt="BFL" class="rep-doc-logo">';
        html += '    <div class="rep-doc-titles">';
        html += '      <h2>บริษัท บลูฟาโลฟู้ด โปรดักส์ จำกัด</h2>';
        html += '      <p>ประวัติการซ่อมบำรุงเครื่อง · Machine Maintenance History</p>';
        html += '    </div>';
        html += '    <div class="rep-doc-meta">F-SP-ENG02-02 Rev.02</div>';
        html += '  </div>';

        html += '  <div class="rep-doc-strip" style="grid-template-columns: 80px 1fr 1fr 1fr;">';
        html += '    <div class="rep-strip-label">รหัส / Code</div>';
        html += '    <div><strong>' + esc(asset.asset_id) + '</strong></div>';
        html += '    <div>ชื่อ / Name: ' + esc(asset.name || '') + '</div>';
        html += '    <div>กลุ่ม / Class: ' + esc(asset.class_name || asset.class_abbr || '') + '</div>';
        html += '  </div>';

        html += '  <table class="rep-doc-table">';
        html += '    <thead><tr>';
        html += '      <th style="width: 40px;">#</th>';
        html += '      <th style="width: 100px;">เลขที่<br><small>Job ID</small></th>';
        html += '      <th style="width: 110px;">วันที่<br><small>Date</small></th>';
        html += '      <th style="width: 90px;">ประเภท<br><small>Type</small></th>';
        html += '      <th>ปัญหา<br><small>Problem</small></th>';
        html += '      <th>รายละเอียดการซ่อมบำรุง<br><small>Repair Details</small></th>';
        html += '      <th style="width: 110px;">ผู้บันทึก<br><small>Recorder</small></th>';
        html += '    </tr></thead>';
        html += '    <tbody>';

        if (!rows.length) {
            html += '<tr class="rep-row-empty"><td colspan="7">No maintenance events recorded for this asset.</td></tr>';
        } else {
            rows.forEach(function (r, i) {
                var jt = r.JobType || '';
                var jobPill = jt ? '<span class="rep-job-type-pill rep-jt-' + esc(jt) + '">' + esc(jt) + '</span>' : '';
                html += '<tr>';
                html += '  <td class="rep-cell-center">' + (i + 1) + '</td>';
                html += '  <td class="rep-cell-mono rep-cell-center">' + esc(r.JobID || r.Title || ('ID ' + (r.ID || ''))) + '</td>';
                html += '  <td class="rep-cell-center">' + esc(fmtDateLong(r.StartTime || r.start_time || r.PlannedDate)) + '</td>';
                html += '  <td class="rep-cell-center">' + jobPill + '</td>';
                html += '  <td>' + esc(r.Problem || '') + '</td>';
                html += '  <td>' + esc(r.Solution || '') + '</td>';
                html += '  <td>' + esc(r.ActionBy || r.AssignedTo || '') + '</td>';
                html += '</tr>';
            });
        }
        html += '    </tbody></table>';

        html += '  <div class="rep-doc-footer">';
        html += '    BFLFP — Bluefalo Food Products · ' + esc(asset.asset_id) + ' · Lifetime history · Form F-SP-ENG02-02 Rev.02';
        html += '  </div>';
        html += '</div>';

        $report.innerHTML = html;
    }

    function generate() {
        var aid = $asset.value;
        if (!aid) {
            $report.innerHTML = '<div class="rep-loading"><p>Pick an asset and click Generate.</p></div>';
            return;
        }
        $report.innerHTML = '<div class="rep-loading"><div class="rep-loading-spinner"></div><p>Loading history for ' + esc(aid) + '…</p></div>';

        if (!window.BFLFP_Data) return;

        Promise.all([
            window.BFLFP_Data.assets ? window.BFLFP_Data.assets().catch(function () { return []; }) : Promise.resolve([]),
            window.BFLFP_Data.maintenanceLog ? window.BFLFP_Data.maintenanceLog().catch(function () { return []; }) : Promise.resolve([])
        ]).then(function (results) {
            var assetsRaw = results[0];
            var assets = Array.isArray(assetsRaw) ? assetsRaw : (assetsRaw && assetsRaw.assets) || [];
            var allLogs = Array.isArray(results[1]) ? results[1] : (results[1] && results[1].items) || [];
            var asset = assets.find(function (a) { return a && a.asset_id === aid; }) || { asset_id: aid };

            var rows = allLogs.filter(function (r) {
                var rAid = r.MachineID || r.Machine || r.AssetID || r.Title || '';
                return rAid === aid || rAid.indexOf(aid) !== -1;
            });
            rows = rows.filter(function (r) { return inDateRange(r.StartTime || r.start_time || r.PlannedDate, $from.value, $to.value); });
            if ($jobtype.value) {
                rows = rows.filter(function (r) { return (r.JobType || '') === $jobtype.value; });
            }
            rows.sort(function (a, b) {
                var ta = new Date(a.StartTime || a.start_time || a.PlannedDate || 0).getTime();
                var tb = new Date(b.StartTime || b.start_time || b.PlannedDate || 0).getTime();
                return ta - tb;
            });

            render(rows, asset);
        });
    }

    function init() {
        if (!window.BFLFP_Data) return;
        window.BFLFP_Data.assets()
            .then(function (assets) { populateAssets(assets); })
            .catch(function () { populateAssets([]); });

        if ($gen)   $gen.addEventListener('click', generate);
        if ($print) $print.addEventListener('click', function () { window.print(); });
        if ($asset) $asset.addEventListener('change', generate);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
