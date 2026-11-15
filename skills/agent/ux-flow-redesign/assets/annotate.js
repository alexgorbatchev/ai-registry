// Screenshot annotation overlay for UX review evidence. Evaluate this file's contents in the page with the browser
// tool, again after every reload or navigation, then call:
//   __uxr.hide('<css selector>')                    hide development overlays that are not part of the product
//   __uxr.mark('<css selector>', 'problem')         box the first match
//   __uxr.markAll('<css selector>', 'problem')      box every match
//   __uxr.markText('visible text', 'problem')       box the smallest visible element containing the text
//   __uxr.markRect(x, y, w, h, 'problem')           box a viewport rectangle in CSS pixels
//   __uxr.note('callout text', x, y)                free-floating callout at viewport coordinates
//   __uxr.clear()                                   remove every annotation
// Boxes are numbered automatically and fixed to the viewport, so mark again after scrolling. Labels state the problem
// ("Selection bar pushes the table down 52px"), not the element name. Annotations attach to the topmost open
// <dialog> so they render above modals.
(() => {
  const font =
    '600 13px/1.3 "Maple Mono Normal NF", "Maple Mono Normal", "Maple Mono NF", "Maple Mono", ui-monospace, monospace';
  const style = document.getElementById("uxr-style") ?? document.createElement("style");
  style.id = "uxr-style";
  style.textContent = `
    .uxr-box { position: fixed; border: 3px solid #ff2d55; border-radius: 4px; box-shadow: 0 0 0 2px rgba(0,0,0,.55), 0 0 18px rgba(255,45,85,.55); pointer-events: none; z-index: 2147483647; }
    .uxr-tag { position: fixed; max-width: 460px; background: #ff2d55; color: #fff; font: ${font}; padding: 3px 7px; border-radius: 4px; pointer-events: none; z-index: 2147483647; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
    .uxr-note { position: fixed; max-width: 420px; background: #fff3b0; color: #111; border: 2px solid #ff2d55; font: ${font}; padding: 6px 9px; border-radius: 6px; pointer-events: none; z-index: 2147483647; box-shadow: 0 4px 14px rgba(0,0,0,.55); }
    .uxr-hidden { display: none !important; }
  `;
  document.head.appendChild(style);

  const host = () => {
    const top = [...document.querySelectorAll("dialog[open]")].at(-1);
    const parent = top ?? document.body;
    let layer = parent.querySelector(":scope > .uxr-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "uxr-layer";
      parent.appendChild(layer);
    }
    return layer;
  };
  let counter = document.querySelectorAll(".uxr-box").length;
  const draw = (rect, label) => {
    counter += 1;
    const layer = host();
    const pad = 3;
    const box = document.createElement("div");
    box.className = "uxr-box";
    Object.assign(box.style, {
      left: `${rect.left - pad}px`,
      top: `${rect.top - pad}px`,
      width: `${rect.width + pad * 2}px`,
      height: `${rect.height + pad * 2}px`,
    });
    layer.appendChild(box);
    const tag = document.createElement("div");
    tag.className = "uxr-tag";
    tag.textContent = label ? `${counter}. ${label}` : String(counter);
    layer.appendChild(tag);
    const above = rect.top - pad - 24 - 2;
    const left = Math.max(4, Math.min(rect.left - pad, window.innerWidth - Math.min(460, tag.offsetWidth || 200) - 4));
    Object.assign(tag.style, { left: `${left}px`, top: `${above > 2 ? above : rect.bottom + pad + 2}px` });
    return counter;
  };
  window.__uxr = {
    hide(selector) {
      const matches = [...document.querySelectorAll(selector)];
      for (const element of matches) element.classList.add("uxr-hidden");
      return matches.length;
    },
    mark(selector, label) {
      const element = document.querySelector(selector);
      return element ? draw(element.getBoundingClientRect(), label) : `no match for ${selector}`;
    },
    markAll(selector, label) {
      return [...document.querySelectorAll(selector)].map((element) => draw(element.getBoundingClientRect(), label));
    },
    markText(text, label) {
      const all = [...document.querySelectorAll("body *")].filter(
        (element) =>
          !element.closest(".uxr-layer") && element.offsetParent !== null && element.textContent?.includes(text),
      );
      const smallest =
        all.find((element) => ![...element.children].some((child) => child.textContent?.includes(text))) ?? all.at(-1);
      return smallest ? draw(smallest.getBoundingClientRect(), label) : `no element contains ${text}`;
    },
    markRect(x, y, width, height, label) {
      return draw({ left: x, top: y, width, height, bottom: y + height }, label);
    },
    note(text, x, y) {
      const note = document.createElement("div");
      note.className = "uxr-note";
      note.textContent = text;
      Object.assign(note.style, { left: `${x}px`, top: `${y}px` });
      host().appendChild(note);
      return "noted";
    },
    clear() {
      document.querySelectorAll(".uxr-layer").forEach((layer) => layer.remove());
      counter = 0;
      return "cleared";
    },
  };
  return "uxr ready";
})();
