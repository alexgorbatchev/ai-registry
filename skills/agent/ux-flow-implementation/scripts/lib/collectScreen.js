// In-page collector for audit-screen.ts. The CLI evaluates this file in the page with the default options in
// its last line replaced, and analyses the returned records in Bun (lib/auditScreen.ts).
// Colors are resolved by painting them on a 1x1 canvas, so every CSS color space (oklch, lab, color())
// and every alpha value composites the way the browser paints it, against the page's real backdrop.
((options) => {
  const ignore = options.ignore ?? [];
  const contentSelector = options.content ?? null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  const pixel = () => context.getImageData(0, 0, 1, 1).data;
  const alphaOf = (color) => {
    context.globalAlpha = 1;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "#000";
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return pixel()[3] / 255;
  };
  // Paints layers bottom to top and returns the resulting opaque sRGB color.
  const paint = (layers) => {
    context.globalAlpha = 1;
    context.clearRect(0, 0, 1, 1);
    for (const layer of layers) {
      if (layer.alpha <= 0) continue;
      context.globalAlpha = Math.min(1, layer.alpha);
      context.fillStyle = "#000";
      context.fillStyle = layer.color;
      context.fillRect(0, 0, 1, 1);
    }
    const data = pixel();
    return [data[0], data[1], data[2]];
  };

  // The canvas color behind the root, which follows the root's color-scheme.
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;width:0;height:0;background:Canvas";
  document.documentElement.append(probe);
  const backdrop = { color: getComputedStyle(probe).backgroundColor, alpha: 1 };
  probe.remove();

  const styles = new Map();
  const styleOf = (element) => {
    let style = styles.get(element);
    if (!style) {
      style = getComputedStyle(element);
      styles.set(element, style);
    }
    return style;
  };
  const opacities = new Map();
  const opacityOf = (element) => {
    if (!element || element.nodeType !== 1) return 1;
    let value = opacities.get(element);
    if (value === undefined) {
      value = Number(styleOf(element).opacity) * opacityOf(element.parentElement);
      opacities.set(element, value);
    }
    return value;
  };

  // Background layers from `element` up to the root, bottom first. Unresolved when an image, filter or blend
  // mode shows through, because its color under the text cannot be read from styles.
  const stackOf = (element) => {
    const layers = [];
    let unresolved = false;
    for (let current = element; current && current.nodeType === 1; current = current.parentElement) {
      const style = styleOf(current);
      const opacity = opacityOf(current);
      if (
        style.backgroundImage !== "none" ||
        style.filter !== "none" ||
        (style.backdropFilter ?? "none") !== "none" ||
        style.mixBlendMode !== "normal"
      ) {
        unresolved = true;
        break;
      }
      const alpha = alphaOf(style.backgroundColor) * opacity;
      if (alpha > 0) layers.unshift({ color: style.backgroundColor, alpha: opacity });
      if (alpha >= 1) return { layers, unresolved: false };
    }
    return { layers: [backdrop, ...layers], unresolved };
  };

  const selectorOf = (element) => {
    const parts = [];
    for (
      let current = element;
      current && current.nodeType === 1 && parts.length < 5;
      current = current.parentElement
    ) {
      if (current.id) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      let part = current.tagName.toLowerCase();
      const testId = current.getAttribute("data-testid");
      if (testId) part += `[data-testid="${testId}"]`;
      else if (current.parentElement) {
        const same = [...current.parentElement.children].filter((child) => child.tagName === current.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(current) + 1})`;
      }
      parts.unshift(part);
    }
    return parts.join(" > ");
  };

  const ignored = (element) => ignore.some((selector) => element.closest(selector));
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return false;
    if (element.checkVisibility) return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    return styleOf(element).visibility === "visible" && opacityOf(element) > 0;
  };
  const disabled = (element) => Boolean(element.closest(':disabled, [aria-disabled="true"]'));
  const box = (rect) => ({
    x: Math.round(rect.left * 10) / 10,
    y: Math.round(rect.top * 10) / 10,
    width: Math.round(rect.width * 10) / 10,
    height: Math.round(rect.height * 10) / 10,
  });
  const clip = (text) => text.replace(/\s+/g, " ").trim().slice(0, 60);

  const elements = [...document.body.querySelectorAll("*")].filter(
    (element) => !element.closest("svg, script, style, noscript, template") && !ignored(element),
  );

  const texts = [];
  for (const element of elements) {
    const own = [...element.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent)
      .join(" ");
    if (!own.trim() || !visible(element) || disabled(element)) continue;
    const style = styleOf(element);
    const stack = stackOf(element);
    const background = paint(stack.layers);
    const foreground = paint([...stack.layers, { color: style.color, alpha: opacityOf(element) }]);
    texts.push({
      selector: selectorOf(element),
      text: clip(own),
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: Number(style.fontWeight) || 400,
      foreground,
      background: stack.unresolved ? null : background,
    });
  }

  const CONTROL =
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"], [role="combobox"], [role="slider"], [tabindex]:not([tabindex="-1"])';
  const kindOf = (element) => {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const type = (element.getAttribute("type") ?? "text").toLowerCase();
    if (["checkbox", "radio", "switch", "slider"].includes(role)) return "toggle";
    if (tag === "input" && ["checkbox", "radio", "range", "color", "file"].includes(type)) return "toggle";
    if (role === "button" || tag === "button" || tag === "summary") return "action";
    if (tag === "input" && ["button", "submit", "reset", "image"].includes(type)) return "action";
    if (tag === "input" || tag === "select" || tag === "textarea" || role === "combobox") return "field";
    if (tag === "a" || role === "link") return "link";
    return "other";
  };
  const SIDES = ["Top", "Right", "Bottom", "Left"];
  // An icon drawn by an element (svg, img) or by a pseudo-element's background or mask image.
  const pseudoIcon = (element, which) => {
    const style = getComputedStyle(element, which);
    if (style.content === "none" || style.content === "normal") return false;
    return [style.backgroundImage, style.maskImage, style.webkitMaskImage].some((image) => image && image !== "none");
  };
  const hasIcon = (element) =>
    Boolean(element.querySelector('svg, img, picture, canvas, [role="img"]')) ||
    [element, ...element.querySelectorAll("*")].some(
      (node) => pseudoIcon(node, "::before") || pseudoIcon(node, "::after"),
    );

  const found = elements.filter((element) => element.matches(CONTROL) && visible(element));
  // A focusable container (a listbox, a scrolling region) is not a control when it holds controls.
  const controls = found.filter(
    (element) => kindOf(element) !== "other" || !found.some((other) => other !== element && element.contains(other)),
  );
  const grouped = controls.filter((element) => ["action", "field"].includes(kindOf(element)));
  const groupIds = new Map();
  const groupOf = (element) => {
    for (let parent = element.parentElement, depth = 0; parent && depth < 6; parent = parent.parentElement, depth++) {
      if (parent === document.body) return null;
      const members = grouped.filter((other) => parent.contains(other)).length;
      if (members >= 2) {
        if (!groupIds.has(parent)) groupIds.set(parent, groupIds.size + 1);
        return groupIds.get(parent);
      }
    }
    return null;
  };

  const controlRecords = controls.map((element) => {
    const style = styleOf(element);
    const kind = kindOf(element);
    const opacity = opacityOf(element);
    const outsideStack = stackOf(element.parentElement);
    const outside = paint(outsideStack.layers);
    const fillAlpha = alphaOf(style.backgroundColor) * opacity;
    const fillLayers = fillAlpha > 0 ? [{ color: style.backgroundColor, alpha: opacity }] : [];
    const fill = fillAlpha > 0 ? paint([...outsideStack.layers, ...fillLayers]) : null;
    const borders = [];
    for (const side of SIDES) {
      const width = Number.parseFloat(style[`border${side}Width`]);
      const lineStyle = style[`border${side}Style`];
      const color = style[`border${side}Color`];
      if (width > 0 && lineStyle !== "none" && lineStyle !== "hidden" && alphaOf(color) > 0) {
        borders.push(paint([...outsideStack.layers, ...fillLayers, { color, alpha: opacity }]));
      }
    }
    const parentText = element.parentElement?.textContent?.trim().length ?? 0;
    return {
      selector: selectorOf(element),
      label: clip(
        element.getAttribute("aria-label") ||
          element.textContent ||
          element.getAttribute("title") ||
          element.getAttribute("placeholder") ||
          element.value ||
          "",
      ),
      kind,
      rect: box(element.getBoundingClientRect()),
      group: kind === "action" || kind === "field" ? groupOf(element) : null,
      disabled: disabled(element),
      inlineText: style.display === "inline" && parentText > (element.textContent?.trim().length ?? 0),
      nativeAppearance: element.tagName === "INPUT" && kind === "toggle" && style.appearance !== "none",
      hasText: String(element.innerText || element.value || "").trim() !== "",
      hasIcon: hasIcon(element),
      outside: outsideStack.unresolved ? null : outside,
      fill,
      borders,
    };
  });

  const clientWidth = document.documentElement.clientWidth;
  const clipsX = (element) => {
    for (
      let parent = element.parentElement;
      parent && parent !== document.documentElement;
      parent = parent.parentElement
    ) {
      if (styleOf(parent).overflowX !== "visible") return true;
    }
    return false;
  };
  const reported = new Set();
  const overflowing = [];
  for (const element of elements) {
    if (overflowing.length >= 50) break;
    const rect = element.getBoundingClientRect();
    if (rect.right <= clientWidth + 1 && rect.left >= -1) continue;
    if (!visible(element) || styleOf(element).position === "fixed" || clipsX(element)) continue;
    if ([...reported].some((parent) => parent.contains(element))) continue;
    reported.add(element);
    overflowing.push({ selector: selectorOf(element), text: clip(element.textContent ?? ""), rect: box(rect) });
  }

  // Density: the content root (the content option's element, else main, else the body without its landmarks), the
  // first control or heading in it, and the horizontal extents of everything it paints, so empty bands can be measured.
  const CHROME =
    'header, nav, aside, footer, [role="banner"], [role="navigation"], [role="complementary"], [role="contentinfo"]';
  const root =
    (contentSelector && document.querySelector(contentSelector)) ||
    [...document.querySelectorAll('main, [role="main"]')].find((element) => visible(element)) ||
    document.body;
  const rootRect = root.getBoundingClientRect();
  // Fixed elements (toasts, floating dev tools, dialogs) float over the layout instead of taking space in it.
  const floats = (element) => {
    for (let current = element; current && current !== root; current = current.parentElement)
      if (styleOf(current).position === "fixed") return true;
    return false;
  };
  const inRoot = elements.filter(
    (element) =>
      element !== root &&
      root.contains(element) &&
      (root !== document.body || !element.closest(CHROME)) &&
      !floats(element),
  );
  const controlSet = new Set(controls);
  const HEADING = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
  let first = null;
  for (const element of inRoot) {
    if (!(element.matches(HEADING) || controlSet.has(element)) || !visible(element)) continue;
    const top = element.getBoundingClientRect().top + scrollY;
    if (!first || top < first.top) first = { element, top };
  }
  const MEDIA = 'img, svg, video, canvas, picture, iframe, [role="img"]';
  const extents = [];
  const range = document.createRange();
  for (const element of inRoot) {
    if (!visible(element)) continue;
    const style = styleOf(element);
    const rect = element.getBoundingClientRect();
    const paintsBox =
      alphaOf(style.backgroundColor) > 0 ||
      SIDES.some(
        (side) =>
          Number.parseFloat(style[`border${side}Width`]) > 0 &&
          !["none", "hidden"].includes(style[`border${side}Style`]),
      );
    if (element.matches(MEDIA) || controlSet.has(element) || (paintsBox && rect.width < rootRect.width * 0.95)) {
      extents.push([rect.left, rect.right]);
      continue;
    }
    for (const node of element.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      range.selectNodeContents(node);
      const ink = range.getBoundingClientRect();
      if (ink.width > 0 && ink.height > 0) extents.push([ink.left, ink.right]);
    }
  }
  const tenth = (value) => Math.round(value * 10) / 10;
  const content = {
    root: { selector: root === document.body ? "body" : selectorOf(root), rect: box(rootRect) },
    first: first
      ? {
          selector: selectorOf(first.element),
          label: clip(first.element.getAttribute("aria-label") || first.element.textContent || ""),
          top: tenth(first.top),
        }
      : null,
    extents: extents.map(([left, right]) => [tenth(left), tenth(right)]),
  };

  return {
    url: location.href,
    viewport: { width: innerWidth, height: innerHeight },
    colorScheme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    page: { scrollWidth: document.documentElement.scrollWidth, clientWidth },
    texts,
    controls: controlRecords,
    overflowing,
    content,
  };
})({ ignore: [] });
