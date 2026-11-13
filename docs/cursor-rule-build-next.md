# Cursor rule draft — `build-next`

Copy into `.cursor/rules/build-next.mdc` when Agent mode can create non-markdown files (frontmatter below is required for Cursor rules).

```markdown
---
description: After builds, follow product brief + roadmap; propose next 1–3 items and wait for go
alwaysApply: true
---

# Continue from the roadmap

When the user asks to continue building, ship the next item, or asks what is next:

1. Read `docs/product-brief.md` and `docs/build-roadmap.md`.
2. Prefer the top unchecked **P0**, then **P1**. One item at a time unless the user names a batch.
3. Implement in the repo; match existing `app/` patterns. Phone-first, short copy, honest empty states.
4. Do **not** commit, push, change production env, or touch secrets unless the user explicitly asks.
5. When the item is done:
   - Check it off in `docs/build-roadmap.md` (move to Done recently if useful).
   - Summarize what shipped in a few lines.
   - Propose the next **1–3** unchecked items with one-line why each.
   - **Stop and wait** for go / skip / reorder. Do not start the next item unprompted.

If the user says only `Continue from the roadmap` or `Do the next P0 only`, treat that as go for that single next item, then still propose-and-wait after.
```

Until that file exists, the same instructions live in [AGENTS.md](../AGENTS.md) at the repo root.
