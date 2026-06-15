/* ============================================
   BFLFP — Monthly Consolidated PM Reports
   ============================================ */
(function () {
    'use strict';

    var $assetInput = document.getElementById('pmr-asset');
    var $assetList  = document.getElementById('pmr-asset-list');
    var $yearSel    = document.getElementById('pmr-year');
    var $monthSel   = document.getElementById('pmr-month');
    var $btnLoad    = document.getElementById('pmr-load');
    var $btnPrint   = document.getElementById('pmr-print');
    var $badge      = document.getElementById('pmr-badge');
    var $help       = document.getElementById('pmr-help');
    var $report     = document.getElementById('pmr-report');

    var FREQ_LABEL = { W:'Weekly', M:'Monthly', Q:'Quarterly', S:'Bi-Annual', A:'Annual' };
    var allAssets = [];
    var allCompletions = [];
    var allChecklists = null;

    function esc(s) {
        return (s == null ? '' : String(s))
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    // ---- URL params can come from either location.search OR after the hash:
    //      #pm-reports?asset=W01AC01&year=2026&month=5
    // ----
    function readUrlParams() {
        var queryStr = '';
        var hash = location.hash || '';
        var hashQ = hash.indexOf('?');
        if (hashQ >= 0) queryStr = hash.substring(hashQ + 1);
        else queryStr = (location.search || '').replace(/^\?/, '');
        var p = new URLSearchParams(queryStr);
        return {
            asset: p.get('asset') || '',
            year:  parseInt(p.get('year'), 10) || null,
            month: parseInt(p.get('month'), 10) || null
        };
    }

    // ---- Initial data load ----
    function loadAll() {
        if (!(window.BFLFP && BFLFP.data)) return Promise.reject(new Error('Data service unavailable'));
        return Promise.all([
            BFLFP.data.assets(),
            BFLFP.data.completions(),
            BFLFP.data.checklists()
        ]).then(function (arr) {
            allAssets      = (arr[0] && arr[0].assets) || [];
            allCompletions = (arr[1] && arr[1].completions) || (Array.isArray(arr[1]) ? arr[1] : []);
            allChecklists  = arr[2];
            populateAssetList();
            populateYearList();
            preselectFromUrl();
        });
    }

    function populateAssetList() {
        $assetList.innerHTML = allAssets.map(function (a) {
            var label = a.asset_id + ' — ' + (a.name || '');
            return '<option value="' + esc(a.asset_id) + '">' + esc(label) + '</option>';
        }).join('');
    }
    function populateYearList() {
        var now = new Date().getFullYear();
        var html = '';
        for (var y = now + 1; y >= now - 3; y--) {
            html += '<option value="' + y + '"' + (y === now ? ' selected' : '') + '>' + y + '</option>';
        }
        $yearSel.innerHTML = html;
        $monthSel.value = new Date().getMonth() + 1;
    }
    function preselectFromUrl() {
        var p = readUrlParams();
        if (p.asset) $assetInput.value = p.asset;
        if (p.year)  $yearSel.value    = p.year;
        if (p.month) $monthSel.value   = p.month;
        if (p.asset && p.year && p.month) {
            setTimeout(generateReport, 100);
        }
    }

    // ---- Find checklist sheet for an asset ----
    function getSheetForAsset(assetId) {
        if (!allChecklists) return null;
        var sheetName = (allChecklists.asset_to_sheets || {})[assetId];
        if (!sheetName || !sheetName.length) return null;
        var sn = Array.isArray(sheetName) ? sheetName[0] : sheetName;
        return (allChecklists.checklists || []).find(function (c) { return c.sheet_name === sn; });
    }

    // ---- Compute weeks in a month (Mon-Sun, partial weeks included) ----
    function weeksInMonth(year, month) {
        // month is 1-indexed
        var firstDay = new Date(year, month - 1, 1);
        var lastDay  = new Date(year, month, 0); // last day of month
        var weeks = [];
        // Find first Monday on or before firstDay
        var cur = new Date(firstDay);
        var day = cur.getDay(); // 0=Sun..6=Sat
        var offset = day === 0 ? -6 : 1 - day; // back to Monday
        cur.setDate(cur.getDate() + offset);
        var weekNo = 1;
        while (cur <= lastDay) {
            var weekStart = new Date(cur);
            var weekEnd   = new Date(cur); weekEnd.setDate(weekEnd.getDate() + 6);
            weeks.push({
                week_no: weekNo,
                start: weekStart,
                end:   weekEnd,
                // Date label: just the date this PM was meant for. Use Monday's date.
                date_label: weekStart.getDate() + '/' + (weekStart.getMonth() + 1)
            });
            cur.setDate(cur.getDate() + 7);
            weekNo++;
        }
        return weeks;
    }

    // ---- Pick PMCompletion(s) matching a week ----
    function completionsInRange(assetId, start, end, monthlyExpected) {
        // include start..end+1 day exclusive
        var endExclusive = new Date(end); endExclusive.setDate(endExclusive.getDate() + 1);
        return allCompletions.filter(function (c) {
            if (c.asset_id !== assetId) return false;
            var d = new Date(c.pm_date || c.submitted_at);
            if (isNaN(d)) return false;
            return d >= start && d < endExclusive;
        });
    }

    function fmtDate(d) {
        if (!d) return '—';
        var dd = new Date(d);
        if (isNaN(dd)) return String(d).slice(0, 10);
        return dd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function fmtDayMonth(d) {
        if (!d) return '';
        var dd = new Date(d);
        return dd.getDate() + '/' + (dd.getMonth() + 1);
    }

    // ---- Render the report ----
    function generateReport() {
        var assetId = ($assetInput.value || '').trim().toUpperCase();
        var year  = parseInt($yearSel.value, 10);
        var month = parseInt($monthSel.value, 10);
        if (!assetId || !year || !month) {
            alert('Please pick an asset, year, and month');
            return;
        }
        var asset = allAssets.find(function (a) { return a.asset_id === assetId; });
        if (!asset) {
            alert('Asset not found: ' + assetId);
            return;
        }
        var checklist = getSheetForAsset(assetId);
        if (!checklist) {
            alert('No checklist mapped to ' + assetId + '. Map one in the Checklist Editor first.');
            return;
        }

        // Always 5 week columns + 4 frequency columns (1M/3M/6M/1Y) — matches official form
        var weeks = weeksInMonth(year, month);
        // Pad to 5 weeks always
        while (weeks.length < 5) {
            weeks.push({ week_no: weeks.length + 1, start: null, end: null, date_label: '' });
        }
        weeks = weeks.slice(0, 5);

        // Match completions to each week
        var weekCols = weeks.map(function (w) {
            var matches = w.start ? completionsInRange(assetId, w.start, w.end) : [];
            return {
                key: 'W' + w.week_no,
                kind: 'week',
                week_no: w.week_no,
                date_label: matches[0] ? fmtDayMonth(matches[0].pm_date) : (w.date_label || ''),
                completion: matches[0] || null
            };
        });

        // Frequency columns 1M/3M/6M/1Y (always present, only some get filled)
        var monthStart = new Date(year, month - 1, 1);
        var monthEnd   = new Date(year, month, 0);
        var qStart     = new Date(year, Math.floor((month-1)/3)*3, 1);
        var qEnd       = new Date(year, Math.floor((month-1)/3)*3 + 3, 0);
        var hStart     = new Date(year, month <= 6 ? 0 : 6, 1);
        var hEnd       = new Date(year, month <= 6 ? 6 : 12, 0);
        var yStart     = new Date(year, 0, 1);
        var yEnd       = new Date(year, 12, 0);

        var monthlyMatch   = completionsInRange(assetId, monthStart, monthEnd).find(function (c) { return c.pm_type === 'Monthly'; });
        var quarterlyMatch = completionsInRange(assetId, qStart, qEnd).find(function (c) { return c.pm_type === 'Quarterly'; });
        var biannualMatch  = completionsInRange(assetId, hStart, hEnd).find(function (c) { return c.pm_type === 'Bi-Annual'; });
        var annualMatch    = completionsInRange(assetId, yStart, yEnd).find(function (c) { return c.pm_type === 'Annual'; });

        var freqCols = [
            { key: 'M', kind: 'freq', label: '1M', code: 'M', date_label: monthlyMatch   ? fmtDayMonth(monthlyMatch.pm_date)   : '', completion: monthlyMatch   || null },
            { key: 'Q', kind: 'freq', label: '3M', code: 'Q', date_label: quarterlyMatch ? fmtDayMonth(quarterlyMatch.pm_date) : '', completion: quarterlyMatch || null },
            { key: 'S', kind: 'freq', label: '6M', code: 'S', date_label: biannualMatch  ? fmtDayMonth(biannualMatch.pm_date)  : '', completion: biannualMatch  || null },
            { key: 'A', kind: 'freq', label: '1Y', code: 'A', date_label: annualMatch    ? fmtDayMonth(annualMatch.pm_date)    : '', completion: annualMatch    || null }
        ];

        // ALL data columns (5 weeks + 4 freq). Signatures align under each.
        var columns = weekCols.concat(freqCols);

        // Completion summary — only count columns that should have data for this asset's primary frequency
        var freqCode = checklist.primary_frequency || asset.pm_frequency || 'Monthly';
        var expectedCols;
        if (freqCode === 'Weekly')         expectedCols = weekCols.filter(function (c) { return c.date_label !== ''; });
        else if (freqCode === 'Monthly')   expectedCols = [freqCols[0]];
        else if (freqCode === 'Quarterly') expectedCols = [freqCols[1]];
        else if (freqCode === 'Bi-Annual') expectedCols = [freqCols[2]];
        else if (freqCode === 'Annual')    expectedCols = [freqCols[3]];
        else expectedCols = columns;
        var doneCount = expectedCols.filter(function (c) { return c.completion; }).length;
        var totalCols = expectedCols.length || 1;
        var status = doneCount === 0 ? 'no-data'
                   : doneCount < totalCols ? 'partial'
                   : 'complete';

        // Update badge
        $badge.hidden = false;
        if (status === 'complete') {
            $badge.className = 'pmr-badge pmr-badge-complete';
            $badge.textContent = '✓ Complete — ' + doneCount + '/' + totalCols + ' done';
        } else if (status === 'partial') {
            $badge.className = 'pmr-badge pmr-badge-partial';
            $badge.textContent = '⏳ Partial — ' + doneCount + '/' + totalCols + ' done';
        } else {
            $badge.className = 'pmr-badge pmr-badge-none';
            $badge.textContent = 'ℹ No submissions yet';
        }

        $help.hidden = true;
        $report.hidden = false;
        $btnPrint.disabled = false;
        renderReportHTML(asset, checklist, columns, year, month);
    }

    function monthName(m) {
        return ['','January','February','March','April','May','June','July','August','September','October','November','December'][m] || '';
    }

    function renderReportHTML(asset, checklist, columns, year, month) {
        var tasks = checklist.tasks || [];
        // Derive week-only columns for the second header row (under the "Week" group)
        var weekCols = columns.filter(function (c) { return c.kind === 'week'; });
        // Build simplified header (logo • centered title • form code right)
        var html = '<div class="pmr-doc">';
        html += '  <header class="pmr-doc-header">';
        // Use the R1 logo (same as Print Checklist page). Fall back to the asset folder logo.
        var logoSrc = (allChecklists && allChecklists.logo_url) ? ('./' + allChecklists.logo_url) : './img/bluefalo-r1.png';
        html += '    <img class="pmr-logo" src="' + esc(logoSrc) + '" alt="BFLFP" onerror="this.onerror=null;this.src=\'./assets/Bluefalo.png\'">';
        html += '    <div class="pmr-doc-titles">';
        html += '      <h2>บริษัท บลูฟาโล่ ฟู้ด โปรดักส์ จำกัด</h2>';
        html += '      <p>บันทึก การตรวจเช็คเครื่องจักร อุปกรณ์</p>';
        html += '    </div>';
        html += '    <div class="pmr-doc-meta">' + esc(checklist.doc_code || 'F-SP-ENG02-01 Rev.01') + '</div>';
        html += '  </header>';

        // Asset info strip — single thin line: PM | year | machine | month
        var buddhistYear = year + 543;
        html += '  <div class="pmr-doc-asset-strip">';
        html += '    <div class="pmr-strip-pm">PM</div>';
        html += '    <div>บันทึกการตรวจเช็คเครื่องจักรประจำปี: <strong>' + buddhistYear + '</strong></div>';
        html += '    <div>ชื่อเครื่องจักร: <strong>' + esc(asset.name || checklist.sheet_name) + '</strong> · รหัส: <strong>' + esc(asset.asset_id) + '</strong></div>';
        html += '    <div>ประจำเดือน / ปี: <strong>' + monthName(month) + ' ' + year + '</strong></div>';
        html += '  </div>';

        // Task table — fixed columns matching the official form:
        // # | Photo | Desc | Std | Week 1-5 (sub-headers) | 1M | 3M | 6M | 1Y | Method
        html += '  <table class="pmr-task-table">';
        html += '    <thead>';
        html += '      <tr>';
        html += '        <th class="col-num" rowspan="2">ลำดับ<br><small>#</small></th>';
        html += '        <th class="col-img" rowspan="2">รูปภาพ Part</th>';
        html += '        <th class="col-desc" rowspan="2">รายการตรวจเช็ค</th>';
        html += '        <th class="col-std" rowspan="2">สถานะปกติ</th>';
        html += '        <th class="col-weekgroup" colspan="5">Week<br><small>ประจำสัปดาห์</small></th>';
        html += '        <th class="col-freqgroup" rowspan="2">1M</th>';
        html += '        <th class="col-freqgroup" rowspan="2">3M</th>';
        html += '        <th class="col-freqgroup" rowspan="2">6M</th>';
        html += '        <th class="col-freqgroup" rowspan="2">1Y</th>';
        html += '        <th class="col-method" rowspan="2">วิธีการ<br><small>Method</small></th>';
        html += '      </tr>';
        html += '      <tr>';
        weekCols.forEach(function (col) {
            var lbl = col.week_no + (col.date_label ? ' ' + col.date_label : '');
            html += '        <th class="col-week">' + esc(lbl) + '</th>';
        });
        html += '      </tr>';
        html += '    </thead>';
        html += '    <tbody>';

        // ---- TASK ROWS ----
        // Map sheet primary frequency to single-letter code for fallback colour
        var FREQ_TO_CODE = { Weekly:'W', Monthly:'M', Quarterly:'Q', 'Bi-Annual':'S', Annual:'A', Daily:'D' };
        var sheetFreqCode = FREQ_TO_CODE[checklist.primary_frequency] || '';
        tasks.forEach(function (t, idx) {
            var taskFreqs = t.frequencies || [];
            var effFreq = taskFreqs[0] || sheetFreqCode;
            var fcCls = effFreq ? (' fc-' + effFreq) : ' fc-none';
            html += '<tr>';
            html += '  <td class="col-num' + fcCls + '">' + (t.task_no || (idx + 1)) + '</td>';
            html += '  <td class="col-img">' + (t.image_url ? '<img src="' + esc(t.image_url) + '" alt="">' : '—') + '</td>';
            html += '  <td class="col-desc">' + esc(t.description || '') + '</td>';
            html += '  <td class="col-std">' + esc(t.standard || '') + '</td>';
            // Tick cells: tick if task frequency matches column AND there's a completion for that column
            columns.forEach(function (col) {
                var cell = '';
                var taskFreqs = t.frequencies || [];
                var colMatches = false;
                if (col.kind === 'week' && taskFreqs.indexOf('W') >= 0) colMatches = true;
                else if (col.kind === 'freq' && taskFreqs.indexOf(col.code) >= 0) colMatches = true;
                // Show tick only if column has a completion AND task frequency matches column
                if (colMatches && col.completion) {
                    var tt = (col.completion.tasks || []).find(function (x) { return Number(x.task_no) === Number(t.task_no || (idx + 1)); });
                    if (tt) {
                        if (tt.result === 'R')      cell = '<span class="pmr-tick pmr-ok">✓</span>';
                        else if (tt.result === 'S') cell = '<span class="pmr-tick pmr-ng">✗</span>';
                        else if (tt.result === 'N/A') cell = '<span class="pmr-tick pmr-na">–</span>';
                    } else {
                        cell = '<span class="pmr-tick pmr-ok">✓</span>';
                    }
                }
                html += '  <td class="col-week-cell">' + cell + '</td>';
            });
            html += '  <td class="col-method">' + esc(t.method || '') + '</td>';
            html += '</tr>';
        });

        // ---- PM DATE ROW ----
        html += '<tr class="pmr-meta-row pmr-date-row">';
        html += '  <td colspan="4" class="pmr-meta-label">วันที่ทำ PM<br><small>PM Date</small></td>';
        columns.forEach(function (col) {
            var d = col.completion ? fmtDate(col.completion.pm_date) : '';
            html += '<td class="col-week-cell pmr-date-cell">' + d + '</td>';
        });
        html += '  <td class="col-method"></td>';
        html += '</tr>';

        // ---- SIGNATURE ROWS ----
        // Workflow: Tech signs during Fill Mode → Sup signs during Approval → Mgr signs HERE on the report.
        // So on this page, Tech + Sup cells are READ-ONLY (display whatever was captured upstream)
        // and only Manager cells are clickable.
        var sigRoles = [
            { key: 'technician', label_en: 'Technician', label_th: 'ผู้บันทึก',  stage: 'Fill Mode',     editable: false },
            { key: 'supervisor', label_en: 'Supervisor', label_th: 'ผู้ตรวจสอบ', stage: 'Approval Queue', editable: false },
            { key: 'manager',    label_en: 'Manager',    label_th: 'ผู้ทวนสอบ',  stage: 'Monthly Signoff', editable: true  }
        ];
        sigRoles.forEach(function (role) {
            var rowClass = 'pmr-meta-row pmr-sig-row' + (role.editable ? ' pmr-sig-row-editable' : ' pmr-sig-row-readonly');
            html += '<tr class="' + rowClass + '">';
            html += '  <td colspan="4" class="pmr-meta-label pmr-sig-label-cell">' +
                      '<div class="pmr-sig-role-en">' + role.label_en +
                        (role.editable
                            ? ' <span class="pmr-sig-stage-tag pmr-sig-stage-tag-active">SIGN HERE</span>'
                            : ' <span class="pmr-sig-stage-tag">' + esc(role.stage) + '</span>') +
                      '</div>' +
                      '<div class="pmr-sig-role-th">' + role.label_th + '</div>' +
                    '</td>';
            columns.forEach(function (col, i) {
                // Look up an existing upstream signature for Tech/Sup from completion data if present
                var upstreamSig = null;
                if (!role.editable && col.completion && col.completion.signatures) {
                    upstreamSig = col.completion.signatures[role.key] || null;
                }
                if (role.editable) {
                    // Manager: clickable, draws the modal
                    html += '<td class="col-week-cell pmr-sig-cell-inline" data-col-key="' + col.key + '" data-role="' + role.key + '">' +
                              '<div class="pmr-sig-thumb pmr-sig-thumb-editable" data-role="' + role.key + '" data-col-key="' + col.key + '" title="Click to sign as Manager">' +
                                '<span class="pmr-sig-placeholder">✎</span>' +
                              '</div>' +
                            '</td>';
                } else if (upstreamSig) {
                    // Tech/Sup: already signed upstream — show the saved image, no click
                    html += '<td class="col-week-cell pmr-sig-cell-inline" data-col-key="' + col.key + '" data-role="' + role.key + '">' +
                              '<div class="pmr-sig-thumb pmr-sig-thumb-readonly pmr-sig-thumb-filled" data-role="' + role.key + '" data-col-key="' + col.key + '" title="Captured upstream in ' + esc(role.stage) + '">' +
                                '<img class="pmr-sig-saved" src="' + esc(upstreamSig) + '" alt="signed">' +
                              '</div>' +
                            '</td>';
                } else {
                    // Tech/Sup: no upstream signature yet — show pending pill, no click
                    html += '<td class="col-week-cell pmr-sig-cell-inline" data-col-key="' + col.key + '" data-role="' + role.key + '">' +
                              '<div class="pmr-sig-thumb pmr-sig-thumb-readonly pmr-sig-thumb-pending" data-role="' + role.key + '" data-col-key="' + col.key + '" title="Not yet signed in ' + esc(role.stage) + '">' +
                                '<span class="pmr-sig-pending-label">' + (col.completion ? '—' : '·') + '</span>' +
                              '</div>' +
                            '</td>';
                }
            });
            html += '  <td class="col-method"></td>';
            html += '</tr>';
        });

        html += '    </tbody>';
        html += '  </table>';

        // Legend — two columns: symbols on left, frequency colors on right (matches BFLFP form)
        html += '  <div class="pmr-legend-block">';
        html += '    <div class="pmr-legend-symbols">';
        html += '      <div class="pmr-legend-title">สัญลักษณ์การบันทึก / Recording symbols</div>';
        html += '      <div class="pmr-legend-row"><span class="pmr-tick pmr-ok">✓</span> ปกติ (Normal)</div>';
        html += '      <div class="pmr-legend-row"><span class="pmr-tick pmr-ng">✗</span> ไม่ปกติ (Abnormal)</div>';
        html += '      <div class="pmr-legend-row"><span class="pmr-tick pmr-na">–</span> ไม่เกี่ยวข้อง (N/A)</div>';
        html += '    </div>';
        html += '    <div class="pmr-legend-colors">';
        html += '      <div class="pmr-legend-title">ความถี่ในการบำรุงรักษา / PM Frequency</div>';
        html += '      <div class="pmr-legend-color-grid">';
        html += '        <span class="pmr-legend-chip cl-W"></span><span class="pmr-legend-name">ประจำสัปดาห์ (Weekly)</span>';
        html += '        <span class="pmr-legend-chip cl-M"></span><span class="pmr-legend-name">ประจำ 1 เดือน (Monthly)</span>';
        html += '        <span class="pmr-legend-chip cl-Q"></span><span class="pmr-legend-name">ประจำ 3 เดือน (Quarterly)</span>';
        html += '        <span class="pmr-legend-chip cl-S"></span><span class="pmr-legend-name">ประจำ 6 เดือน (Bi-Annual)</span>';
        html += '        <span class="pmr-legend-chip cl-A"></span><span class="pmr-legend-name">ประจำ 1 ปี (Annual)</span>';
        html += '        <span class="pmr-legend-chip cl-D"></span><span class="pmr-legend-name">ทุกครั้งที่ปฏิบัติงาน (Every operation)</span>';
        html += '      </div>';
        html += '    </div>';
        html += '  </div>';

        // Per-week notes (only if any)
        var hasNotes = columns.some(function (c) { return c.completion && c.completion.notes; });
        if (hasNotes) {
            html += '  <div class="pmr-notes-block">';
            html += '    <h4>หมายเหตุประจำสัปดาห์ / Weekly Notes</h4>';
            html += '    <ul>';
            columns.forEach(function (col, i) {
                if (col.completion && col.completion.notes) {
                    var lbl = col.week_no ? ('สัปดาห์ที่ ' + col.week_no) : 'PM Cycle';
                    html += '<li><strong>' + lbl + ' (' + fmtDate(col.completion.pm_date) + '):</strong> ' + esc(col.completion.notes) + '</li>';
                }
            });
            html += '    </ul>';
            html += '  </div>';
        }

        // Footer
        html += '  <div class="pmr-footer">';
        html += '    BFLFP — Bluefalo Food Products · ' + esc(asset.asset_id) + ' · ' + monthName(month) + ' ' + year +
                ' · Form ' + esc(checklist.doc_code || 'F-SP-ENG02-01 Rev.01');
        html += '  </div>';

        html += '</div>';
        $report.innerHTML = html;

        // Wire click-to-sign ONLY on editable (Manager) thumbs.
        // Tech/Sup are read-only on this page — those signatures are captured upstream in
        // Fill Mode (Tech) and the Approval Queue (Sup).
        $report.querySelectorAll('.pmr-sig-thumb-editable').forEach(function (thumb) {
            thumb.addEventListener('click', function () {
                openSignModal(thumb.getAttribute('data-role'), thumb.getAttribute('data-col-key'), thumb);
            });
        });
    }

    // ---- Signature MODAL — large drawing area, save -> thumbnail in cell ----
    function ensureSignModal() {
        if (document.getElementById('pmr-sign-modal')) return;
        var m = document.createElement('div');
        m.id = 'pmr-sign-modal';
        m.className = 'pmr-sign-modal-overlay no-print';
        m.hidden = true;
        m.innerHTML =
            '<div class="pmr-sign-modal-panel">' +
              '<header class="pmr-sign-modal-header">' +
                '<h3 id="pmr-sign-modal-title">Draw signature</h3>' +
                '<button type="button" class="pmr-sign-modal-close" id="pmr-sign-close">×</button>' +
              '</header>' +
              '<div class="pmr-sign-modal-body">' +
                '<canvas id="pmr-sign-big-canvas" width="600" height="200"></canvas>' +
                '<p class="pmr-sign-modal-hint">Use mouse or touch to draw. Click <strong>Save Signature</strong> when done.</p>' +
              '</div>' +
              '<footer class="pmr-sign-modal-footer">' +
                '<button type="button" class="pmr-btn pmr-btn-secondary" id="pmr-sign-clear-big">Clear</button>' +
                '<div style="flex:1"></div>' +
                '<button type="button" class="pmr-btn pmr-btn-secondary" id="pmr-sign-cancel">Cancel</button>' +
                '<button type="button" class="pmr-btn pmr-btn-primary"   id="pmr-sign-save">💾 Save Signature</button>' +
              '</footer>' +
            '</div>';
        document.body.appendChild(m);

        var bigCanvas = document.getElementById('pmr-sign-big-canvas');
        attachSignaturePad(bigCanvas);
        document.getElementById('pmr-sign-clear-big').addEventListener('click', function () {
            clearCanvas(bigCanvas);
        });
        document.getElementById('pmr-sign-close').addEventListener('click', closeSignModal);
        document.getElementById('pmr-sign-cancel').addEventListener('click', closeSignModal);
        m.addEventListener('click', function (e) { if (e.target === m) closeSignModal(); });
        document.getElementById('pmr-sign-save').addEventListener('click', saveSignModal);
    }
    var _currentSignThumb = null;
    function openSignModal(role, colKey, thumbEl) {
        ensureSignModal();
        _currentSignThumb = thumbEl;
        var roleLbl = role === 'technician' ? 'Technician' : role === 'supervisor' ? 'Supervisor' : 'Manager';
        document.getElementById('pmr-sign-modal-title').textContent =
            'Sign as ' + roleLbl + ' — column ' + colKey;
        var bigCanvas = document.getElementById('pmr-sign-big-canvas');
        clearCanvas(bigCanvas);
        // If thumb already has a saved signature, draw it onto the big canvas as starting point
        var existingImg = thumbEl.querySelector('img.pmr-sig-saved');
        if (existingImg && existingImg.src) {
            var img = new Image();
            img.onload = function () {
                bigCanvas.getContext('2d').drawImage(img, 0, 0, bigCanvas.width, bigCanvas.height);
            };
            img.src = existingImg.src;
        }
        document.getElementById('pmr-sign-modal').hidden = false;
    }
    function closeSignModal() {
        var m = document.getElementById('pmr-sign-modal');
        if (m) m.hidden = true;
        _currentSignThumb = null;
    }
    function saveSignModal() {
        if (!_currentSignThumb) { closeSignModal(); return; }
        var bigCanvas = document.getElementById('pmr-sign-big-canvas');
        var ctx = bigCanvas.getContext('2d');
        var w = bigCanvas.width, h = bigCanvas.height;
        var pixels = ctx.getImageData(0, 0, w, h).data;
        // Find bounding box of non-white pixels — so we can crop to just the signature.
        var minX = w, minY = h, maxX = -1, maxY = -1;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var idx = (y * w + x) * 4;
                if (pixels[idx] < 230 || pixels[idx+1] < 230 || pixels[idx+2] < 230) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < 0) {
            alert('Please draw a signature first / กรุณาวาดลายเซ็นต์');
            return;
        }
        // Pad bounding box so signature doesn't touch the edge
        var pad = 12;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(w - 1, maxX + pad);
        maxY = Math.min(h - 1, maxY + pad);
        var cropW = maxX - minX + 1;
        var cropH = maxY - minY + 1;
        // Render cropped region onto a fresh canvas
        var crop = document.createElement('canvas');
        crop.width = cropW;
        crop.height = cropH;
        var cctx = crop.getContext('2d');
        cctx.fillStyle = '#FFFFFF';
        cctx.fillRect(0, 0, cropW, cropH);
        cctx.drawImage(bigCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
        var dataUrl = crop.toDataURL('image/png');
        _currentSignThumb.innerHTML = '<img class="pmr-sig-saved" src="' + dataUrl + '" alt="signed">';
        _currentSignThumb.classList.add('pmr-sig-thumb-filled');
        closeSignModal();
    }

    // ---- Tiny signature pad ----
    function attachSignaturePad(canvas) {
        var ctx = canvas.getContext('2d');
        // Fill white background so the saved PNG has visible (non-transparent) content
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Thicker stroke so signatures stay visible when scaled down into small cells
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';
        var drawing = false;
        var lastX, lastY;
        function pos(e) {
            var r = canvas.getBoundingClientRect();
            var cx, cy;
            if (e.touches && e.touches.length) {
                cx = e.touches[0].clientX; cy = e.touches[0].clientY;
            } else {
                cx = e.clientX; cy = e.clientY;
            }
            return { x: (cx - r.left) * (canvas.width / r.width),
                     y: (cy - r.top)  * (canvas.height / r.height) };
        }
        function start(e) {
            e.preventDefault();
            drawing = true;
            var p = pos(e); lastX = p.x; lastY = p.y;
        }
        function move(e) {
            if (!drawing) return;
            e.preventDefault();
            var p = pos(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            lastX = p.x; lastY = p.y;
        }
        function end(e) { drawing = false; }
        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup',   end);
        canvas.addEventListener('touchstart', start, { passive: false });
        canvas.addEventListener('touchmove',  move,  { passive: false });
        canvas.addEventListener('touchend',   end);
    }
    function clearCanvas(canvas) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Reset to white background so the next save is visible
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0F172A';
    }

    // ---- Init ----
    if ($btnLoad) $btnLoad.addEventListener('click', generateReport);
    if ($btnPrint) $btnPrint.addEventListener('click', function () {
        // Lock signatures into their painted state and print
        window.print();
    });

    loadAll().catch(function (err) {
        $help.innerHTML = '<p style="color:#DC2626">❌ Could not load data: ' + esc(err.message || err) + '</p>';
        console.error('[PMReports] load failed:', err);
    });
})();
