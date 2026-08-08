/**
 * pnpm hook to override vulnerable dependencies.
 * Forces js-yaml to patched versions to fix CVE-2026-59870.
 */
function readPackage(pkg) {
  // Force all js-yaml versions to the patched version
  if (pkg.dependencies?.['js-yaml']) {
    pkg.dependencies['js-yaml'] = '^4.3.1';
  }
  if (pkg.devDependencies?.['js-yaml']) {
    pkg.devDependencies['js-yaml'] = '^4.3.1';
  }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage
  }
};
