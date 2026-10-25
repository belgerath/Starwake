# Starwake

Fly a 400 m destroyer around an Earth-sized ringed planet with real orbital physics. Runs in the browser on phones and desktops.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

The terminal prints two addresses. Open the **Local** one on your computer. To play on your phone, connect it to the same Wi-Fi and open the **Network** one.

## Put it online (GitHub Pages)

1. Create an empty repository on GitHub called `starwake`.
2. In this folder:
   ```bash
   git remote add origin https://github.com/<your-username>/starwake.git
   git push -u origin main
   ```
3. On GitHub, open the repository's **Settings → Pages** and set **Source** to **GitHub Actions**.

Every push to `main` now runs the tests, builds the game and publishes it at `https://<your-username>.github.io/starwake/`. On a phone, use **Share → Add to Home Screen** to play it full screen.

## Work on it with Claude Code

Open a terminal in this folder and run `claude`. `CLAUDE.md` gives Claude Code the architecture, the agreed flight feel and the roadmap. A good first prompt: *"Read CLAUDE.md, then plan the Tal landing phase."*

## Checks

```bash
npm test        # physics and handling tests
npm run build   # production build
```
