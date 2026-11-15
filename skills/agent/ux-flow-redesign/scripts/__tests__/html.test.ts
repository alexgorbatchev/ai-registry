import { expect, test } from "bun:test";
import { childElements, closest, decodeEntities, findAll, hasClass, parseHtml, textContent } from "../lib/html";

test("keeps line numbers, attributes and decoded text", () => {
  const root = parseHtml('<!doctype html>\n<p class="a b" id=x>\nTom &amp; Jerry &#8594; &#x2192;</p>');
  const paragraph = findAll(root, (element) => element.tag === "p")[0];
  expect(paragraph.line).toBe(2);
  expect(hasClass(paragraph, "b")).toBe(true);
  expect(paragraph.attrs.get("id")).toBe("x");
  expect(textContent(paragraph).trim()).toBe("Tom & Jerry → →");
  expect(decodeEntities("&unknown; &nbsp;")).toBe("&unknown;  ");
});

test("closes implied list items, table cells and paragraphs", () => {
  const root = parseHtml("<ul><li>one<li>two</ul><table><tr><td>a<td>b<tr><td>c</table><p>open<div>block</div>");
  expect(findAll(root, (element) => element.tag === "li").map(textContent)).toEqual(["one", "two"]);
  const rows = findAll(root, (element) => element.tag === "tr");
  expect(rows.map((row) => childElements(row).length)).toEqual([2, 1]);
  const block = findAll(root, (element) => element.tag === "div")[0];
  expect(block.parent?.tag).toBe("#document");
});

test("treats style and script content as raw text and skips comments", () => {
  const root = parseHtml(
    "<style>a > b { color: red }</style><script>if (a < b) {}</script><!-- <p>hidden</p> --><br><img src=x />",
  );
  expect(textContent(findAll(root, (element) => element.tag === "style")[0])).toBe("a > b { color: red }");
  expect(findAll(root, (element) => element.tag === "p")).toEqual([]);
  expect(findAll(root, (element) => element.tag === "img")[0].attrs.get("src")).toBe("x");
});

test("ignores stray end tags and finds the closest ancestor", () => {
  const root = parseHtml('<div class="step"><span>x</span></em></div>');
  const span = findAll(root, (element) => element.tag === "span")[0];
  expect(closest(span, (element) => hasClass(element, "step"))?.tag).toBe("div");
  expect(closest(span, (element) => element.tag === "table")).toBeNull();
});
