# Hugessen Consulting — Design System

A complete brand & design system for **Hugessen Consulting Inc.**, Canada's leading independent executive compensation and board effectiveness advisory firm. This system is derived directly from Hugessen's official 16:9 PowerPoint template and brand guidelines.

> **Tagline:** Independent Insight for Confident Decisions

---

## About Hugessen

Hugessen Consulting is Canada's leading **independent executive compensation and board effectiveness advisory firm**. Founded in 2006 and 100% employee-owned, Hugessen serves 200+ clients annually — including large-cap public companies, private enterprises, crown corporations, and pension funds — from offices in **Toronto, Calgary, and Montréal**, with affiliates in the US (**Semler Brossy**) and UK (**MM&K**).

- **Core services:** Executive compensation, board effectiveness, CEO performance management, governance advisory.
- **Audience:** Boards of directors, compensation committees, senior management teams.
- **Tone:** Professional, authoritative, polished — confident without being aggressive. *Trusted advisor, not salesperson.*
- **Brand attributes:** Independent. Business-minded. Practical. Client-first.
- **Team:** ~35+ professionals including 9 partners, each with 15+ years of experience.

---

## Sources

- `uploads/Introduction to Hugessen Template.pptx` — 91-slide official intro deck (text, charts, full visual system, theme XML).
- *(Missing)* `uploads/Hugessen (16x9) - Timesaver Template - Oct. 2023.potx` — referenced but not uploaded. **See "Caveats" at the bottom.**
- Theme reference inside the pptx: `ppt/theme/theme1.xml` — color scheme `Custom 35`, font scheme `Office`.

---

## CONTENT FUNDAMENTALS

Hugessen's voice is the voice of a senior advisor speaking to a board chair. It is calm, declarative, and quietly confident. Copy is structured, scannable, and substance-heavy. There is no marketing fluff, no exclamation points, and no contractions in formal output.

### Voice & tone
- **Authoritative, not aggressive.** Statements are direct. Hugessen "advises," "supports," "helps," and "provides" — verbs of service, not pitch.
- **Plural and institutional.** *"We"* and *"Our"* dominate. Almost never *"I"*. Clients are *"you"* in second person, but more often referred to objectively as *"the Committee,"* *"the Board,"* or *"the Company."*
- **Trusted-advisor register.** Sentences often start with subject + verb: *"We offer…"*, *"Our people apply…"*, *"Hugessen has extensive experience…"*. Confident but never boastful.
- **No emoji. No exclamations. No casual phrasing.** This is board-room formality.
- **Canadian English.** *"Counsel"*, *"organisation"* yields to American spellings (*"organizational"*, *"behavioural"* mixes appear) — match what's around you; default to Canadian-style for proper nouns.

### Casing
- **Title Case for slide titles and section headers.** *"Our Key Differentiators"*, *"Examples of Where We Support Our Clients"*.
- **Sentence case for body copy and bullets.**
- **UPPERCASE eyebrows / kickers** at small sizes only, with letter-spacing (e.g. `CLIENTS BY ORGANIZATIONAL TYPE`).
- Acronyms unexpanded after first mention: HRC, ED&I, STIP, LTIP, CD&A, NEO, ICD, TSX60.

### Sentence rhythm
- Long, balanced sentences with embedded clauses. Hugessen rarely uses 5-word punchy lines. A typical sentence:
  > "Our advice is geared to ensuring continued alignment of compensation philosophy and structure with evolving strategy and operating imperatives."
- Bullets are **dense** — full clauses, often 15–25 words, ending without periods.
- Tables and 3-column layouts are common: `Component | Anticipated Activities | Est. Fees`.

### Tone examples (real, from the template)
- "Independent Insight for Confident Decisions" — *the tagline; it sets the standard.*
- "Hugessen Consulting helps board of directors make the right decisions on executive compensation and its governance, CEO performance management and Board effectiveness."
- "We offer our clients independent, strategic advice based on our extensive practical experience supported by best practices and geared toward a single goal: the best interests of our clients."
- "We are a director's first call when a company finds itself in a challenging situation requiring truly independent advice and sound judgement."

### Disclaimer / placeholder convention
The template uses **square-bracket placeholders** in `[ALL CAPS]` for client-specific fill-ins: `[NAME]`, `[INDUSTRY]`, `[CLIENT]`, `[RELEVANT HUGESSEN LOGOS]`, `[CHANGE AS APPLICABLE]`. Preserve this convention in any new templates.

---

## VISUAL FOUNDATIONS

### Color palette
The brand is built on a **two-color story**: deep navy + signal orange, on white, with neutral grays for everything else. There are no other accents.

| Token | Hex | Role |
|---|---|---|
| **Hugessen Orange** | `#F0531E` | Primary accent. Used sparingly — kickers, key headlines, links, accent rules, single emphasized stats. |
| Orange Deep | `#EA3C18` | Hover/pressed deepening |
| Orange Link | `#F16824` | Hyperlink color (theme `hlink`) |
| **Hugessen Navy** | `#002957` | Primary dark. Title slides, section bands, headings, navy-block layouts. |
| Navy Deep | `#011D45` | Layered/secondary navy |
| Charcoal | `#5F6269` | Body text (theme `dk1`) |
| Slate | `#464B54` | Stronger labels |
| Ink | `#32363D` | Headlines on white |
| Gray-300 | `#C7C9C8` | Borders, dividers |
| Gray-200 | `#DFE1DF` | Soft surfaces, table stripes |
| Gray-100 | `#F2F2F2` | Page-section background |
| White | `#FFFFFF` | Primary surface |

**Restraint rule:** ~70% of any deck/document is white + charcoal text. Navy is for structure (bands, titles). Orange is the accent — never the dominant surface — except on the title slide and the logo lock-up.

### Typography
- **Family:** Calibri / Calibri Light (Microsoft proprietary; ships with Office). Web fallback is **Open Sans** — a humanist sans with similar metrics. *(See Caveats — Calibri font files are not redistributable; the substitution is documented in `colors_and_type.css`.)*
- **Headings & title slides:** Calibri Light, often at large sizes (40–56px). Slide titles are typically **navy** or **white-on-navy**.
- **Body:** Calibri Regular, 14–18px in slides. Color: charcoal `#5F6269`.
- **Accents:** Orange used for stat numbers, key callout words, and very short phrases — never for body copy.
- **No serifs.** No display fonts. The brand is intentionally workmanlike.
- **Eyebrows / category labels:** UPPERCASE, semibold, tracked +0.16em, often orange.

### Backgrounds & imagery
- **Predominantly white.** Hugessen documents are clean, paper-like.
- **Photo language:** *Architectural*, *desaturated*, *grayscale-leaning*. The hero photo from the deck (`assets/hero-architecture.png`) is a B&W shot of a brutalist concrete grid — geometric, abstract, suggesting structure and rigor. Imagery favors **buildings, geometry, abstraction** over people.
- **No gradients** other than very subtle navy-to-navy-deep on title slides if at all. **No bluish-purple gradients.** **No drop-shadow imagery.**
- **No textures, patterns, or repeating motifs.**
- **Full-bleed photo** is reserved for title/section slides — never behind body content.

### Animation & motion
- **Minimal.** This is a print-first brand. Decks are read, not played.
- For web/digital surfaces: simple **fades** (200ms) and **slide-up** entries (240ms ease-out). No bounce. No spring. No 3D.
- Hover/press: small color shifts only — no scale, no rotation.

### Hover & press states
- **Buttons (primary, orange):** hover deepens to `#EA3C18`. Press: same deepening + slight inset.
- **Buttons (secondary, navy outline):** hover fills navy with white text.
- **Links:** hover deepens orange + underline thickens slightly.
- **No opacity-based hover** — color shifts are explicit.
- **No scale or transform** on press; the brand is dignified.

### Borders, rules & dividers
- **1px hairlines** in `gray-300` are the workhorse divider.
- **3px orange accent rule** (`width: 48px`) under H1 and section eyebrows on key layouts — a signature device.
- **Navy bottom border** under section title bars.
- Tables: alternating-row stripes use `gray-200` (`#DFE1DF`) very subtly.

### Shadows / elevation
- **Almost none.** The brand is flat. When elevation is needed (dropdowns, cards in interactive UI), use a soft `0 1px 2px rgba(50,54,61,0.06), 0 2px 6px rgba(50,54,61,0.06)`.
- **No inner shadows.** No glow.

### Corner radii
- **0–2px is the default.** This is a hard-edged corporate brand.
- 4px allowed for soft UI surfaces (form inputs, dropdowns).
- 8px is rare; reserved for special interactive moments. **Never** large pill-shapes or rounded cards as a default.
- Buttons: **2px radius**. Cards: **0 or 2px**.

### Layout rules
- **Slides are 16:9 at 12192000×6858000 EMU = 1280×720 nominal (or 1920×1080 at 1.5×).**
- Title bar: orange accent block (top-left corner) + navy title text. Page number in bottom-right.
- Generous whitespace in margins; **dense content blocks**. The pattern is "mat the data on a clean background."
- Three-column comparison is the most common content layout; navy header row + bullet body is the most common table style.

### Transparency & blur
- **Avoided.** Hugessen documents are crisp and opaque. No glass-morphism, no blur, no semi-transparent overlays except as a 60–80% white scrim over the rare photo background.

### Card style
- White background, hairline border (`#C7C9C8`), 0–2px radius, no shadow. Sometimes a 3px orange or navy left-border accent — but only when it carries meaning (e.g., emphasized list of differentiators).
- Card padding: 20–24px.

### Imagery vibe summary
- **Cool**, **B&W**, **architectural**, **geometric**.
- Where photos appear of people, they are conservative business portraits, sharp focus, neutral backgrounds.

---

## ICONOGRAPHY

The Hugessen template uses **PowerPoint stock icons** (Microsoft Office "Icons" gallery — pictograms in solid black or single-color fill) for things like geographic markers, charts, and process steps. There is **no proprietary icon library** and **no icon font** baked into the brand.

- **Style:** Single-color, solid-fill, pictographic. Stroke icons are **not** used. Outlined or duotone icons are **not** used.
- **Color:** Always **navy `#002957`** or **orange `#F0531E`**. Never multicolor.
- **Sizing:** Generous — usually 32–48px in slide context, paired with a heading.
- **Use:** Sparingly. Most slides have **no icons at all**. Icons appear on the "Why Hugessen?" / "Differentiators" / "Process" slides as visual anchors for column headers, never for ornament.
- **No emoji. No unicode glyphs as icons.** The brand is text-first.

### Web substitute
For HTML/web surfaces, we substitute **[Lucide Icons](https://lucide.dev/)** (CDN) at `stroke-width: 1.5`, **filled with solid color** (we use `<Icon fill="currentColor" stroke="none" />` style) to match the solid-pictogram aesthetic. Color = navy or orange.

> **Flag:** This is a substitution — Hugessen's slides use Microsoft's stock icons, which are not redistributable. Document & confirm with the brand team if exact icon parity is needed.

### Logos available
| File | Use |
|---|---|
| `assets/logo-orange-on-white.jpg` | Default logo — for white/light backgrounds |
| `assets/logo-white-on-orange.png` | Inverted block — orange-block lockup |
| `assets/logo-white.png` | Knockout logo — for navy or photographic backgrounds |
| `assets/logo-white-small.png` | Small knockout (footer / corner mark) |
| `assets/hero-architecture.png` | Brand hero photo (B&W brutalist grid) |

---

## File index

```
/                                  (root)
├── README.md                      ← this file
├── SKILL.md                       ← agent-skill manifest
├── colors_and_type.css            ← all design tokens (vars) + base typography
│
├── assets/                        ← logos, hero photo
├── fonts/                         ← (placeholder; Calibri files not redistributable)
│
├── preview/                       ← Design-System-tab preview cards
│   ├── colors-primary.html
│   ├── colors-neutrals.html
│   ├── type-display.html
│   ├── type-body.html
│   ├── type-scale.html
│   ├── spacing.html
│   ├── radii-shadows.html
│   ├── buttons.html
│   ├── form-inputs.html
│   ├── cards.html
│   ├── data-table.html
│   ├── stat-callout.html
│   ├── logo-lockups.html
│   └── imagery.html
│
└── slides/                        ← Sample slides reproducing the template
    ├── index.html                 ← deck shell with all slide types
    ├── TitleSlide.jsx
    ├── SectionDividerSlide.jsx
    ├── ContentSlide.jsx
    ├── ThreeColumnSlide.jsx
    ├── DifferentiatorsSlide.jsx
    ├── WorkPlanTableSlide.jsx
    └── BigQuoteSlide.jsx
```

> **No `ui_kits/` folder** — Hugessen is not a software product. It is a consulting firm whose primary visual surface is the slide deck. The "UI kit" *is* the slide deck; see `slides/`.

---

## CAVEATS — please review

1. **Missing `.potx` template.** You referenced `Hugessen (16x9) - Timesaver Template - Oct. 2023.potx`, but only the `Introduction to Hugessen Template.pptx` was uploaded. The pptx contained a complete theme, so colors and fonts are accurate — but layout masters from the .potx may differ. **Please upload the .potx** if you'd like layout masters reproduced exactly.
2. **Calibri font files.** Calibri is Microsoft proprietary and cannot be redistributed. Web surfaces fall back to **Open Sans** (Google Fonts). For pixel-perfect web parity, please supply licensed Calibri webfonts (`.woff2`).
3. **Iconography.** We substitute **Lucide** (filled style, solid navy/orange) for the PowerPoint stock icons used in the source deck. If your team has standardized on a specific icon set, please share it.
4. **No dedicated marketing-website code or live product** was provided. The system therefore covers brand foundations + slide UI; it does not include `ui_kits/<product>` because there is no product surface to recreate. If you'd like a sample web/landing UI in the brand, ask and I'll add a `ui_kits/web/`.
5. **No people photography** has been brought in (none present in the source deck media). Real partner/team headshots should be supplied to populate "Our People" style slides accurately.

---

**Bold ask:** Please review the [color, type, and slide samples] in the Design System tab and tell me — *is this on-brand for Hugessen?* In particular: (a) does the **orange-as-accent / navy-as-structure** discipline match how the firm presents to boards, (b) is the **Open Sans → Calibri** substitution acceptable for web, and (c) should I add a **marketing website UI kit** (homepage, services, team, contact) in this same brand language?
