# Set up GitHub Pages for BFLFP Maintenance Portal

The static site is in the `docs/` folder of this repo. Once you enable GitHub Pages, your site will be live at:

```
https://madhancreed18-wq.github.io/bflfp-maintenance-portal/
```

## Step 1 — Commit and push the new files

```powershell
cd C:\Users\Madhan\Downloads\files\MaintanceBFLFP
git add docs/ SETUP_GITHUB_PAGES.md
git commit -m "Add static site for GitHub Pages hosting"
git push
```

## Step 2 — Turn on GitHub Pages

1. Go to `https://github.com/madhancreed18-wq/bflfp-maintenance-portal/settings/pages`
2. Under **Source**, select **Deploy from a branch**
3. Under **Branch**, select `main` and `/docs`
4. Click **Save**
5. Wait 1–2 minutes — GitHub builds the site

When it's ready, the Pages page will show:
> Your site is live at `https://madhancreed18-wq.github.io/bflfp-maintenance-portal/`

## Step 3 — Test CORS BEFORE assuming dashboards work

CORS is the #1 thing that breaks Power Automate calls from a different origin. Visit:

```
https://madhancreed18-wq.github.io/bflfp-maintenance-portal/cors-test.html
```

Click **Test POST** and **Test GET**. You should see:
- ✅ Status 200
- JSON response body containing your maintenance records

### If CORS fails

Open the flow in Power Automate Studio:

1. Click the **Response** action (the last action in the flow)
2. Click **Show advanced options**
3. In the **Headers** field, add this JSON object:
   ```json
   {
     "Content-Type": "application/json",
     "Access-Control-Allow-Origin": "*",
     "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
     "Access-Control-Allow-Headers": "Content-Type"
   }
   ```
4. Save the flow
5. Re-run `cors-test.html` — should now pass

## Step 4 — Verify each page

Once CORS passes, visit each page:
- Home: `https://madhancreed18-wq.github.io/bflfp-maintenance-portal/`
- Dashboard: `…/dashboard.html`
- Maintenance Log: `…/maintenance-log.html`
- Reports: `…/reports.html`
- About: `…/about.html`

Each page should:
1. Show the announcement banner at the top with today's date
2. Show the nav with active link highlighted
3. Load real data from your Power Automate flow
4. Show the footer at the bottom

## Step 5 (optional) — Custom domain

If you have a domain like `maintenance.bluefalo-group.com`:

1. Create a `CNAME` file at `docs/CNAME` with one line: your domain
2. Push
3. In your DNS provider, add a `CNAME` record pointing your subdomain to `madhancreed18-wq.github.io`
4. In repo Settings → Pages → Custom domain, enter your domain, save, wait for HTTPS to provision

## Folder layout

```
bflfp-maintenance-portal/
├── docs/                                  ← GITHUB PAGES SERVES FROM HERE
│   ├── .nojekyll                          (tells GitHub to skip Jekyll processing)
│   ├── index.html                         (Home)
│   ├── dashboard.html
│   ├── maintenance-log.html
│   ├── reports.html
│   ├── about.html
│   ├── cors-test.html                     (diagnostic page)
│   └── assets/
│       ├── master.css / master.js         (shared nav + footer)
│       ├── home.css / home.js
│       ├── dashboard.css / dashboard.js
│       ├── maintenance-log.css / maintenance-log.js
│       ├── reports.css / reports.js
│       ├── about.css / about.js
│       └── Bluefalo.png
│
├── web-pages/                             ← POWER PAGES SOURCE FILES (kept intact)
│   ├── Home/                              (you can still deploy these to Power Pages)
│   ├── Dashboard/
│   └── …
├── web-templates/
├── web-files/
├── content-snippets/
└── README.md
```

Both hosting setups can coexist. The `docs/` files are the GitHub Pages version; the rest of the repo is the Power Pages version.

## Updating the site

After making changes in any `docs/` file:

```powershell
git add docs/
git commit -m "Describe your change"
git push
```

GitHub Pages auto-rebuilds in 1–2 minutes — no manual deploy step.

## Updating the data URL

If you regenerate the Power Automate flow signature, update **all six places**:

| File | What to update |
|---|---|
| `docs/assets/home.js` | `DATA_URL` constant |
| `docs/assets/dashboard.js` | `DATA_URL` constant |
| `docs/assets/maintenance-log.js` | `DATA_URL` constant |
| `docs/assets/reports.js` | `DATA_URL` constant |
| `docs/cors-test.html` | `DATA_URL` variable |
| `web-pages/*/[page].en-US.customjs.js` | only if you also deploy to Power Pages |

A quick PowerShell one-liner to do all of them at once:

```powershell
$old = 'sig=OLD_VALUE'
$new = 'sig=NEW_VALUE'
Get-ChildItem -Recurse -Include *.js,*.html |
    ForEach-Object { (Get-Content $_.FullName -Raw).Replace($old, $new) | Set-Content $_.FullName -NoNewline }
```
