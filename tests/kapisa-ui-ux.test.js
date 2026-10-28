import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Kapisa UI/UX Collection & PDP Architecture Verification', () => {
  // 1. Savings percentage calculation
  function calculateSavings(priceCents, compareAtCents) {
    if (!compareAtCents || compareAtCents <= priceCents) return 0;
    return Math.round(((compareAtCents - priceCents) * 100) / compareAtCents);
  }

  it('1. Correctly calculates savings badge percentage for sale items', () => {
    assert.equal(calculateSavings(360000, 450000), 20); // 20% off
    assert.equal(calculateSavings(299900, 399900), 25); // 25% off
    assert.equal(calculateSavings(450000, 450000), 0);  // No discount
    assert.equal(calculateSavings(500000, 450000), 0);  // Invalid compare
  });

  // 2. Multi-facet filter matcher logic
  const COLOR_FAMILIES = {
    black: ['black', 'noir', 'onyx', 'midnight', 'dark'],
    blue: ['blue', 'navy', 'royal', 'ceil', 'teal', 'cyan', 'sky', 'indigo'],
    green: ['green', 'hunter', 'olive', 'sage', 'mint', 'emerald', 'forest'],
    red: ['red', 'burgundy', 'wine', 'maroon', 'crimson', 'berry', 'ruby'],
    pastel: ['pastel', 'lavender', 'lilac', 'blush', 'peach', 'rose', 'mauve', 'soft', 'pink'],
    grey: ['grey', 'gray', 'slate', 'heather', 'charcoal', 'silver', 'ash'],
    gray: ['grey', 'gray', 'slate', 'heather', 'charcoal', 'silver', 'ash']
  };

  function matchCardMulti(card, filters) {
    const { colors = [], sizes = [], minPrice = null, maxPrice = null, inStock = false } = filters;

    if (colors.length > 0) {
      const cardColors = (card.colors || '').toLowerCase();
      const cardTags = (card.tags || '').toLowerCase();
      const cardTitle = (card.title || '').toLowerCase();

      const colorMatch = colors.some(targetColor => {
        let cleanTarget = targetColor.toLowerCase().replace(/all\s+/i, '').trim();
        if (cleanTarget.endsWith('s') && !['burgundy'].includes(cleanTarget)) {
          cleanTarget = cleanTarget.slice(0, -1);
        }
        const family = COLOR_FAMILIES[cleanTarget] || [cleanTarget];
        return family.some(k => cardColors.includes(k) || cardTags.includes(k) || cardTitle.includes(k));
      });
      if (!colorMatch) return false;
    }

    if (sizes.length > 0) {
      const cardSizes = (card.sizes || '').toLowerCase();
      const availableSizes = cardSizes.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const sizeMatch = sizes.some(targetSize => {
        const clean = targetSize.toLowerCase().trim();
        return availableSizes.includes(clean);
      });
      if (!sizeMatch) return false;
    }

    if (minPrice !== null || maxPrice !== null) {
      const priceUnits = card.price / 100;
      if (minPrice !== null && priceUnits < minPrice) return false;
      if (maxPrice !== null && priceUnits > maxPrice) return false;
    }

    if (inStock && !card.available) {
      return false;
    }

    return true;
  }

  const catalog = [
    { id: 1, title: 'Signature Navy Scrub Top', colors: 'navy,blue', sizes: 's,m,l', price: 299900, available: true },
    { id: 2, title: 'Onyx Black Surgeon Pants', colors: 'black,onyx', sizes: 'm,l,xl', price: 349900, available: true },
    { id: 3, title: 'Hunter Green Scrub Top', colors: 'hunter green,sage', sizes: 'xs,s', price: 249900, available: false },
    { id: 4, title: 'Burgundy Executive Set', colors: 'burgundy,wine', sizes: 's,m,l,xl', price: 549900, available: true },
    { id: 5, title: 'Petite Scrub Top XS Only', colors: 'navy', sizes: 'xs', price: 229900, available: true },
    { id: 6, title: 'Tall Scrub Pant XL Only', colors: 'black', sizes: 'xl', price: 389900, available: true }
  ];

  it('2. Multi-facet filter: filters by Color + Size combined', () => {
    const results = catalog.filter(p => matchCardMulti(p, { colors: ['Blue'], sizes: ['M'] }));
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Signature Navy Scrub Top');
  });

  it('3. Price range filtering matches products within unit boundaries', () => {
    const results = catalog.filter(p => matchCardMulti(p, { minPrice: 2000, maxPrice: 3000 }));
    assert.equal(results.length, 3); // 299900, 249900, and 229900
  });

  it('4. Availability filter excludes out of stock items', () => {
    const results = catalog.filter(p => matchCardMulti(p, { colors: ['Green'], inStock: true }));
    assert.equal(results.length, 0); // Hunter Green is available: false
  });

  it('5. Exact size token matching prevents substring false positives (xs does NOT match s, xl does NOT match l)', () => {
    // S size filter should NOT match product #5 which only has XS
    const sResults = catalog.filter(p => matchCardMulti(p, { sizes: ['S'] }));
    assert.equal(sResults.some(p => p.id === 5), false, 'Product #5 (XS only) must NOT match size S');

    // L size filter should NOT match product #6 which only has XL
    const lResults = catalog.filter(p => matchCardMulti(p, { sizes: ['L'] }));
    assert.equal(lResults.some(p => p.id === 6), false, 'Product #6 (XL only) must NOT match size L');
  });

  it('6. URL facet parameter extraction restores color, size, price, and availability', () => {
    const url = new URL('https://kapisa.com/collections/scrubs?filter.v.option.color=Navy&size=M&availability=in_stock&min_price=2000&max_price=4000');
    const params = url.searchParams;

    const colors = [];
    params.forEach((val, key) => {
      if (key.includes('color')) colors.push(val.toLowerCase());
    });

    const sizes = [];
    params.forEach((val, key) => {
      if (key.includes('size')) sizes.push(val.toLowerCase());
    });

    const inStock = params.get('availability') === 'in_stock';
    const minPrice = parseFloat(params.get('min_price'));
    const maxPrice = parseFloat(params.get('max_price'));

    assert.deepEqual(colors, ['navy']);
    assert.deepEqual(sizes, ['m']);
    assert.equal(inStock, true);
    assert.equal(minPrice, 2000);
    assert.equal(maxPrice, 4000);
  });

  // 3. PDP Quantity boundary enforcement
  it('7. Clamps quantity to positive integers >= 1', () => {
    function sanitizeQty(val) {
      const num = Number(val || 1);
      return Math.max(1, Math.floor(isNaN(num) ? 1 : num));
    }
    assert.equal(sanitizeQty(0), 1);
    assert.equal(sanitizeQty(-5), 1);
    assert.equal(sanitizeQty(3.8), 3);
    assert.equal(sanitizeQty('abc'), 1);
    assert.equal(sanitizeQty('4'), 4);
  });
});

