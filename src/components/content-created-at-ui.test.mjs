import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const caseEditor = readFileSync(new URL("../admin/ui/CaseEditor.tsx", import.meta.url), "utf8");
const templateEditor = readFileSync(new URL("../admin/ui/TemplateEditor.tsx", import.meta.url), "utf8");
const templateCard = readFileSync(new URL("./TemplateCard.tsx", import.meta.url), "utf8");
const templatesPage = readFileSync(new URL("../pages/TemplatesPage.tsx", import.meta.url), "utf8");
const homePage = readFileSync(new URL("../pages/HomePage.tsx", import.meta.url), "utf8");
const adminUtils = readFileSync(new URL("../admin/utils.ts", import.meta.url), "utf8");

test("admin lists show created dates for cases and templates", () => {
  assert.match(caseEditor, /formatContentDate/);
  assert.match(caseEditor, /createdAt/);
  assert.match(templateEditor, /formatContentDate/);
  assert.match(templateEditor, /createdAt/);
});

test("new manual cases and templates are stamped when created", () => {
  assert.match(adminUtils, /createdAt:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(templateEditor, /createdAt:\s*new Date\(\)\.toISOString\(\)/);
});

test("template pages use the shared newest-first template sort", () => {
  assert.match(templatesPage, /sortTemplatesForDisplay\(ALL_TEMPLATES\)/);
  assert.match(homePage, /sortTemplatesForDisplay\(ALL_TEMPLATES\)/);
});

test("template cards expose independent detail, lightbox, and prompt controls", () => {
  assert.match(templateCard, /ImageLightbox/);
  assert.match(templateCard, /lightboxOpen/);
  assert.match(templateCard, /setLightboxOpen\(true\)/);
  assert.match(templateCard, /to=\{detailHref\}/);
  assert.match(templateCard, /aria-expanded=\{expanded\}/);
  assert.match(templateCard, /type="button"\s+aria-label=/);
  assert.doesNotMatch(templateCard, /<Link[^>]*>\s*<article/);
});
