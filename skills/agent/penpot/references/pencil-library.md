# Pencil library organization

Captured from a copy of Penpot's public "Pencil | Penpot Design System" file. Upstream may have changed; when the reference file is connected, re-read it and prefer what it shows.

## Contents

- [Pages](#pages)
- [Showcase and spec boards](#showcase-and-spec-boards)
- [Colors](#colors)
- [Typographies](#typographies)
- [Components](#components)
- [Tokens](#tokens)

## Pages

Pages in order:

1. `COVER`: one 900×600 `Cover` board.
2. `Getting started (you can delete this)`: an onboarding board.
3. One page per component family, named `↳ <Family>` and sorted alphabetically: `↳ Accordion`, `↳ Assets`, `↳ Avatar`, `↳ Badge`, `↳ Button`, `↳ Button group`, `↳ Color Input`, `↳ Colorpicker`, `↳ Combo button`, `↳ Combobox`, `↳ Component`, `↳ Empty state`, `↳ Floating elements`, `↳ Folders`, `↳ Font selector`, `↳ Form elements`, `↳ Input`, `↳ Layers`, `↳ Menu`, `↳ Notifications`, `↳ Pages`, `↳ Pagination`, `↳ Pills`, `↳ Project Header`, `↳ Search`, `↳ Select`, `↳ Style`, `↳ Tabs`, `↳ Text area`, `↳ Title`.
4. `_Utilities`: main components for internal building blocks (measure markers, status icons, scrollbars, progress bar, header, specs, TODO).
5. `___`: an empty separator page.
6. Application screen compositions: `Workspace`, `Workspace Layers Tab`, `Workspace Assets Tab`, `Workspace Design Tab`, `Workspace Prototype Tab`, `Workspace Inspect Tab`.
7. `Main components`: main instances of icons and other small shared components, kept off the documentation pages.

Some source page names carry a doubled space after the arrow (`↳  Color Input`); do not copy that.

## Showcase and spec boards

A component page holds one or more showcase boards named after the family or type (`Button`, `Checkboxes`, `Radiobuttons`), and beside each a `_Utilities / Specs` board.

Showcase board (`Button` example):

- Board with a vertical flex layout, row gap 2, no fill.
- First child: a `_Utilities / Header` instance (vertical flex) containing a `_Utilities / Status / <Done|In progress|Needs review>` badge and a `DS Utilities / Heading` block.
- Then one board per type (`Button Primary`, `Button Secondary`, `Button Ghost`, `Button Destructive`), each a vertical flex layout with gap 16 containing:
  - a text label holding the component path, such as `Dark / Button / Primary / ...`;
  - a board holding instances of every variant and state.

Spec board (`_Utilities / Specs`, about 631 wide), vertical flex:

- `title` row containing the text `DESIGN SPECS`.
- `content` column with gap 24, containing a `title` text and these sections, each a small board: `general description`, `usage`, `interaction`, `Types`, `Variants`, `props`, `dependencies`.

## Colors

34 library colors, grouped by role and then mode. Group paths use ` / `. Names are dotted token-style identifiers with a mode prefix: `l.` light, `d.` dark, and `component.` for component-specific colors.

| Group path | Names |
| --- | --- |
| `Background / Light` | `l.color.background.primary`, `.secondary`, `.tertiary`, `.quaternary` |
| `Background / Dark` | `d.color.background.primary`, `.secondary`, `.tertiary`, `.quaternary` |
| `Foreground` | `d.color.foreground.primary`, `d.color.foreground.secondary`, `l.color.foreground.secondary` |
| `Accent / Light` | `l.color.accent.primary`, `.secondary`, `.tertiary`, `.quaternary` |
| `Accent / Dark` | `d.color.accent.primary`, `d.color.accent.primary.muted`, `.secondary`, `.tertiary`, `.quaternary` |
| `Status colors / Error` | `d.color.accent.error`, `d.color.background.error`, `l.color.accent.error`, `l.color.background.error` |
| `Status colors / Success` | `d.color.accent.success`, `d.color.background.success` |
| `Status colors / Warning` | `d.color.accent.warning`, `d.color.background.warning` |
| `Status colors / Info` | `d.color.accent.info`, `d.color.background.info` |
| `Avatar colors` | `component.avatar.mauve`, `component.avatar.orange`, `component.avatar.pink` |

Ordinal suffixes (`primary` to `quaternary`) rank surfaces and accents rather than describing hue. All captured colors use opacity 1. Known source defects: `l.color.accent.primary` appears twice with different values, and one dark accent is misspelled `d..color.accent.quaternary`.

## Typographies

Seven typographies at the library root (no group path), all Work Sans with letter spacing 0 and no stored line height:

| Name | Size | Weight | Transform |
| --- | --- | --- | --- |
| `Display` | 36 | 400 | none |
| `Title L` | 24 | 400 | none |
| `Headline M` | 16 | 400 | uppercase |
| `Headline S` | 12 | 500 | uppercase |
| `Body L` | 16 | 400 | none |
| `Body M` | 14 | 400 | none |
| `Body S` | 12 | 400 | none |

Names follow `<Role> <Size>` with roles Display, Title, Headline, and Body and sizes L, M, S.

## Components

About 724 components, named by path with the last segment as the variant or state:

- `<Mode> / <Family> / [<Type> / [<Content>]] / <State>` for UI components. Only `Dark` exists in the captured file. Examples: `Dark / Button / Primary / Icon + Text / Hover`, `Dark / Input / Error`, `Dark / Notifications / Toast / Warning`.
- States use a fixed vocabulary: `Default`, `Hover`, `Focus`, `Active`, `Disabled`, `Selected`, `Rename`, `Drag`, plus validation states `Error`, `Success`, `Empty`. Disclosure states are `Collapsed` and `Expanded`.
- Content variants of one type are a path level: `Icon`, `Text`, `Icon + Text`.
- Composite application parts nest under `Dark / Workspace / <Area> / <Block>`.
- `Icons / <Category> / [<Size>] / <Name>` for icons, 16×16, with sizes `S` and `M` as a path level or name suffix. Categories include `Actions`, `Align`, `App`, `Arrows`, `Booleans`, `Characters`, `Colorpicker`, `Filter`, `Layout / Flex / …`, `Margin`, `Padding`, `Prototype`, `Text`, and `Tools + Layers`.
- `_Utilities / …` for internal building blocks reused by components or documentation (selectors, swatches, tabs, menu items, measures, header, specs). The leading underscore sorts them last and marks them as not for direct use.
- `Brand / <Mode> / <Logo>` for logos and `DS Utilities / …` for documentation helpers.

## Tokens

The captured file defines no design token sets or themes; the organization relies on library colors and typographies.
