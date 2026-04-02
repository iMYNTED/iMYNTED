# iMYNTED Design System — Phase 0 Lock

## Core Identity
Professional trading terminal. Bloomberg density + Moomoo ease + modern execution.
NOT a retail broker app. NOT a dashboard of cards. A TERMINAL.

---

## Color System

### Backgrounds
| Token          | Value                  | Usage                    |
|----------------|------------------------|--------------------------|
| bg-base        | `#040a12`              | Terminal base             |
| bg-surface     | `rgba(255,255,255,0.03)` | Panel surface           |
| bg-surface-alt | `rgba(255,255,255,0.05)` | Hover / active surface  |
| bg-inset       | `rgba(0,0,0,0.30)`    | Inset areas (headers)    |
| bg-overlay     | `rgba(0,0,0,0.60)`    | Modal overlays           |

### Borders
| Token          | Value                    | Usage                  |
|----------------|--------------------------|------------------------|
| border-panel   | `rgba(255,255,255,0.08)` | Panel edges            |
| border-divider | `rgba(255,255,255,0.06)` | Internal dividers      |
| border-active  | `rgba(255,255,255,0.15)` | Active/focused edges   |

### Text
| Token          | Value              | Usage                    |
|----------------|--------------------|--------------------------|
| text-primary   | `rgba(255,255,255,0.92)` | Primary content    |
| text-secondary | `rgba(255,255,255,0.60)` | Labels, headers    |
| text-muted     | `rgba(255,255,255,0.40)` | Hints, timestamps  |
| text-dim       | `rgba(255,255,255,0.25)` | Disabled, captions |

### Semantic
| Token      | Value       | Usage             |
|------------|-------------|-------------------|
| green-up   | `#22c55e`   | Positive / buy    |
| red-down   | `#ef4444`   | Negative / sell   |
| cyan-accent| `#22d3ee`   | Accent / active   |
| amber-warn | `#f59e0b`   | Warnings          |

---

## Typography

| Role        | Size   | Weight   | Tracking | Usage                |
|-------------|--------|----------|----------|----------------------|
| panel-title | 11px   | 600      | 0.04em   | Panel headers        |
| data-label  | 10px   | 500      | 0.03em   | Column headers, tags |
| data-value  | 11px   | 400      | normal   | Table cells, values  |
| data-mono   | 11px   | 400      | normal   | Prices, numbers      |
| stat-large  | 13px   | 600      | tight    | Summary numbers      |
| chip-text   | 10px   | 600      | 0.06em   | Buttons, pills       |
| bar-text    | 11px   | 500      | normal   | Top bar content      |

Font stack: `ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', monospace` for numbers.  
System sans for labels: `system-ui, -apple-system, sans-serif`.

---

## Spacing

| Token   | Value | Usage                     |
|---------|-------|---------------------------|
| gap-xs  | 2px   | Between inline elements    |
| gap-sm  | 4px   | Between controls           |
| gap-md  | 6px   | Between panel sections     |
| gap-lg  | 8px   | Between panels (grid gap)  |
| pad-xs  | 4px   | Inset padding (compact)    |
| pad-sm  | 6px   | Panel content padding      |
| pad-md  | 8px   | Panel header padding       |

Rule: NEVER more than 8px gap between panels. NEVER more than 6px internal padding.

---

## Panel Rules

### Shape
- Border radius: `rounded-sm` (2px) for panels. NEVER rounded-lg/xl/2xl/[20px].
- Border: 1px `border-panel`. No shadows. No gradients.
- Background: `bg-surface` or transparent.

### Headers
- Height: 28px max.
- Left-aligned title (11px semibold uppercase).
- Right-aligned controls if needed.
- Bottom border `border-divider`.

### Content
- Flush to edges. No internal rounding.
- Tables: no cell borders, alternating subtle row bg.
- Scrollable overflow with thin scrollbar.

---

## Layout Rules

### Sidebar
- Width: 48px (icon-only rail).
- Expand on hover OR keep collapsed always.
- Icons + tooltips. No text unless expanded.
- Active indicator: left edge accent bar.

### Top Bar
- Height: 32-36px. ONE row only.
- Contains: brand mark, system status, active symbol + quote, workspace chips, command input trigger.
- Integrated — not a separate "card" or "row".

### Workspace Grid
- CSS Grid `grid-cols-12` with `gap-[6px]` (NOT gap-3).
- Columns should fill edge to edge below top bar.
- No wrapper cards around the grid — panels ARE the grid cells.

### Resizable
- Dividers: 4px hit area (not 12px).
- Visual: 1px line, cyan highlight on hover.
- No pill/thumb handles.

---

## Event Naming (locked)

| Event                     | Payload                              |
|---------------------------|--------------------------------------|
| `imynted:symbolPick`      | `{ symbol, asset, source? }`         |
| `imynted:quote`           | `{ symbol, asset, price, bid, ask, mid, chg, chgPct, vol, ts }` |
| `imynted:tradeAction`     | `{ action, symbol, asset }`          |
| `imynted:orderTicketSubmit` | `{ side, symbol, asset, qty, type, limit?, tif }` |
| `imynted:toast`           | `{ kind, title, body? }`             |
| `imynted:togglePanel`     | `{ panel }`                          |

---

## Symbol Sync Rules
1. ONE active symbol at a time (per asset type).
2. Symbol change updates: chart, L2, tape, trader, news, symbol header.
3. Asset switch preserves last symbol per asset.
4. Click any row (scanner/positions/watchlist) → `imynted:symbolPick`.

---

## Component File Rules
- One component per file.
- One clear objective per file.
- Preserve event wiring when editing.
- Full file replace only when structure fundamentally changes.
- Surgical edits for styling/behavior tweaks.

---

## Anti-Patterns (BANNED)
- `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-[20px]` on panels
- `shadow-lg`, `shadow-xl` on panels
- `bg-gradient-*` on panel backgrounds (subtle allowed on base only)
- Padding > 8px between panels
- Multiple top-bar rows (must be single dense bar)
- Sidebar wider than 48-56px
- Input fields with rounded-full (use rounded-sm)
- Retail "card" layouts
- Popup-style floating panels
