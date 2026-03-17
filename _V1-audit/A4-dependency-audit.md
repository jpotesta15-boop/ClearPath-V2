# Dependency Audit Report

**Generated:** 2025-03-15  
**Sources:** `npm audit`, `npm outdated`, `package.json`, `A1-dead-code-scan.md`

---

## 1. Critical or high severity vulnerabilities (npm audit)

**Audit summary:** 3 vulnerabilities (1 moderate, 2 high). **No critical.**

| Severity | Package   | Issue | Fix |
|----------|-----------|--------|-----|
| **High** | `flatted` | Unbounded recursion DoS in `parse()` revive phase — [GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f) | Resolved by `npm audit fix` (bump to flatted ≥3.4.0) |
| **High** | `minimatch` | ReDoS (multiple advisories: wildcards, GLOBSTAR, extglobs) — GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 | Resolved by `npm audit fix` (transitive via `@typescript-eslint/typescript-estree`) |
| Moderate | `ajv`     | ReDoS when using `$data` option — [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | Resolved by `npm audit fix` |

**Recommendation:** Run:

```bash
npm audit fix
```

Then run `npm audit` again. If any issues remain (e.g. breaking changes), consider `npm audit fix --force` only after testing; prefer upgrading direct dependencies so transitive ones update.

---

## 2. Packages more than 2 major versions behind latest

From `npm outdated`:

| Package       | Current | Latest | Gap   | Recommendation |
|---------------|---------|--------|-------|----------------|
| **stripe**    | 17.7.0  | 20.4.1 | 3 major | **Update with care.** Stripe API often has breaking changes across majors. Before V2: upgrade to latest v17.x for patches; plan a dedicated upgrade to v18+ (and then v20 if needed) with [Stripe migration guides](https://github.com/stripe/stripe-node/wiki/Migration-guide). Run tests and payment flows after upgrade. |
| **@types/node** | 20.x  | 25.5.0 | 5 major | **Optional.** Types only; no runtime impact. Stay on `^20` to match Node 20 LTS, or move to `^22` if you run Node 22. Avoid jumping to 25 unless you need Node 25 typings. Recommendation: keep `^20` for stability before V2. |

All other outdated packages are within 1–2 major (or minor/patch) and can be updated in the normal course (e.g. `npm update` or targeted `npm install <pkg>@latest`).

---

## 3. Duplicate packages (same responsibility)

Checked for:

- **Date libraries:** Only `date-fns` is used. No moment, dayjs, or luxon.
- **Icon sets:** No dedicated icon package; `@radix-ui/react-slot` is for composition (Slot), not icons.
- **Form/validation:** Only `zod` for validation; no react-hook-form or formik in `package.json`.

**Result:** No duplicate packages. No clean-up needed.

---

## 4. Installed but unused packages (cross-reference with A1)

Per **A1-dead-code-scan.md** §4 (“npm packages in package.json never imported”): every dependency is used. No package is installed and unused.

**Recommendation:** None.

---

## 5. Packages that should be devDependencies

Current split:

- **dependencies:** next, react, react-dom, Supabase, Upstash, Stripe, UI/animation (framer-motion, recharts, dnd-kit, radix slot), date-fns, clsx, tailwind-merge, zod — all appropriate for production/runtime.
- **devDependencies:** TypeScript, ESLint, Tailwind/PostCSS, `@types/*` — all appropriate for build/lint only.

**Result:** No package in `dependencies` should be moved to `devDependencies`.

---

## 6. Next.js version and upgrade recommendation before V2

| Item        | Value    |
|------------|----------|
| **Current** | 16.1.6  |
| **Latest stable** | 16.x (Next.js 16) |

You are already on the latest **major** (16). Next.js 16 is current stable with Turbopack stable, React 19.2 support, and caching/compiler improvements.

**Recommendation before V2:**

- **Do not** do a major upgrade (e.g. to a hypothetical 17) right before V2 unless you have a specific need.
- **Do** stay on 16.x and periodically update to the latest 16.x patch/minor (e.g. `npm install next@16 eslint-config-next@16`) for security and bug fixes.
- Pin or align `eslint-config-next` with the same Next version (you already have both at 16.1.6).

---

## Summary table

| # | Category              | Finding | Action |
|---|------------------------|---------|--------|
| 1 | Critical/High vulns   | 2 high, 0 critical | Run `npm audit fix` |
| 2 | >2 major behind       | stripe (3), @types/node (5) | stripe: stay on v17 or plan staged upgrade; @types/node: keep ^20 |
| 3 | Duplicates            | None   | No change |
| 4 | Unused packages       | None   | No change |
| 5 | Misplaced deps        | None   | No change |
| 6 | Next.js               | 16.1.6, latest major | Stay on 16.x; update to latest 16.x before V2 |

---

## Suggested commands (before V2)

```bash
# Fix high/moderate vulnerabilities
npm audit fix

# Optional: refresh within current major/patch ranges
npm update

# Optional: bump Stripe to latest v17 only (no major jump)
npm install stripe@^17
```

After any change, run `npm run build` and smoke-test auth, payments, and key coach/client flows.
