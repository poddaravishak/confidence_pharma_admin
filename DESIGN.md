# DESIGN.md — Confidence Pharma Design System

> Calibrated against **UI Skills** (`ui-skills.com/mcp` / `ibelick/baseline-ui` & `anthropics/frontend-design`)

---

## 1. Brand Tokens & Color System

The palette is strictly anchored in Confidence Pharma's official healthcare identity:

| Token | Hex Value | Role & Usage |
|---|---|---|
| `--brand-primary` | `#073783` | Deep Royal Navy Blue — Primary branding, active states, key titles, primary buttons |
| `--brand-blue` | `#0799E6` | Healthcare Cyan Blue — Secondary brand accents, interactive links, info badges |
| `--brand-green` | `#20B83D` | Vibrant Medical Green — Growth, verified status, delivered orders, positive margins |
| `--brand-light` | `#DCEEFF` | Soft Blue Surface Tint — Active sidebar pill, subtle badge backgrounds, alert panels |
| `--background` | `#FFFFFF` | Pure White — Card surfaces, modal sheets, tables |
| `--surface` | `#F5F8FC` | Slate Blue-Gray Surface — App body canvas, input backgrounds, table headers |
| `--text-primary` | `#172B4D` | Deep Navy Charcoal — High-contrast legible body text, table cells, metric values |
| `--text-secondary` | `#64748B` | Neutral Slate — Subtitles, metadata, timestamps, secondary labels |

---

## 2. Typography Guidelines

- **Font Family:** Modern high-legibility system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Data & Numbers:** **MUST** use `tabular-nums` for all BDT currency (`৳`), quantities, percentages, and batch dates to guarantee tabular alignment.
- **Headings:** Apply `text-balance` to avoid awkward word breaks.
- **Body Copy:** Apply `text-pretty` for paragraphs and multi-line descriptions.
- **Casing:** Sentence case by default (e.g., "Add new medicine" rather than "ADD NEW MEDICINE"). Reserve uppercase only for short regulatory acronyms (`DGDA`, `NID`, `FEFO`, `COD`, `COGS`, `VAT`).

---

## 3. Component & Layout Rules (Baseline UI)

1. **Accessibility (`aria-label`):** Every icon-only button (search, close modals, notification bell) has an explicit `aria-label`.
2. **Viewport Units:** Use `h-dvh` instead of `h-screen` for sidebar and modals to support mobile browsers properly.
3. **Square Indicators:** Prefer `size-*` utilities (e.g. `size-8`, `size-10`) over `w-* h-*`.
4. **Restrained Shadows:** Use Tailwind default `shadow-xs` and `shadow-sm` on white cards with fine border definition (`border-slate-200/80`). Avoid murky or excessive drop shadows.
5. **No AI Clichés:** No generic purple/indigo gradients, no glowing neon borders. Accents are purposeful and limited to healthcare indicators (Navy `#073783`, Cyan `#0799E6`, Green `#20B83D`, Amber for near-expiry, Rose for low stock/debt).

---

## 4. MCP Server Integration

- Configured in `.agents/mcp_config.json`:
  ```json
  {
    "mcpServers": {
      "ui-skills": {
        "url": "https://www.ui-skills.com/mcp"
      }
    }
  }
  ```
- Exposes:
  - `list_skills`
  - `get_skill`

