# Branching Model

| Branch       | Environment | Deploy trigger         |
|--------------|-------------|------------------------|
| `main`       | Production  | Push to `main`         |
| `develop`    | Staging     | Push to `develop`      |
| `feature/*`  | Preview     | Push / PR (Vercel Preview) |

---

## Branch roles

- **`main`** – Production. Protected; only merge after review. Deploys to production URL (e.g. `https://diabeaters.vercel.app`).
- **`develop`** – Staging. Integration branch for features. Deploys to staging URL. Use for pre-release testing.
- **`feature/*`** – Feature branches. Open PRs against `develop` or `main`. Vercel creates a unique Preview URL per branch/PR.

---

## Typical flow

1. `git checkout develop`
2. `git pull origin develop`
3. `git checkout -b feature/your-feature`
4. Make changes, commit, push
5. Open PR to `develop` → Vercel Preview URL for the branch
6. Merge to `develop` → Staging URL updates
7. Test on staging
8. Open PR from `develop` to `main`
9. Merge to `main` → Production goes live

---

## Commands

```bash
# Create develop if it doesn't exist
git checkout -b develop
git push -u origin develop

# Create feature branch
git checkout develop
git pull
git checkout -b feature/xyz

# Merge to staging
git checkout develop
git merge feature/xyz
git push origin develop

# Promote to production
git checkout main
git pull
git merge develop
git push origin main
```
