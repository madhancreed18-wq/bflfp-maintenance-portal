# Push this folder to GitHub — step-by-step

Three options, pick whichever you're most comfortable with.

---

## Option A — Command line (fastest, ~2 minutes)

**Prerequisites:** `git` installed, a GitHub account.

### 1. Create the empty repo on GitHub (web UI)

1. Go to https://github.com/new
2. **Repository name**: `bflfp-maintenance-portal`
3. **Visibility**: **Private** ← important, the JS contains a Power Automate signature
4. **Do NOT** check "Add a README" or "Add .gitignore" — we already have those
5. Click **Create repository**
6. On the next page, copy the HTTPS URL shown (e.g. `https://github.com/yourusername/bflfp-maintenance-portal.git`)

### 2. Initialize and push (from this folder)

Open a terminal in `C:\Users\Madhan\Downloads\files\MaintanceBFLFP` and run:

```powershell
# Initialize the repo
git init
git branch -M main

# Identify yourself if you haven't yet
git config user.name  "Your Name"
git config user.email "Production@bluefalo-group.com"

# Stage everything
git add .

# First commit
git commit -m "Initial commit: BFLFP Maintenance Portal (Home, Dashboard, PM KPI matrix)"

# Connect to your GitHub repo (replace YOUR-URL with the one from step 1)
git remote add origin https://github.com/YOUR-USERNAME/bflfp-maintenance-portal.git

# Push
git push -u origin main
```

GitHub will prompt for credentials. Use a **Personal Access Token** as the password (not your account password):
https://github.com/settings/tokens/new — give it the `repo` scope, copy the token, paste it when prompted.

That's it. The repo is up.

---

## Option B — GitHub Desktop (no terminal)

**Prerequisites:** [GitHub Desktop](https://desktop.github.com/) installed and signed in.

1. Open GitHub Desktop → **File → Add Local Repository**
2. Browse to `C:\Users\Madhan\Downloads\files\MaintanceBFLFP`
3. It will say "this directory does not appear to be a Git repository" — click **create a repository here**
4. Set:
   - **Name**: `bflfp-maintenance-portal`
   - **Description**: BFLFP Maintenance Portal
   - **Initialize with README**: leave **unchecked** (we have one already)
5. Click **Create repository**
6. Enter a commit message like `Initial commit` and click **Commit to main**
7. Click **Publish repository** at the top
8. **Keep this code private** ← make sure this checkbox is checked
9. Click **Publish repository**

Done — your folder is now on GitHub.

---

## Option C — VS Code (integrated)

1. Open the folder in VS Code: `File → Open Folder → MaintanceBFLFP`
2. Open the **Source Control** panel (icon on left, or `Ctrl+Shift+G`)
3. Click **Initialize Repository**
4. Stage all files (the `+` icon next to "Changes")
5. Type a commit message and press `Ctrl+Enter` to commit
6. Click **Publish Branch** → choose **Publish to GitHub private repository**
7. Name it `bflfp-maintenance-portal`

Done.

---

## After pushing — verify and protect

1. Visit your repo URL in a browser, confirm files are there.
2. Confirm the lock icon next to the repo name (means private).
3. **Settings → Collaborators** → invite anyone who needs access.
4. **Settings → Secrets and variables → Actions** → consider moving `DATA_URL` to a secret if you later add CI.

## When you change files later

```powershell
git add .
git commit -m "Describe what changed"
git push
```

---

## If anything breaks

| Problem | Fix |
|---|---|
| `git: command not found` | Install Git: https://git-scm.com/download/win |
| `Permission denied (publickey)` | You're using SSH but no key set up. Use HTTPS URL instead. |
| `Authentication failed` | Generate a Personal Access Token: https://github.com/settings/tokens/new (scope: `repo`). Use it as the password. |
| `remote rejected — file too large` | Check `web-files/` for large images; nothing here should exceed 100 MB. |
| Want to undo `git init` | Delete the hidden `.git` folder inside `MaintanceBFLFP` and start over. |
