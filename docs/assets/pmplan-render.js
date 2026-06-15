/* ============================================================
   BFLFP — PM Plan renderer (SD-SP-ENG02-02)
   Builds the "แผนการบำรุงรักษาเครื่องจักร/อุปกรณ์" document HTML.
   Used by both the PM Schedule SPA page and print/pmplan.html.
   Layout mirrors PMchecklist.xlsx + office-scripts/fillPMPlan.ts:
     left columns  = MACHINE ROSTER (No / code / name)
     right columns = TASK LIST (check item / 5 frequency ticks / method)
   The two run as parallel lists, woven row by row.
   ============================================================ */
window.BFLFP_PMPlan = (function () {
    'use strict';

    var DOC = {
        company: 'บริษัท บลูฟาโล่ ฟู้ด โปรดักส์ จำกัด',
        code:    'รหัสเอกสาร  SD-SP-ENG02-02',
        sup:     'SUPPORTING DOCUMENT (เอกสารสนับสนุน)',
        subject: 'เรื่อง  แผนการบำรุงรักษาเครื่องจักร / อุปกรณ์',
        rev:     'แก้ไขครั้งที่  01',
        eff:     'ประกาศใช้เมื่อ  14 มิถุนายน 2564',
        group:   'กลุ่มเครื่องจักร : '
    };
    var FREQS = ['W', 'M', 'Q', 'S', 'A'];

    function esc(s) {
        return (s == null ? '' : String(s))
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Build {asset_id: asset} index from the assets array.
    function indexAssets(assets) {
        var by = {};
        (assets || []).forEach(function (a) { if (a && a.asset_id) by[a.asset_id] = a; });
        return by;
    }

    function groupName(sheet, assetsById) {
        var cov = sheet.assets_covered || [];
        for (var i = 0; i < cov.length; i++) {
            var a = assetsById[cov[i]];
            if (a && a.class_name) return a.class_name;
        }
        return sheet.class_label || sheet.sheet_name || '';
    }

    // Resolve the machine roster for a sheet:
    //   assets_covered (AssetSheetMap)  UNION  any asset sharing the group's class.
    // This makes newly-added assets appear automatically once their Class matches.
    function roster(sheet, assetsById) {
        var ids = (sheet.assets_covered || []).slice();
        var cls = '';
        for (var i = 0; i < ids.length; i++) {
            var a0 = assetsById[ids[i]];
            if (a0 && a0.class_name) { cls = a0.class_name; break; }
        }
        if (!cls) cls = (sheet.class_label || '').trim();
        if (cls) {
            Object.keys(assetsById).forEach(function (id) {
                var a = assetsById[id];
                if (a && a.class_name === cls && ids.indexOf(id) < 0) ids.push(id);
            });
        }
        // de-dupe, drop scrapped, sort by asset id, map to {code,name}
        var seen = {};
        return ids.filter(function (id) {
                if (seen[id]) return false; seen[id] = 1;
                var a = assetsById[id];
                return !a || a.status !== 'Scrapped';
            })
            .sort(function (x, y) { return String(x).localeCompare(String(y)); })
            .map(function (id) { var a = assetsById[id] || {}; return { code: id, name: a.name || '' }; });
    }

    // Build ONE PM Plan document (one machine group / checklist sheet).
    function buildDoc(sheet, assetsById, logoUrl) {
        var machines = roster(sheet, assetsById);
        var tasks = sheet.tasks || [];
        var n = Math.max(machines.length, tasks.length);

        var body = '';
        for (var i = 0; i < n; i++) {
            var m = machines[i];
            var t = tasks[i];
            var freqs = (t && t.frequencies) || [];
            var ticks = FREQS.map(function (f) {
                return '<td class="pp-fq">' + (freqs.indexOf(f) >= 0 ? '✔' : '') + '</td>';
            }).join('');
            var desc = t ? ((t.task_no != null ? t.task_no + '. ' : '') + (t.description || '')) : '';
            body += '<tr>' +
                '<td class="pp-no">' + (m ? (i + 1) : '') + '</td>' +
                '<td class="pp-code">' + esc(m ? m.code : '') + '</td>' +
                '<td class="pp-name">' + esc(m ? m.name : '') + '</td>' +
                '<td class="pp-task">' + esc(desc) + '</td>' +
                ticks +
                '<td class="pp-method">' + esc(t ? (t.method || '') : '') + '</td>' +
            '</tr>';
        }

        var logo = logoUrl ? '<img class="pp-logo" src="' + esc(logoUrl) + '" alt="BFL" ' +
            'onerror="this.style.display=\'none\'">' : '';

        return '' +
        '<div class="pm-plan-doc">' +
          '<table class="pp-head">' +
            '<tr>' +
              '<td class="pp-head-logo" rowspan="4">' + logo + '</td>' +
              '<td class="pp-head-mid">' + esc(DOC.company) + '</td>' +
              '<td class="pp-head-right">' + esc(DOC.code) + '</td>' +
            '</tr>' +
            '<tr><td class="pp-head-mid">' + esc(DOC.sup) + '</td><td class="pp-head-right">' + esc(DOC.rev) + '</td></tr>' +
            '<tr><td class="pp-head-mid">' + esc(DOC.subject) + '</td><td class="pp-head-right">' + esc(DOC.eff) + '</td></tr>' +
            '<tr><td class="pp-head-group" colspan="2">' + esc(DOC.group) + esc(groupName(sheet, assetsById)) + '</td></tr>' +
          '</table>' +

          '<table class="pp-table">' +
            '<colgroup>' +
              '<col class="cg-no"><col class="cg-code"><col class="cg-name"><col class="cg-task">' +
              '<col class="cg-fq"><col class="cg-fq"><col class="cg-fq"><col class="cg-fq"><col class="cg-fq">' +
              '<col class="cg-method">' +
            '</colgroup>' +
            '<thead>' +
              '<tr>' +
                '<th class="pp-no" rowspan="2">ลำดับ</th>' +
                '<th class="pp-code" rowspan="2">รหัสเครื่องจักร</th>' +
                '<th class="pp-name" rowspan="2">ชื่อเครื่องจักร</th>' +
                '<th class="pp-task" rowspan="2">รายการตรวจสอบและบำรุงรักษา</th>' +
                '<th colspan="5">ความถี่ในการบำรุงรักษา</th>' +
                '<th class="pp-method" rowspan="2">วิธีการ<br>บำรุงรักษา</th>' +
              '</tr>' +
              '<tr>' +
                '<th class="pp-fq">สัปดาห์</th><th class="pp-fq">1 เดือน</th>' +
                '<th class="pp-fq">3 เดือน</th><th class="pp-fq">6 เดือน</th><th class="pp-fq">1 ปี</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + body + '</tbody>' +
          '</table>' +

          '<table class="pp-sign">' +
            '<tr>' +
              '<td>ผู้จัดทำ  ……………………………</td>' +
              '<td>ผู้อนุมัติ  ……………………………</td>' +
            '</tr>' +
            '<tr><td>( …………………………… )</td><td>( …………………………… )</td></tr>' +
            '<tr><td>………. / ………. / ……….</td><td>………. / ………. / ……….</td></tr>' +
          '</table>' +
        '</div>';
    }

    return {
        esc: esc,
        indexAssets: indexAssets,
        buildDoc: buildDoc
    };
})();
