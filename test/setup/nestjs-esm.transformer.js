'use strict';

/**
 * @nestjs/* ships as ESM-only as of v12 (no CJS build). ts-jest's own
 * transform already downlevels the plain `import`/`export` syntax those
 * packages use to CommonJS fine, but `@nestjs/common/utils/load-package.util.js`
 * also references `import.meta.url` as a fallback branch inside
 * `loadPackageSync` (used to resolve optional peers like class-validator).
 * `import.meta` has no CommonJS form, so the TypeScript compiler leaves it
 * untouched, and Node's CJS script loader then fails to parse the file at
 * all — even though every code path Jest actually exercises here supplies an
 * explicit `loaderFn` and never reaches that branch.
 *
 * Rather than pull in Babel purely to downlevel one meta-property, this
 * substitutes the (unreachable-for-us) expression for the CommonJS
 * equivalent Node itself uses to compute the same value, before handing the
 * source to ts-jest for the normal TypeScript-based transform.
 */
const { TsJestTransformer } = require('ts-jest');

const tsJestTransformer = new TsJestTransformer({ isolatedModules: true });

// `const require = createRequire(import.meta.url)` is the standard ESM idiom
// for a file-relative require function. Once this file runs as CommonJS,
// `require` is already an implicit, file-relative parameter of the module
// wrapper, so re-declaring it as a const throws ("Identifier 'require' has
// already been declared"). Dropping the redeclaration is behaviorally
// identical to keeping it — both resolve relative to this same file.
const LOCAL_REQUIRE_REDECLARATION =
  /const\s+require\s*=\s*createRequire\(\s*import\.meta\.url\s*\)\s*;?/g;

// Any other (rarer) inline use of `import.meta.url` — e.g. as a plain
// argument rather than assigned to `require` — has no CommonJS equivalent
// syntax, so it's replaced with the value Node's CJS `require` would compute
// for the same file.
const IMPORT_META_URL = /import\.meta\.url/g;
const IMPORT_META_URL_REPLACEMENT =
  "require('url').pathToFileURL(__filename).href";

function patch(sourceText) {
  if (!sourceText.includes('import.meta')) return sourceText;

  return sourceText
    .replace(LOCAL_REQUIRE_REDECLARATION, '')
    .replace(IMPORT_META_URL, IMPORT_META_URL_REPLACEMENT);
}

module.exports = {
  process(sourceText, sourcePath, options) {
    return tsJestTransformer.process(patch(sourceText), sourcePath, options);
  },
  getCacheKey(sourceText, sourcePath, options) {
    return `${tsJestTransformer.getCacheKey(patch(sourceText), sourcePath, options)}-nestjs-esm-patch-v1`;
  }
};
