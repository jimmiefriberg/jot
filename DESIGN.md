---
name: Jot
description: A clean, theme-driven frame for notes and data files; the document is the page.
colors:
  background: "#ffffff"
  foreground: "#1f2328"
  muted-foreground: "#6e7781"
  surface: "#f5f6f8"
  border: "#e4e7eb"
  accent: "#2f6fde"
  selection: "#cfe0ff"
  active-line: "#f6f8fb"
  cursor: "#2f6fde"
  gutter-background: "#ffffff"
  gutter-foreground: "#b0b7c0"
  heading: "#1f2328"
  link: "#2f6fde"
  string: "#0a7d4f"
  number: "#b35900"
  keyword: "#a626a4"
  property: "#1d5fb8"
  comment: "#8a929b"
  punctuation: "#6e7781"
  danger: "#d1242f"
  hover: "color-mix(in srgb, #1f2328 7%, transparent)"
  pressed: "color-mix(in srgb, #1f2328 12%, transparent)"
  accent-soft: "color-mix(in srgb, #2f6fde 16%, transparent)"
  accent-strong: "color-mix(in srgb, #2f6fde 28%, transparent)"
  chrome: "color-mix(in srgb, #f5f6f8 65%, #ffffff)"
  control: "color-mix(in srgb, #1f2328 5%, #ffffff)"
  subtle-border: "color-mix(in srgb, #e4e7eb 75%, transparent)"
typography:
  headline:
    fontFamily: "-apple-system, system-ui, 'Helvetica Neue', sans-serif"
    fontSize: "2em"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, system-ui, 'Helvetica Neue', sans-serif"
    fontSize: "1.5em"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, system-ui, 'Helvetica Neue', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  code:
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "-apple-system, system-ui, 'Helvetica Neue', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "-apple-system, system-ui, 'Helvetica Neue', sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  small: "5px"
  medium: "7px"
  large: "10px"
  extra-large: "14px"
  pill: "999px"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button:
    backgroundColor: "{colors.control}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.medium}"
    padding: "3px 10px"
  button-hover:
    backgroundColor: "{colors.hover}"
  button-active:
    backgroundColor: "{colors.pressed}"
  button-danger:
    backgroundColor: "{colors.control}"
    textColor: "{colors.danger}"
    rounded: "{rounded.medium}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.medium}"
    size: "26px"
  icon-button-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.foreground}"
  text-input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.medium}"
    padding: "4px 8px"
  segmented-control:
    backgroundColor: "{colors.hover}"
    rounded: "{rounded.medium}"
    padding: "2px"
  segmented-control-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.small}"
  switch:
    backgroundColor: "{colors.pressed}"
    rounded: "{rounded.pill}"
    width: "36px"
    height: "22px"
  switch-on:
    backgroundColor: "{colors.accent}"
  status-bar:
    backgroundColor: "{colors.chrome}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    height: "30px"
    padding: "0 8px"
  setting-group:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.large}"
    padding: "8px 14px"
  list-row-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    rounded: "{rounded.medium}"
    padding: "6px 10px"
  popover:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.extra-large}"
    width: "580px"
---

# Design System: Jot

## Overview

**Creative North Star: "The Clean Sheet"**

Jot is a sheet of paper with the app barely around it. The document fills the window and the chrome (a status bar, an optional sidebar and a toolbar over tree and table views) sits at the edges in small type and softly tinted greys. Nothing in the frame competes with the text, and when there's nothing to do the interface keeps quiet.

Colour belongs to the user, not to Jot. Every colour comes from the active theme: 21 built-in themes modelled on the most popular editor and terminal themes (Paper and Ink are the defaults, alongside GitHub, Tokyo Night, Catppuccin, Dracula, Nord, Solarized, Gruvbox, Rosé Pine and more), plus the user's own duplicates. So Jot's identity lives in **structure**: spacing, type sizes, corner radii, the flat-and-tonal depth model, and the way hover and selection states are *derived* from whatever theme is applied. A design that only looks right in Paper is broken.

The window content is platform-neutral. It renders the same on macOS and Linux and relies only on native menus, tabs and dialogs for platform behaviour.

**Key Characteristics:**
- Simple and clean. The document leads and the chrome is small, tinted and quiet.
- Theme-driven. Components use theme roles only, and state colours are mixed from them.
- Flat and tonal. Depth comes from tinted surfaces and 1px borders, and shadows are rare.
- Three fonts with three jobs: the UI font for chrome, the editor font for code and plain text, the writing font for prose.
- Controls are quiet and are moving toward roomier. Today they are compact (11–13px), and new work should give them more padding and larger hit targets.

## Colors

Each colour is a **role** that every theme fills in. The values above are from Paper, the default light theme; the dark default, Ink, and the other 19 presets live in `src/lib/settings/theme-presets.ts` and are written to `--color-*` custom properties on `:root` at runtime.

### Primary
- **Theme Accent** (`accent`): focus rings, the active Settings tab, a switched-on switch, the highlighted Quick Open result, matched characters in search, the active status-bar toggle. It's the only "brand" colour, and the theme supplies it.
- **Link** (`link`) and **Cursor** (`cursor`): usually the same hue as the accent, but separate roles so a theme can split them.

### Neutral
- **Page** (`background`): the document surface, inputs and raised selections (the active segment sits on the page colour).
- **Ink** (`foreground`) and **Heading** (`heading`): body text and Markdown headings.
- **Quiet Ink** (`muted-foreground`): status bar text, descriptions, inactive tabs, placeholder text, icon buttons at rest.
- **Surface** (`surface`): code blocks and other recessed areas, and the base of the chrome mix.
- **Rule** (`border`) and **Soft Rule** (`subtle-border`): 1px dividers. The soft rule is the default between chrome regions and rows.
- **Chrome** (`chrome`): the status bar, sidebar and Settings window background, a 65% mix of surface into page.
- **Editor roles** (`selection`, `active-line`, `gutter-background`, `gutter-foreground`): CodeMirror only.

### Syntax roles
`string`, `number`, `keyword` (booleans and null), `property` (keys), `comment` and `punctuation` colour CodeMirror highlighting *and* the JSON, YAML and XML trees, so a value looks the same in both views. `number` also doubles as the warning colour (for example the "Not UTF-8" badge).

### Fixed colours
- **Danger** (`danger`, `#d1242f` light / `#ff7b72` dark): destructive buttons only. This is one of the few colours that's not part of the theme.
- A small set of other non-theme values exist on purpose: the white switch knob and the translucent yellow `==highlight==` in Markdown. Don't add more.

### Named Rules
**The Theme Owns Colour Rule.** Components never hard-code a hex value. They use `var(--color-*)` roles, so every one of the 21+ themes (and any custom theme) works without a special case.

**The Derived State Rule.** Hover, pressed, soft-accent and control fills are `color-mix()` blends of the theme's own foreground, accent and surface (hover 7%, pressed 12%, control 5%, accent-soft 16%, accent-strong 28%). Never pick a separate hover colour per theme.

## Typography

**UI Font:** the system UI font (`-apple-system, system-ui, 'Helvetica Neue', sans-serif`)
**Editor Font:** user-chosen. The default is SF Mono, falling back to `ui-monospace, Menlo, monospace`. JetBrains Mono and Fira Code are bundled.
**Writing Font:** user-chosen for Markdown prose. The default is System; Inter and Source Serif 4 are bundled, and any monospace font is allowed for a typewriter look.

**Character:** a neutral system face for the chrome, so the app feels at home on any OS, with the document's fonts handed over to the user. The UI type is small and calm. The document type is sized for reading.

### Hierarchy
- **Headline** (650, 2em, line-height 1.25, −0.02em): Markdown H1, with a soft rule underneath.
- **Title** (650, 1.5em, line-height 1.25, −0.01em): Markdown H2, also ruled. H3 is 1.25em and H4 is 1em, at the same weight.
- **Body** (400, the editor font size + 2px, so 16px by default, line-height 1.6): Markdown prose in the writing font, in a centred column up to 760px wide.
- **Code** (400, 14px by default, line-height 1.6): plain view and code. Code blocks inside prose drop to 0.85em with line-height 1.5.
- **UI** (400, 13px): sidebar rows, Settings labels and buttons. Dialog search fields go up to 16px (Quick Open).
- **Label** (400–500, 11–12.5px, tabular numbers): status bar (11.5px), setting descriptions, segmented controls (11px), toolbar controls (12px). Settings group headings are 12px at weight 600 in the muted colour.

### Named Rules
**The Three Fonts Rule.** The UI font is only for chrome, the editor font is for code and plain text, and the writing font is for Markdown prose. Never put the UI font inside the document, or a document font in the chrome.

**The User Sizes the Document Rule.** Document type scales from the user's `--font-size` and `--line-height` settings (and per-window zoom). Chrome type stays fixed in px.

## Layout

The window is a column: the document area fills the space, with a 30px status bar along the bottom. A resizable sidebar (files and outline) can dock on the left or the right, and its border and resize handle always face the document. Tree and table views put a sticky toolbar on top (padding 8px 12px, 88% page colour with a 12px backdrop blur, and a soft rule underneath).

- **Markdown:** a centred reading column of up to 760px, with 32px side padding and 40vh of space below the last line, so the end of a note can be scrolled up to eye level.
- **Plain view:** full width by default, with an optional text width of 60–120 characters as a centred column.
- **Settings:** content groups up to 640px wide, centred, with 24px between groups. Rows are at least 44px tall with 8px 14px padding.
- **Quick Open:** a 580px panel (never wider than the window minus 32px), sitting 12vh from the top.
- **Rhythm:** tight in the chrome (2–12px gaps, mostly 4, 8 and 12) and generous in the document. There's no spacing token scale in the CSS; the frontmatter `spacing` lists the values that actually recur.

## Elevation & Depth

Flat and tonal. Surfaces are flat at rest and separated by tint (page, then chrome, then surface) and by 1px soft rules. Shadows appear in only three places, and dark themes use deeper shadows (0.4–0.5 alpha) so they still read.

### Shadow Vocabulary
- **Raised** (`0 1px 2px rgb(0 0 0 / 0.08), 0 0 0 0.5px rgb(0 0 0 / 0.06)`): the active segment of a segmented control or the sidebar tabs, and Settings group cards.
- **Popover** (`0 18px 50px rgb(0 0 0 / 0.22), 0 4px 12px rgb(0 0 0 / 0.08), 0 0 0 1px border`): Quick Open, over an 18% black backdrop.
- **Knob** (`0 1px 2px rgb(0 0 0 / 0.25)`): the switch knob only.

### Named Rules
**The Three Shadows Rule.** Raised for a selection or a grouped card, popover for something floating over the document, knob for the switch. Anything else is separated by tint and a 1px soft rule, never by a new shadow.

## Shapes

Corners are gently rounded on a four-step scale: small (5px) for chips, segments, tree rows and `kbd`; medium (7px) for buttons, inputs, icon buttons and list rows; large (10px) for Settings cards and tabs; extra-large (14px) for the Quick Open popover. Pills (999px) are only for switches. Code blocks in Markdown use 8px corners on their first and last lines. Borders are always 1px; focus is a 2px accent outline or a 3px soft-accent glow, never a thicker stroke.

## Components

### Buttons
- **Character:** quiet. A faint tint of the text colour, not a filled accent block.
- **Shape:** medium radius (7px) with a 1px soft-rule border.
- **Default:** control fill (5% foreground on page) with foreground text, padding 3px 10px. This compact size is for toolbars. In the Settings window, text fields, number fields and buttons are at least 30px tall with padding 5px 10px. Native dropdowns keep WebKit's own height.
- **Hover / Pressed:** the fill moves to hover (7%), then pressed (12%), over 120ms. Disabled drops to 0.4 opacity.
- **Focus:** a 2px accent outline, offset by 1px.
- **Danger:** the same button with danger-coloured text. There is no filled red button.
- **Icon button:** 26×26px, transparent and muted at rest. On hover it gets the hover fill and the full foreground colour. Status-bar icon buttons are 24×22px and turn accent on a soft-accent fill when active.

### Inputs / Fields
- **Style:** page background, 1px rule border, medium radius, padding 4px 8px.
- **Focus:** the border turns accent, plus a 3px soft-accent ring.
- **Search fields** (toolbar filter, Quick Open): a borderless field on the hover tint. On focus it turns to the page colour with a 1px accent ring and a 4px soft-accent halo. Match counts use tabular numbers.

### Segmented control and tabs
A hover-tinted track (2px padding, 2px gap) holding transparent, muted segments. The active segment sits on the page colour with the *raised* shadow. The same pattern drives the Formatted/Plain switch, the sidebar's Files/Outline tabs and the Settings choices. The Settings window's top tabs are icon-over-label buttons: muted at rest, and accent on a hover tint when active.

### Switch
A 36×22px pill in the pressed tint, with an 18px white knob. When on, it fills with the accent and the knob slides 14px over 160ms.

### Lists and rows
- **Quick Open results:** medium radius, padding 6px 10px. The active row inverts to a full accent fill with page-coloured text (the one place the accent is used as a fill). Matched characters are accent and bold, and underlined in the active row.
- **Tree rows** (JSON, YAML, XML, files): small radius with the hover tint, values coloured by syntax role. A selected row gets the soft accent, and a search match gets a 16% tint of the `number` colour.
- **CSV table:** cells with padding 6px 9px and soft-rule grid lines. The sticky header row is bold (650) on the page colour, with a full rule underneath. Selected cells mix the selection colour into the page colour and add a 1px inset accent line. The cell being edited gets a 2px inset accent outline.

### Settings group
Rows on a page-coloured card (large radius, raised shadow) set on the chrome background, with soft rules between rows. Group headings are 12px, weight 600, muted, outside the card.

The Settings window's layout (icon-over-label toolbar tabs, grouped cards, switches on the right, in the style of System Settings) is a deliberate choice, confirmed on 2026-10-10. Refine it inside this layout; don't propose replacing it. Revisit it once the Linux build is close.

### Status bar (signature)
A 30px chrome strip with a soft top rule and 11.5px muted tabular text. The document kind looks like a label but is a menu (500 weight, hover tint). Warnings use the theme's `number` colour.

### Markdown live preview (signature)
The editor itself, styled as a document after GitHub's rendering: ruled H1 and H2 headings, rounded code blocks on the surface colour, zebra-striped tables, list markers that change with depth (• ◦ ▪), and quotes and GitHub alerts marked with a 3px left rule (alerts are tinted with their alert colour). Markup outside the cursor collapses to zero width, so the page reads like a rendered document.

## Do's and Don'ts

### Do:
- **Do** take every colour from a theme role (`var(--color-*)`), and derive state colours with `color-mix()` from foreground, accent and surface (The Derived State Rule).
- **Do** check new UI in at least Paper, Ink and one strongly coloured theme (such as Dracula or Solarized). A theme is a first-class use case, not a skin.
- **Do** keep the accent for focus, selection, active state and links. The Quick Open active row is the only place it's a full fill.
- **Do** separate regions with tint (page → chrome → surface) and 1px soft rules.
- **Do** follow *quiet but roomier* for forms and settings: fields and buttons at least 30px tall, large segmented buttons at least 28px, a 36×22px switch, and labels and descriptions at 12–13px. Toolbars and the status bar stay compact.
- **Do** keep chrome type in fixed px (11–13px, tabular numbers for counts) and let document type follow the user's font size and zoom.
- **Do** keep the window content the same on macOS and Linux. Use system font stacks and nothing that only exists on one platform.

### Don't:
- **Don't** hard-code a hex colour in a component. The only fixed colours are danger, the white switch knob and the Markdown highlight yellow.
- **Don't** add shadows beyond raised, popover and knob (The Three Shadows Rule).
- **Don't** design for one theme. If it only works in Paper, it's broken.
- **Don't** use the UI font inside the document, or a document font in the chrome (The Three Fonts Rule).
- **Don't** fill buttons with the accent colour. Buttons are tinted and the accent marks state.
