## Create a new game from this template

```bash
npx degit github:<YOUR_USER>/react-game-engine-template my-new-game
cd my-new-game
npm install
git init
git add .
git commit -m "Initial commit"



Notes:
- `degit` copies files without Git history (exactly what you want).
- `git init` makes the new folder its own repo.

## 4) Git ignore and hygiene
Make sure `.gitignore` includes at least:
- `node_modules`
- `dist`
- `.env`
- `.DS_Store`

Vite’s default `.gitignore` already covers most of this.

Then commit:
```bash
git add .
git commit -m "Initial template scaffold (Vite + React)"
git push -u origin main
