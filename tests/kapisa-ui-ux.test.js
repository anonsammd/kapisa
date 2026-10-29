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

  // 4. PDP Sticky Architecture Contract Verification
  it('8. Sticky PDP: Root overflow-x clip and sticky media container invariants', async () => {
    const fs = await import('node:fs');
    const themeLiquid = fs.readFileSync('layout/theme.liquid', 'utf-8');
    const pdpLiquid = fs.readFileSync('blocks/kapisa-product-info.liquid', 'utf-8');

    // Root must NOT use overflow-x: hidden on html/body which disables position: sticky
    assert.match(themeLiquid, /overflow-x:\s*clip/i, 'theme.liquid must use overflow-x: clip on html/body');
    assert.doesNotMatch(themeLiquid, /html\s*,\s*body\s*\{[^}]*overflow-x:\s*hidden/i, 'theme.liquid must NOT have overflow-x: hidden on root');

    // PDP Media must declare position: sticky with header offset
    assert.match(pdpLiquid, /position:\s*sticky/i, 'kapisa-product-info.liquid must declare position: sticky');
    assert.match(pdpLiquid, /top:\s*var\(--kapisa-header-total-height,\s*100px\)/i, 'kapisa-product-info.liquid must anchor sticky to header height');
    assert.match(pdpLiquid, /align-self:\s*start/i, 'Sticky media column must have align-self: start');
    assert.match(pdpLiquid, /__main\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1\.18[^}]*background:\s*#FFFFFF/is, 'PDP image frame must keep a consistent ratio and white backdrop');
    assert.match(pdpLiquid, /__slide img\s*\{[^}]*object-fit:\s*contain/is, 'Product media must remain uncropped inside the image frame');
  });

  // 5. Multi-Metafield Color Swatch Resolver Logic
  function resolveColorHex(colorName, customHex) {
    if (customHex && typeof customHex === 'string' && customHex.startsWith('#')) {
      return customHex;
    }
    const clean = (colorName || '').toLowerCase().trim();
    if (clean.includes('olive') || clean.includes('sage') || clean.includes('army') || clean.includes('moss')) return '#556B2F';
    if (clean.includes('navy') || clean.includes('midnight') || clean.includes('deep blue')) return '#0E1F3C';
    if (clean.includes('black') || clean.includes('onyx') || clean.includes('charcoal')) return '#18191C';
    if (clean.includes('hunter') || clean.includes('forest') || clean.includes('emerald') || clean.includes('green')) return '#1B4942';
    if (clean.includes('wine') || clean.includes('burgundy') || clean.includes('maroon') || clean.includes('ruby')) return '#4A1525';
    if (clean.includes('ceil') || clean.includes('sky') || clean.includes('light blue')) return '#6BA4B8';
    if (clean.includes('royal') || clean.includes('blue')) return '#1B365D';
    if (clean.includes('grey') || clean.includes('gray') || clean.includes('slate') || clean.includes('pewter')) return '#5A626A';
    if (clean.includes('teal') || clean.includes('caribbean') || clean.includes('aqua')) return '#0D9488';
    if (clean.includes('khaki') || clean.includes('tan') || clean.includes('beige')) return '#C2B280';
    return '#0E1F3C';
  }

  it('9. PDP Color Swatches: Multi-metafield color dictionary resolution', () => {
    assert.equal(resolveColorHex('Olive Green', null), '#556B2F');
    assert.equal(resolveColorHex('Deep Navy', null), '#0E1F3C');
    assert.equal(resolveColorHex('Onyx Black', null), '#18191C');
    assert.equal(resolveColorHex('Burgundy Wine', null), '#4A1525');
    assert.equal(resolveColorHex('Ceil Blue', null), '#6BA4B8');
    assert.equal(resolveColorHex('Custom Shade', '#123456'), '#123456');
  });

  // 6. PDP Purchase and Shopify Data Contracts
  it('10. PDP uses Shopify purchase data and avoids unsupported claims', async () => {
    const fs = await import('node:fs');
    const pdpLiquid = fs.readFileSync('blocks/kapisa-product-info.liquid', 'utf-8');
    const productTemplate = fs.readFileSync('templates/product.json', 'utf-8');

    assert.match(pdpLiquid, /Buy it now/, 'PDP must label its checkout action accurately');
    assert.match(pdpLiquid, /current_variant\.available/, 'PDP must use Shopify variant availability');
    assert.match(pdpLiquid, /product\.description/, 'PDP must render the Shopify product description');
    assert.doesNotMatch(pdpLiquid, /Cash on Delivery|Clinical Grade • Grade 4A|24hr Dispatch|Free Returns 15|Easy EMI Options/, 'PDP must not make unsupported purchase or product claims');
    assert.doesNotMatch(productTemplate, /500\+ Healthcare Heroes|Premium 4-Way Stretch Fabric|Cash on Delivery|Easy 7-Day Exchange|16-Hr Rated/, 'Product template must not render hardcoded promotional or shipping claims');
  });

  // 7. Sibling Color Swatch Linking Invariant
  it('11. Sibling color swatches use Shopify product references', async () => {
    const fs = await import('node:fs');
    const pdpLiquid = fs.readFileSync('blocks/kapisa-product-info.liquid', 'utf-8');

    assert.match(pdpLiquid, /product\.metafields\.custom\.color_family_products\.value/, 'PDP must use the canonical product-reference metafield');
    assert.match(pdpLiquid, /href="\{\{ s_url \}\}"/, 'Related product swatches must link to their Shopify product');
    assert.match(pdpLiquid, /data-is-current="true"/, 'PDP must identify the active product swatch');
    assert.match(pdpLiquid, /has_explicit_color_name/, 'PDP must not infer a color swatch from the product title alone');
    assert.doesNotMatch(pdpLiquid, /metafields\.custom\.(color_products|related_products)/, 'PDP must not guess color families from legacy metafields');
  });

  // 8. PDP description and media contracts
  it('12. PDP uses Shopify product content and responsive media layout', async () => {
    const fs = await import('node:fs');
    const pdpLiquid = fs.readFileSync('blocks/kapisa-product-info.liquid', 'utf-8');

    assert.match(pdpLiquid, /\{% if product\.description != blank %\}/, 'PDP must hide an empty product description');
    assert.match(pdpLiquid, /\{\{ product\.description \}\}/, 'PDP must render the Shopify product description');
    assert.doesNotMatch(pdpLiquid, /Antimicrobial|Liquid Repellent|4-Way Stretch|Autoclave Safe/, 'PDP must not make unsupported technical claims');

    // Single media condition & no-thumbs class
    assert.match(pdpLiquid, /no-thumbs/, 'PDP must declare .no-thumbs class when media size <= 1');
    assert.match(pdpLiquid, /has_multiple_media/, 'PDP must conditionally render thumbnail track');

    // Dynamic header height measurement
    assert.match(pdpLiquid, /initHeaderOffset/, 'PDP must measure sticky header dynamically in JS');
  });

  // 9. Shopify Swatch Metadata & Image Support
  it('13. Shopify swatches use canonical color metafields', async () => {
    const fs = await import('node:fs');
    const pdpLiquid = fs.readFileSync('blocks/kapisa-product-info.liquid', 'utf-8');

    assert.match(pdpLiquid, /metafields\.custom\.color_name/, 'PDP must read the canonical color name metafield');
    assert.match(pdpLiquid, /metafields\.custom\.color_swatch/, 'PDP must read the canonical color swatch metafield');
    assert.match(pdpLiquid, /background-color: \{\{ s_color_hex \}\};/, 'PDP must apply the Shopify Color value as a swatch background');
  });

  // 10. Product swatch links, honest reviews, and image dimensions
  it('14. Product swatch links and review summaries use Shopify data', async () => {
    const fs = await import('node:fs');
    const pdpLiquid = fs.readFileSync('blocks/kapisa-product-info.liquid', 'utf-8');
    const reviewsLiquid = fs.readFileSync('blocks/customer-reviews.liquid', 'utf-8');
    const rackSection = fs.readFileSync('sections/virtual-rack.liquid', 'utf-8');
    const rackSnippet = fs.readFileSync('snippets/virtual-rack-item.liquid', 'utf-8');

    // Product-reference validation and URL fallback
    assert.match(pdpLiquid, /s_valid/, 'PDP must guard sibling swatch rendering with s_valid');
    assert.match(pdpLiquid, /assign s_url = '\/products\/' \| append: s_prod\.handle/, 'PDP must provide fallback URL for sibling products');

    // Review summaries appear only when real Shopify review data exists
    assert.match(reviewsLiquid, /product\.metafields\.reviews\.rating\.value/, "Review summary must use Shopify's rating metafield");
    assert.match(reviewsLiquid, /product\.metafields\.reviews\.rating_count\.value/, "Review summary must use Shopify's review count metafield");
    assert.match(reviewsLiquid, /No reviews yet\./, 'Review block must show an honest empty state');
    assert.match(pdpLiquid, /href="#kapisa-reviews"/, 'PDP must link directly to #kapisa-reviews');

    // Virtual rack img dimensions
    assert.match(rackSection, /<img class="ai-rack__f-img"[^>]*width="480"[^>]*height="600"/, 'virtual-rack section img must have width and height');
    assert.match(rackSnippet, /<img[^>]*width="480"[^>]*height="600"/, 'virtual-rack snippet img must have width and height');
  });

  it('15. Product cards display only Shopify review data', async () => {
    const fs = await import('node:fs');
    const collectionGrid = fs.readFileSync('blocks/collection-grid.liquid', 'utf-8');
    const bestsellersCarousel = fs.readFileSync('blocks/bestsellers-carousel.liquid', 'utf-8');

    for (const cardBlock of [collectionGrid, bestsellersCarousel]) {
      assert.match(cardBlock, /product\.metafields\.reviews\.rating\.value/, 'Product cards must source ratings from Shopify');
      assert.match(cardBlock, /product\.metafields\.reviews\.rating_count\.value/, 'Product cards must source review counts from Shopify');
      assert.doesNotMatch(cardBlock, /4\.9|16-Hr Rated/, 'Product cards must not use seeded rating or performance claims');
    }
  });
});
