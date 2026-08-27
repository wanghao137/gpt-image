// Superseded by validation-core.mjs, which adds category whitelist, kebab-case
// id, template-tag vocabulary, and sourceType rules on top of the original
// required-field checks. Kept as a re-export so existing imports and tests
// keep working; new code should import from validation-core.mjs directly.
export { validateManualTemplates } from "./validation-core.mjs";
