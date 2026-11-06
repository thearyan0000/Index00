# Publish Index 00 on GitHub (GitHub Pages)

This clean repository package was made from the **uploaded Index00_Performance_Optimized.zip**. It includes the full React/TypeScript/WebGL source, Node/Express source, optimized raster worker, Windows launchers, project storage, editor assets, and deployment workflow. It excludes `node_modules`, build output, and generated test screenshots.

## Easiest publishing method: GitHub Desktop (no terminal)

1. Extract this ZIP. Open **GitHub Desktop** and sign in to `thearyan0000`.
2. Choose **File > Add local repository** and select the extracted `Index00_GitHub_Upload_Ready` folder. If it is not a Git repository, click **Create a repository here**.
3. Enter commit message `Initial Index 00 upload`, choose **Commit to main**, then click **Publish repository**. Set name to `Index00` and **uncheck Keep this code private**. This creates the public repository on GitHub automatically.
4. On GitHub, open `Settings > Pages > Build and deployment > Source`, then choose **GitHub Actions**.
5. Open the `Actions` tab. The `Publish Index 00` workflow builds `frontend/` and deploys `frontend/dist/`. If needed, enable the workflow or run it manually.
6. When deployment succeeds, your website should appear at **https://thearyan0000.github.io/Index00/**.

If `Index00` already exists as a GitHub repository, do not publish a duplicate from GitHub Desktop; follow the existing repository steps below.

## Existing repo alternative (Git command line)

If you already created the empty repository, open a terminal inside the extracted root:

```bash
git init -b main
git add .
git commit -m "Publish Index 00 optimized editor"
git remote add origin https://github.com/thearyan0000/Index00.git
git push -u origin main
```

If `git remote add origin` reports it already exists, check `git remote -v` and adjust the existing remote instead of adding it again.

## Run locally

Windows: double-click `RUN_WINDOWS.bat` (Node.js must be installed); open `http://localhost:5173/`.

Or:

```bash
npm ci
npm ci --prefix frontend
npm ci --prefix backend
npm run dev
```

## Notes

- The Vite production base is selected by `VITE_BASE_PATH` in GitHub Actions; the localhost app uses `/`.
- Source icons and loader assets use relative URLs so they load from `/Index00/`.
- Browser project storage uses IndexedDB/Dexie; it is local to each visitor's browser.
- GitHub Pages is not a backend host. If you later add real server-dependent features, deploy the backend separately.
- If the repository is renamed, the workflow's base path follows the repository name, but the live URL also changes.
