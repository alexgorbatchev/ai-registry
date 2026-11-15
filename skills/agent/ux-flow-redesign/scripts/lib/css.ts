// Tiny CSS reader for lint checks: yields every style rule with its selector, enclosing at-rules and declarations,
// keeping source line numbers. It understands comments, nested at-rule blocks and quoted strings; it does not
// evaluate the cascade.

export interface CssDeclaration {
  property: string;
  value: string;
  line: number;
}

export interface CssRule {
  selector: string;
  /** Enclosing at-rule preludes, outermost first, for example ["@media (max-width: 900px)"]. */
  atRules: string[];
  declarations: CssDeclaration[];
  line: number;
}

/** Replaces comments with spaces of the same length so offsets and line numbers stay valid. */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

function lineCounter(text: string, firstLine: number): (offset: number) => number {
  const starts = [0];
  for (let index = 0; index < text.length; index++) if (text[index] === "\n") starts.push(index + 1);
  return (offset) => {
    let line = 0;
    while (line + 1 < starts.length && starts[line + 1] <= offset) line++;
    return firstLine + line;
  };
}

function parseDeclarations(body: string, bodyOffset: number, lineOf: (offset: number) => number): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  let start = 0;
  let quote: string | null = null;
  const flush = (end: number) => {
    const text = body.slice(start, end);
    const colon = text.indexOf(":");
    if (colon > 0) {
      const leading = text.length - text.trimStart().length;
      declarations.push({
        property: text.slice(0, colon).trim().toLowerCase(),
        value: text.slice(colon + 1).trim(),
        line: lineOf(bodyOffset + start + leading),
      });
    }
    start = end + 1;
  };
  for (let index = 0; index < body.length; index++) {
    const character = body[index];
    if (quote) {
      if (character === quote && body[index - 1] !== "\\") quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === ";") flush(index);
  }
  flush(body.length);
  return declarations;
}

/** Reads every style rule in a stylesheet or a style attribute wrapped as `{...}`. */
export function readCssRules(css: string, firstLine = 1): CssRule[] {
  const text = stripCssComments(css);
  const lineOf = lineCounter(text, firstLine);
  const rules: CssRule[] = [];

  const readBlock = (from: number, atRules: string[]): number => {
    let preludeStart = from;
    let index = from;
    let quote: string | null = null;
    while (index < text.length) {
      const character = text[index];
      if (quote) {
        if (character === quote && text[index - 1] !== "\\") quote = null;
        index++;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        index++;
        continue;
      }
      if (character === "}") return index + 1;
      if (character === ";") {
        preludeStart = index + 1;
        index++;
        continue;
      }
      if (character === "{") {
        const prelude = text.slice(preludeStart, index).trim();
        const preludeLine = lineOf(
          preludeStart + (text.slice(preludeStart, index).length - text.slice(preludeStart, index).trimStart().length),
        );
        if (prelude.startsWith("@")) {
          index = readBlock(index + 1, [...atRules, prelude]);
        } else {
          let end = index + 1;
          let bodyQuote: string | null = null;
          while (end < text.length && (bodyQuote || text[end] !== "}")) {
            if (bodyQuote) {
              if (text[end] === bodyQuote && text[end - 1] !== "\\") bodyQuote = null;
            } else if (text[end] === '"' || text[end] === "'") bodyQuote = text[end];
            end++;
          }
          rules.push({
            selector: prelude,
            atRules,
            declarations: parseDeclarations(text.slice(index + 1, end), index + 1, lineOf),
            line: preludeLine,
          });
          index = end + 1;
        }
        preludeStart = index;
        continue;
      }
      index++;
    }
    return index;
  };

  readBlock(0, []);
  return rules;
}

/** Custom properties a stylesheet declares in top-level `:root` rules, outside any at-rule. */
export function rootTokens(rules: CssRule[]): Set<string> {
  const tokens = new Set<string>();
  for (const rule of rules) {
    if (rule.atRules.length || !rule.selector.split(",").some((part) => part.trim() === ":root")) continue;
    for (const declaration of rule.declarations)
      if (declaration.property.startsWith("--")) tokens.add(declaration.property);
  }
  return tokens;
}
