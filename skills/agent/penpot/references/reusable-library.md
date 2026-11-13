# Reusable library structure

Penpot guidance for design-system libraries that other files consume. Sources are listed at the end; re-check them when Penpot behavior seems to differ.

## Contents

- [Sharing mechanics](#sharing-mechanics)
- [Source of truth](#source-of-truth)
- [File split](#file-split)
- [Tokens](#tokens)
- [Components](#components)
- [Documentation and versioning](#documentation-and-versioning)
- [Sources](#sources)

## Sharing mechanics

- A library is an ordinary file published as a shared library from the file menu or the libraries panel. Consumers connect it from their libraries panel. Unpublishing disconnects every consumer; assets already used stay but lose their link.
- Components, colors, and typographies flow through the connection. Their changes wait in the consumer's Updates panel until accepted.
- Tokens flow only when the consumer chooses the library with "Set as tokens source"; a file has exactly one tokens source, its own or one library's. Consumers can apply tokens and switch themes but cannot edit, rename, or delete them. Token changes reach consumers immediately, without the Updates panel. Renaming or deleting a token leaves applied layers with stale values and a missing-token marker unless the rename remaps references.
- Token import is unavailable in a file whose tokens source is a library, so import tokens into the library file itself.

## Source of truth

- Keep one source of truth per value. When the system has tokens, apply tokens to fills, strokes, typography, radii, and spacing instead of hard-coded values.
- Do not mirror token values as library colors or library typographies. Duplicates drift, and mode-specific copies (one color per light or dark mode) contradict themes that switch the same token name. Create library colors only for values that have no token, and say so in their description.
- Generate tokens from the codebase's theme definitions rather than editing them by hand, so a theme change becomes a re-import. Penpot tokens follow the W3C Design Tokens (DTCG) format: `$value`, `$type`, `$description`; a multi-file import maps each JSON file to a set, with `$themes.json` and `$metadata.json` for themes and configuration.

## File split

- Keep library files small; large files with hundreds of components are slower and harder to maintain. Split by change rate and audience: rarely changing foundations (tokens, colors, typography) apart from frequently changing components, and a utilities library for icons and helpers when several products need them.
- Keep reference material that is not a reusable asset, such as screenshots of the implementation, audits, and explorations, in a separate unpublished file that connects to the library. Images inside the library make every consumer load them without giving designers anything to place.
- Connect libraries only where needed; a component library may connect the foundations library to reuse its tokens.

## Tokens

- Order sets by precedence: later sets override earlier ones. Build the cascade the code uses, for example base values, then mode overrides, then preset or brand overrides.
- Use theme groups for independent axes (mode, brand, density, contrast); only one theme per group is active, and groups combine. Groups avoid one theme per combination.
- Name tokens with dot paths that map to the code's variables, for example `color.primary-foreground` for `--primary-foreground`; Penpot nests dot paths in the Tokens panel. Prefer full words over shorthand.
- Use references (`{color.border}`) where the code aliases one variable to another, so overrides propagate. References are case sensitive.
- Typical tiers: global or primitive values, semantic tokens that carry meaning, and component tokens. Mirror only the tiers the source defines; do not invent primitives the code does not have.

## Components

- Main components must be on the canvas to be shared. Deleting a main component on the canvas deletes it from the library, and the reverse.
- Group by function, not appearance, with slash paths (`form/input/text`); swap menus offer same-group components first.
- Use variants when differences belong to one pattern (type, size, state). Keep property and value names consistent and keep layer names, types, and hierarchy identical across variants so overrides survive switching. Components must be on the same page to combine into variants.
- Build with flex or grid layouts, function-based layer names, and at most three or four levels of nesting. Use tokens or library assets for every fill, stroke, and text style before publishing. Annotations on main components appear on copies and in Inspect.

## Documentation and versioning

- Add a cover board of about 1390×930 showing the library name, purpose, version, and last-updated date; Penpot uses it as the file thumbnail.
- Document components on the canvas next to their main components; colors and typographies need no canvas boards, since the Assets panel shows them.
- For breaking changes, put a version in the file name and publish it as a new library so existing consumers do not receive the change through Updates.

## Sources

- [Libraries](https://help.penpot.app/user-guide/design-systems/libraries/)
- [Design tokens](https://help.penpot.app/user-guide/design-systems/design-tokens/)
- [Components](https://help.penpot.app/user-guide/design-systems/components/)
- [Variants](https://help.penpot.app/user-guide/design-systems/variants/)
- [Design file structure and best practices](https://help.penpot.app/mcp/design-file-structure-best-practices/)
- [Design systems best practices with Penpot](https://penpot.app/blog/design-systems-best-practices-with-penpot/)
