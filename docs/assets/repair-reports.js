/* ============================================
   BFLFP — Repair Request Form (F-SP-ENG02-03)
   Reads a single MaintenanceLog row and renders the 3-section A4 form.
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
        if (!iso) return '............ / ............ / ............';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    }

    var $job          = $('rr-job');
    var $assetFilter  = $('rr-asset-filter');
    var $gen          = $('rr-generate');
    var $print        = $('rr-print');
    var $report       = $('rr-report-container');

    var ALL_JOBS = [];
    var ASSETS_BY_ID = {};

    function isRepairJob(r) {
        var jt = r.JobType || '';
        return jt === 'Corrective' || jt === 'Repair' || jt === 'Breakdown' || jt === 'Improvement';
    }

    function jobLabel(r) {
        var d = r.StartTime || r.start_time || r.PlannedDate;
        var dateStr = d ? new Date(d).toISOString().slice(0,10) : 'unknown date';
        var aid = r.MachineID || r.Machine || r.AssetID || r.Title || '?';
        var jt  = r.JobType || '?';
        return '[' + dateStr + ']  ' + aid + '  ·  ' + jt + (r.Problem ? '  ·  ' + (r.Problem.substring(0, 40)) + (r.Problem.length > 40 ? '…' : '') : '');
    }

    function refreshJobOptions() {
        if (!$job) return;
        var fAsset = $assetFilter.value;
        var rows = ALL_JOBS.filter(isRepairJob);
        if (fAsset) rows = rows.filter(function (r) {
            var aid = r.MachineID || r.Machine || r.AssetID || r.Title || '';
            return aid === fAsset || aid.indexOf(fAsset) !== -1;
        });
        rows.sort(function (a, b) {
            var ta = new Date(a.StartTime || a.start_time || a.PlannedDate || 0).getTime();
            var tb = new Date(b.StartTime || b.start_time || b.PlannedDate || 0).getTime();
            return tb - ta; // newest first
        });
        var html = '<option value="">Pick a corrective/repair job…</option>';
        rows.forEach(function (r) {
            html += '<option value="' + esc(r.ID || r.JobID || '') + '">' + esc(jobLabel(r)) + '</option>';
        });
        $job.innerHTML = html;
    }

    function populateAssetFilter(assets) {
        var html = '<option value="">All assets</option>';
        (assets || [])
            .filter(function (a) { return a && a.asset_id; })
            .sort(function (a, b) { return a.asset_id.localeCompare(b.asset_id); })
            .forEach(function (a) {
                ASSETS_BY_ID[a.asset_id] = a;
                html += '<option value="' + esc(a.asset_id) + '">' + esc(a.asset_id) + ' · ' + esc(a.name || '') + '</option>';
            });
        $assetFilter.innerHTML = html;
    }

    function renderJob(r) {
        var aid = r.MachineID || r.Machine || r.AssetID || r.Title || '';
        var asset = ASSETS_BY_ID[aid] || {};

        var html = '';
        html += '<div class="rep-doc" style="font-size: 12px;">';
        html += '  <div class="rep-doc-header">';
        html += '    <img src="./assets/Bluefalo.png" alt="BFL" class="rep-doc-logo">';
        html += '    <div class="rep-doc-titles">';
        html += '      <h2>บริษัท บลูฟาโลฟู้ด โปรดักส์ จำกัด · Blue Buffalo Food Products Co., Ltd.</h2>';
        html += '      <p style="font-size: 14px; font-weight: 700; color: #0F172A; margin-top: 4px;">ใบแจ้งซ่อม / Repair Request Form</p>';
        html += '    </div>';
        html += '    <div class="rep-doc-meta">F-SP-ENG02-03 Rev.01<br>เลขที่ ' + esc(r.JobID || r.Title || ('ID ' + (r.ID || ''))) + '</div>';
        html += '  </div>';

        // ===== Section 1 - REQUEST =====
        html += '<div style="margin-top: 8px;">';
        html += '  <div style="background: #1E293B; color: #FFFFFF; padding: 5px 10px; font-weight: 700; font-size: 12px;">ส่วนที่ 1  การขอทำเรื่องแจ้งซ่อมบำรุง / Section 1 — Request</div>';
        html += '  <table class="rep-doc-table" style="border-top:none;">';
        html += '    <tr>';
        html += '      <td style="width: 22%; background:#F8FAFC; font-weight:600;">ผู้แจ้งซ่อม / Requester</td><td>' + esc(r.CreatedBy || r.AssignedBy || r.ActionBy || '') + '</td>';
        html += '      <td style="width: 12%; background:#F8FAFC; font-weight:600;">ตำแหน่ง</td><td>' + esc(r.RequesterPosition || '') + '</td>';
        html += '      <td style="width: 12%; background:#F8FAFC; font-weight:600;">หน่วยงาน</td><td>' + esc(r.RequesterDepartment || '') + '</td>';
        html += '    </tr>';
        html += '    <tr>';
        html += '      <td style="background:#F8FAFC; font-weight:600;">รหัสเครื่องจักร / Machine ID</td><td><strong>' + esc(aid) + '</strong></td>';
        html += '      <td colspan="3">' + esc(asset.name || '') +
                       (asset.class_name ? ' &nbsp;·&nbsp; ' + esc(asset.class_name) : '') +
                       (asset.location   ? ' &nbsp;·&nbsp; ' + esc(asset.location)   : '') + '</td>';
        html += '    </tr>';
        html += '    <tr>';
        html += '      <td style="background:#F8FAFC; font-weight:600;">รายละเอียด/อาการ<br><small>Problem / Symptom</small></td>';
        html += '      <td colspan="5" style="min-height: 60px;">' + esc(r.Problem || '') + '</td>';
        html += '    </tr>';
        html += '  </table>';
        // Section 1 signatures
        html += '  <div class="rep-doc-sig-block" style="grid-template-columns: 1fr 1fr; margin-top:6px;">';
        html += '    <div class="rep-doc-sig">';
        if (r.penRequester) html += '<img class="rep-doc-sig-saved" src="' + esc(r.penRequester) + '">';
        else html += '<div class="rep-doc-sig-line"></div>';
        html += '      <div class="rep-doc-sig-label">ผู้แจ้ง / Requester</div>';
        html += '      <div class="rep-doc-sig-sub">' + esc(fmtDateLong(r.StartTime)) + '</div>';
        html += '    </div>';
        html += '    <div class="rep-doc-sig">';
        html += '      <div class="rep-doc-sig-line"></div>';
        html += '      <div class="rep-doc-sig-label">ผู้รับแจ้ง / Receiver</div>';
        html += '      <div class="rep-doc-sig-sub">............ / ............ / ............</div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';

        // ===== Section 2 - REPAIR =====
        html += '<div style="margin-top: 12px;">';
        html += '  <div style="background: #1E293B; color: #FFFFFF; padding: 5px 10px; font-weight: 700; font-size: 12px;">ส่วนที่ 2  การซ่อมบำรุง / Section 2 — Repair Work</div>';
        html += '  <table class="rep-doc-table" style="border-top:none;">';
        html += '    <tr>';
        html += '      <td style="width: 22%; background:#F8FAFC; font-weight:600;">การวิเคราะห์สาเหตุ<br><small>Root Cause</small></td>';
        html += '      <td colspan="5" style="min-height: 50px;">' + esc(r.RootCause || '') + '</td>';
        html += '    </tr>';
        html += '    <tr>';
        html += '      <td style="background:#F8FAFC; font-weight:600;">การแก้ไข<br><small>Solution / Work Done</small></td>';
        html += '      <td colspan="5" style="min-height: 60px;">' + esc(r.Solution || '') + '</td>';
        html += '    </tr>';
        html += '    <tr>';
        html += '      <td style="background:#F8FAFC; font-weight:600;">การอนุมัติ / Approval</td>';
        html += '      <td>' + (r.ApprovalStatus === true || r.ApprovalStatus === 'Yes' ? '✓ อนุมัติ / Approved' : '— ยังไม่อนุมัติ') + '</td>';
        html += '      <td style="background:#F8FAFC; font-weight:600;">วันที่ทำการซ่อม</td>';
        html += '      <td>' + esc(fmtDateLong(r.StartTime)) + '</td>';
        html += '      <td style="background:#F8FAFC; font-weight:600;">วันที่เสร็จ</td>';
        html += '      <td>' + esc(fmtDateLong(r.EndTime)) + '</td>';
        html += '    </tr>';
        html += '    <tr>';
        html += '      <td style="background:#F8FAFC; font-weight:600;">ช่างผู้รับผิดชอบ<br><small>Technicians</small></td>';
        html += '      <td colspan="3">' + esc(r.ActionBy || r.AssignedTo || '') + '</td>';
        html += '      <td style="background:#F8FAFC; font-weight:600;">Supplier / ผู้รับเหมา</td>';
        html += '      <td>' + esc(r.SupplierName || '—') + '</td>';
        html += '    </tr>';
        html += '  </table>';
        // Section 2 signature
        html += '  <div class="rep-doc-sig-block" style="grid-template-columns: 1fr 1fr 1fr; margin-top:6px;">';
        html += '    <div class="rep-doc-sig">';
        if (r.penApprover) html += '<img class="rep-doc-sig-saved" src="' + esc(r.penApprover) + '">';
        else html += '<div class="rep-doc-sig-line"></div>';
        html += '      <div class="rep-doc-sig-label">ผู้อนุมัติ / Approver</div>';
        html += '      <div class="rep-doc-sig-sub">............ / ............ / ............</div>';
        html += '    </div>';
        if (r.BeforeImage) {
            html += '    <div style="text-align:center;">';
            html += '      <img src="' + esc(r.BeforeImage) + '" style="max-height:80px; max-width:100%; border:1px solid #1E293B;">';
            html += '      <div class="rep-doc-sig-label" style="margin-top:4px;">รูปก่อนซ่อม / Before</div>';
            html += '    </div>';
        } else html += '<div></div>';
        if (r.AfterImage) {
            html += '    <div style="text-align:center;">';
            html += '      <img src="' + esc(r.AfterImage) + '" style="max-height:80px; max-width:100%; border:1px solid #1E293B;">';
            html += '      <div class="rep-doc-sig-label" style="margin-top:4px;">รูปหลังซ่อม / After</div>';
            html += '    </div>';
        } else html += '<div></div>';
        html += '  </div>';
        html += '</div>';

        // ===== Section 3 - VERIFICATION =====
        html += '<div style="margin-top: 12px;">';
        html += '  <div style="background: #1E293B; color: #FFFFFF; padding: 5px 10px; font-weight: 700; font-size: 12px;">ส่วนที่ 3  การตรวจสอบการซ่อมแซม / Section 3 — Verification</div>';
        html += '  <table class="rep-doc-table" style="border-top:none;">';
        html += '    <tr>';
        html += '      <td style="width: 22%; background:#F8FAFC; font-weight:600;">บันทึกแก้ไข<br><small>Inspection Notes</small></td>';
        html += '      <td colspan="5">' + esc(r.InspectionRemark || '') + '</td>';
        html += '    </tr>';
        html += '    <tr>';
        html += '      <td style="background:#F8FAFC; font-weight:600;">การตรวจสอบ<br><small>Result</small></td>';
        var passed = (r.VerificationResult === true || r.VerificationResult === 'Yes' || r.VerificationResult === 1);
        html += '      <td colspan="5">' +
                  (passed
                      ? '<strong>✓ ใช้งานได้ตามปกติ สะอาดปลอดภัย / OK — operational, clean, safe</strong>'
                      : '✗ ไม่เรียบร้อย เพราะ: ____________________ / Not OK because:') +
                '</td>';
        html += '    </tr>';
        html += '  </table>';
        // Section 3 signature (inspector)
        html += '  <div class="rep-doc-sig-block" style="grid-template-columns: 1fr; margin-top:6px;">';
        html += '    <div class="rep-doc-sig">';
        if (r.penInspector) html += '<img class="rep-doc-sig-saved" src="' + esc(r.penInspector) + '">';
        else html += '<div class="rep-doc-sig-line"></div>';
        html += '      <div class="rep-doc-sig-label">ผู้ตรวจรับงาน / Inspector</div>';
        html += '      <div class="rep-doc-sig-sub">' + esc(fmtDateLong(r.EndTime || r.Modified)) + '</div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';

        html += '  <div class="rep-doc-footer">';
        html += '    BFLFP — Bluefalo Food Products · Job ' + esc(r.JobID || r.ID || '') + ' · Form F-SP-ENG02-03 Rev.01';
        html += '  </div>';
        html += '</div>';

        $report.innerHTML = html;
    }

    function generate() {
        var id = $job.value;
        if (!id) {
            $report.innerHTML = '<div class="rep-loading"><p>Pick a job and click Generate.</p></div>';
            return;
        }
        var r = ALL_JOBS.find(function (x) { return String(x.ID || x.JobID || '') === String(id); });
        if (!r) {
            $report.innerHTML = '<div class="rep-loading"><p>Job not found.</p></div>';
            return;
        }
        renderJob(r);
    }

    function init() {
        if (!window.BFLFP_Data) return;
        Promise.all([
            window.BFLFP_Data.maintenanceLog ? window.BFLFP_Data.maintenanceLog().catch(function () { return []; }) : Promise.resolve([]),
            window.BFLFP_Data.assets ? window.BFLFP_Data.assets().catch(function () { return []; }) : Promise.resolve([])
        ]).then(function (results) {
            ALL_JOBS = Array.isArray(results[0]) ? results[0] : (results[0] && results[0].items) || [];
            var assetsRaw = results[1];
            var assets = Array.isArray(assetsRaw) ? assetsRaw : (assetsRaw && assetsRaw.assets) || [];
            populateAssetFilter(assets);
            refreshJobOptions();
        });

        if ($gen)         $gen.addEventListener('click', generate);
        if ($print)       $print.addEventListener('click', function () { window.print(); });
        if ($assetFilter) $assetFilter.addEventListener('change', refreshJobOptions);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
