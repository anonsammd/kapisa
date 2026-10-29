const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

describe('Theme Editor data preservation', () => {
  it('protects merchant-managed settings and templates from routine Shopify CLI pushes', () => {
    const ignoreRules = fs.readFileSync('.shopifyignore', 'utf8');

    assert.match(ignoreRules, /^config\/settings_data\.json$/m);
    assert.match(ignoreRules, /^templates\/\*\.json$/m);
    assert.match(ignoreRules, /^sections\/\*-group\.json$/m);
  });

  it('documents why protected files must be merged before intentional template deployment', () => {
    const deploymentGuide = fs.readFileSync('DEPLOYMENT_GUIDE.md', 'utf8');

    assert.match(deploymentGuide, /uploaded hero videos, Instagram tiles, and institutional banner images/);
    assert.match(deploymentGuide, /merging the current Theme Editor settings from Shopify/);
    assert.match(deploymentGuide, /Do not upload a fresh ZIP over an existing production theme/);
  });
});
