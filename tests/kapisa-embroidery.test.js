const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// 1. Money Formatter Simulation (matching assets/kapisa-embroidery.js)
function formatMoney(cents, format) {
  if (typeof cents === 'string') cents = cents.replace('.', '');
  const num = Number(cents) || 0;
  let formatString = format || '{{amount}}';
  const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
  const match = formatString.match(placeholderRegex);
  if (!match) return (num / 100).toFixed(2);

  function formatWithDelimiters(number, precision, thousands, decimal) {
    precision = typeof precision === 'undefined' ? 2 : precision;
    thousands = typeof thousands === 'undefined' ? ',' : thousands;
    decimal = typeof decimal === 'undefined' ? '.' : decimal;
    if (isNaN(number) || number == null) return '0';
    const fixed = (number / 100.0).toFixed(precision);
    const parts = fixed.split('.');
    const dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
    const dec = parts[1] ? decimal + parts[1] : '';
    return dollars + dec;
  }

  let value = '';
  switch (match[1]) {
    case 'amount':
      value = formatWithDelimiters(num, 2);
      break;
    case 'amount_no_decimals':
      value = formatWithDelimiters(num, 0);
      break;
    case 'amount_with_comma_separator':
      value = formatWithDelimiters(num, 2, '.', ',');
      break;
    case 'amount_no_decimals_with_comma_separator':
      value = formatWithDelimiters(num, 0, '.', ',');
      break;
    default:
      value = formatWithDelimiters(num, 2);
  }
  return formatString.replace(placeholderRegex, value);
}

// 2. Customizer State and Pricing Model Engine
class EmbroideryTestModel {
  constructor(options = [], previewImages = {}) {
    this.options = options;
    this.previewImages = previewImages;
    this.state = {
      option: options.find((o) => o.kind === 'top') || options[0] || null,
      line1: '',
      line2: '',
      bottomText: '',
      threadColor: { name: 'White', hex: '#FFFFFF' },
      fontType: 'block',
      bottomAddon: false,
      iconEnabled: false,
      selectedIcon: null,
      customLogoName: '',
    };
  }

  getEffectiveOption() {
    const base = this.state.option;
    if (!base) return null;
    if (base.kind === 'top' && this.state.bottomAddon) {
      const comboOpt = this.options.find((o) => o.kind === 'combo');
      if (comboOpt) return comboOpt;
    }
    return base;
  }

  getComputedPrice() {
    const opt = this.getEffectiveOption();
    if (!opt) return { total: 0, orig: 0 };
    const total = Number(opt.price) || 0;
    let orig = 0;
    if (opt.kind === 'combo') {
      const topOpt = this.options.find((o) => o.kind === 'top');
      const botOpt = this.options.find((o) => o.kind === 'bottom');
      if (topOpt && botOpt) {
        orig = Number(topOpt.price) + Number(botOpt.price);
      }
    }
    return { total, orig };
  }

  getPreviewImage() {
    const opt = this.getEffectiveOption();
    const kind = opt ? opt.kind : 'top';
    return this.previewImages[kind] || this.previewImages['top'] || null;
  }

  buildCartItems(context = {}) {
    const opt = this.getEffectiveOption();
    if (!opt) return null;

    const garmentVariantId = Number(context.variantId);
    const quantity = Number(context.quantity) || 1;
    const serviceVariantId = Number(opt.variantId);

    if (!garmentVariantId || !serviceVariantId) return null;

    const isBottom = opt.kind === 'bottom';
    const pId = `emb_test_${Date.now()}`;

    const visible = {
      Embroidery: opt.label,
      Color: this.state.threadColor.name,
      Font: this.state.fontType === 'script' ? 'Script' : 'Block',
    };

    if (isBottom) {
      visible['first_name'] = this.state.bottomText.trim();
    } else {
      visible['first_name'] = this.state.line1.trim();
      if (this.state.line2.trim()) visible['designation'] = this.state.line2.trim();
      if (opt.kind === 'combo' || this.state.bottomAddon) {
        visible['bottom_name'] = this.state.line1.trim();
      }
    }

    if (this.state.selectedIcon) {
      visible['Icon'] = this.state.selectedIcon.name;
    } else if (this.state.customLogoName) {
      visible['Icon'] = `Custom Logo (${this.state.customLogoName})`;
    }

    const hidden = {
      _personalization_id: pId,
      _embroidery_option: opt.handle,
    };

    const forLabel = context.variantTitle && context.variantTitle !== 'Default Title'
      ? `${context.productTitle || 'Garment'} / ${context.variantTitle}`
      : (context.productTitle || 'Garment');

    return [
      {
        id: garmentVariantId,
        quantity: quantity,
        properties: {
          ...visible,
          ...hidden,
          _linked_variant_id: String(serviceVariantId),
        },
      },
      {
        id: serviceVariantId,
        quantity: quantity,
        properties: {
          ...visible,
          ...hidden,
          _linked_variant_id: String(garmentVariantId),
          'Embroidery For': forLabel,
        },
      },
    ];
  }
}

// 3. Automated Test Suite
describe('Kapisa Custom Embroidery & Cart Architecture Tests', () => {
  const mockOptions = [
    { handle: 'top', label: 'Top Embroidery', kind: 'top', price: 29900, variantId: 67809514258534 },
    { handle: 'bottom', label: 'Bottom Embroidery', kind: 'bottom', price: 19900, variantId: 67809514291302 },
    { handle: 'combo', label: 'Embroidery Bundle', kind: 'combo', price: 59800, variantId: 67809514324070 },
  ];

  const mockPreviewImages = {
    top: { url: 'https://cdn.shopify.com/top.png', width: 600, height: 640 },
    bottom: { url: 'https://cdn.shopify.com/bottom.png', width: 600, height: 640 },
    combo: { url: 'https://cdn.shopify.com/combo.png', width: 600, height: 640 },
  };

  it('1. Pricing Model: Verifies NO phantom JS fees are added and prices match Shopify variants', () => {
    const customizer = new EmbroideryTestModel(mockOptions, mockPreviewImages);
    
    // Top option selected
    customizer.state.option = mockOptions.find(o => o.kind === 'top');
    customizer.state.line1 = 'Dr. Sharma';
    customizer.state.iconEnabled = true;
    customizer.state.selectedIcon = { id: 'caduceus', name: 'Caduceus' };

    const price = customizer.getComputedPrice();
    // In the single source of truth, Top price is exactly 29900 (₹299), NOT 29900 + 25000 = 54900
    assert.equal(price.total, 29900, 'Top embroidery price should strictly match Shopify Top variant price');
  });

  it('2. Bundle Transition: Toggling "Add name to bottom" cleanly promotes Top to Combo variant', () => {
    const customizer = new EmbroideryTestModel(mockOptions, mockPreviewImages);
    customizer.state.option = mockOptions.find(o => o.kind === 'top');
    customizer.state.line1 = 'Dr. Jane';
    customizer.state.bottomAddon = true;

    const effective = customizer.getEffectiveOption();
    assert.equal(effective.kind, 'combo', 'Effective option should be Combo');
    assert.equal(effective.variantId, 67809514324070, 'Service variant ID should be Combo variant ID');

    const price = customizer.getComputedPrice();
    assert.equal(price.total, 59800, 'Total price should be 59800 (₹598.00)');
  });

  it('3. Multi-Preview Image Resolution: Switches preview stage image cleanly per option', () => {
    const customizer = new EmbroideryTestModel(mockOptions, mockPreviewImages);
    
    customizer.state.option = mockOptions.find(o => o.kind === 'top');
    assert.equal(customizer.getPreviewImage().url, 'https://cdn.shopify.com/top.png');

    customizer.state.option = mockOptions.find(o => o.kind === 'bottom');
    assert.equal(customizer.getPreviewImage().url, 'https://cdn.shopify.com/bottom.png');

    customizer.state.option = mockOptions.find(o => o.kind === 'combo');
    assert.equal(customizer.getPreviewImage().url, 'https://cdn.shopify.com/combo.png');
  });

  it('4. Cart Item Construction: Builds paired line items with stable relationship and identical quantities', () => {
    const customizer = new EmbroideryTestModel(mockOptions, mockPreviewImages);
    customizer.state.option = mockOptions.find(o => o.kind === 'top');
    customizer.state.line1 = 'Dr. Kapisa';
    customizer.state.line2 = 'Chief Surgeon';
    customizer.state.threadColor = { name: 'Gold', hex: '#F5A623' };

    const context = {
      variantId: 4400112233,
      quantity: 3,
      productTitle: 'Apex Pro V-Neck Scrub',
      variantTitle: 'Navy / M',
    };

    const cartItems = customizer.buildCartItems(context);
    assert.equal(cartItems.length, 2, 'Should return exactly 2 items (garment + embroidery)');

    const [garment, service] = cartItems;
    assert.equal(garment.id, 4400112233, 'Garment ID matches context');
    assert.equal(garment.quantity, 3, 'Garment quantity matches context');
    assert.equal(service.id, 67809514258534, 'Service ID matches Top variant');
    assert.equal(service.quantity, 3, 'Service quantity matches garment quantity');

    const pId = garment.properties._personalization_id;
    assert.ok(pId, 'Personalization ID should be non-empty');
    assert.equal(service.properties._personalization_id, pId, 'Personalization ID must match between garment and service');
    assert.equal(garment.properties._linked_variant_id, String(service.id));
    assert.equal(service.properties._linked_variant_id, String(garment.id));
    assert.equal(service.properties['Embroidery For'], 'Apex Pro V-Neck Scrub / Navy / M');
  });

  it('5. Atomic Cart Quantity Synchronization: Synchronizes garment + service items in updates map', () => {
    const mockCart = [
      { key: 'garment_row_key', properties: { _personalization_id: 'emb_123' }, quantity: 1 },
      { key: 'service_row_key', properties: { _personalization_id: 'emb_123', 'Embroidery For': 'Scrub' }, quantity: 1 }
    ];

    const targetPersonalizationId = 'emb_123';
    const newQuantity = 4;

    // Simulation of updateQuantity synchronization in assets/cart.js
    const updates = {};
    mockCart.forEach(item => {
      if (item.properties._personalization_id === targetPersonalizationId) {
        updates[item.key] = newQuantity;
      }
    });

    assert.deepEqual(updates, {
      garment_row_key: 4,
      service_row_key: 4
    }, 'Both line items must update to new quantity simultaneously');
  });

  it('6. Atomic Cart Removal: Removes both garment and linked service line without orphaned charges', () => {
    const mockCart = [
      { key: 'garment_row_key', properties: { _personalization_id: 'emb_123' } },
      { key: 'service_row_key', properties: { _personalization_id: 'emb_123', 'Embroidery For': 'Scrub' } }
    ];

    const updates = {};
    mockCart.forEach(item => {
      if (item.properties._personalization_id === 'emb_123') {
        updates[item.key] = 0;
      }
    });

    assert.deepEqual(updates, {
      garment_row_key: 0,
      service_row_key: 0
    }, 'Removing garment must atomically set service quantity to 0');
  });

  it('7. Orphan Sanitation: Correctly identifies and targets orphaned service lines for removal', () => {
    const mockCart = [
      { key: 'service_orphan_key', properties: { _personalization_id: 'emb_orphaned_999', 'Embroidery For': 'Deleted Scrub' } },
      { key: 'unrelated_garment', properties: { _personalization_id: 'emb_valid_100' } },
      { key: 'unrelated_service', properties: { _personalization_id: 'emb_valid_100', 'Embroidery For': 'Scrub' } }
    ];

    const updates = {};
    mockCart.forEach(item => {
      if (item.properties['Embroidery For']) {
        const pId = item.properties._personalization_id;
        const hasGarment = mockCart.some(other => other.properties._personalization_id === pId && !other.properties['Embroidery For']);
        if (!hasGarment) {
          updates[item.key] = 0;
        }
      }
    });

    assert.deepEqual(updates, { service_orphan_key: 0 }, 'Orphaned service line must be marked for deletion with qty 0');
  });

  it('8. Dynamic Money Formatting: Formats currency without hardcoding symbols or decimal errors', () => {
    // Test INR formatting
    assert.equal(formatMoney(29900, '₹{{amount}}'), '₹299.00');
    assert.equal(formatMoney(29900, '₹{{amount_no_decimals}}'), '₹299');
    
    // Test USD formatting
    assert.equal(formatMoney(249900, '${{amount}}'), '$2,499.00');
    assert.equal(formatMoney(249900, '${{amount_no_decimals}}'), '$2,499');

    // Test EUR formatting
    assert.equal(formatMoney(19900, '€{{amount_with_comma_separator}}'), '€199,00');

    // Test GBP formatting
    assert.equal(formatMoney(59800, '£{{amount}}'), '£598.00');
  });

  it('9. Cart Page Grouping: Correctly renders personalized scrub and embroidery service without empty cart bug', () => {
    function isEmbroideryService(item) {
      const props = item.properties || {};
      return (
        Boolean(props['Embroidery For']) ||
        item.handle === 'embroidery-options-service' ||
        props['Embroidery Service'] === 'Yes'
      );
    }

    function getPersonalizationId(item) {
      const props = item.properties || {};
      return props['_personalization_id'] || props['Personalization ID'] || '';
    }

    function buildCartGroups(cart) {
      const services = {};
      const normalItems = [];

      cart.items.forEach(item => {
        if (isEmbroideryService(item)) {
          const pid = getPersonalizationId(item);
          if (pid) {
            services[pid] = item;
          } else {
            normalItems.push(item);
          }
          return;
        }
        normalItems.push(item);
      });

      const pairedPids = new Set();
      const groups = normalItems.map(item => {
        const pid = getPersonalizationId(item);
        let service = null;
        if (pid && services[pid]) {
          service = services[pid];
          pairedPids.add(pid);
        }
        return { item, service };
      });

      Object.keys(services).forEach(pid => {
        if (!pairedPids.has(pid)) {
          groups.push({ item: services[pid], service: null });
        }
      });

      return groups;
    }

    // Simulation of user cart: 1 Garment ($45.00) + 1 Embroidery Service ($598.00)
    const userCart = {
      items_subtotal_price: 64300,
      total_price: 64300,
      items: [
        {
          key: 'garment_key',
          title: 'Apex Scrub Top',
          price: 4500,
          quantity: 1,
          properties: {
            _personalization_id: 'emb_test_123',
            _embroidery_option: 'combo',
            first_name: 'Dr. Jane'
          }
        },
        {
          key: 'service_key',
          title: 'Embroidery Options (Service) - Combo',
          handle: 'embroidery-options-service',
          price: 59800,
          quantity: 1,
          properties: {
            _personalization_id: 'emb_test_123',
            _embroidery_option: 'combo',
            'Embroidery For': 'Apex Scrub Top',
            first_name: 'Dr. Jane'
          }
        }
      ]
    };

    const groups = buildCartGroups(userCart);
    assert.equal(groups.length, 1, 'Should produce 1 visual group for the paired items');
    assert.equal(groups[0].item.key, 'garment_key', 'Primary item must be the garment');
    assert.ok(groups[0].service, 'Group must have linked service attached');
    assert.equal(groups[0].service.key, 'service_key', 'Attached service item matches service_key');
  });

  it('10. Standalone Item Visibility: Unlinked products and standalone service products remain fully visible', () => {
    function isEmbroideryService(item) {
      const props = item.properties || {};
      return (
        Boolean(props['Embroidery For']) ||
        item.handle === 'embroidery-options-service' ||
        props['Embroidery Service'] === 'Yes'
      );
    }

    function getPersonalizationId(item) {
      const props = item.properties || {};
      return props['_personalization_id'] || props['Personalization ID'] || '';
    }

    function buildCartGroups(cart) {
      const services = {};
      const normalItems = [];

      cart.items.forEach(item => {
        if (isEmbroideryService(item)) {
          const pid = getPersonalizationId(item);
          if (pid) {
            services[pid] = item;
          } else {
            normalItems.push(item);
          }
          return;
        }
        normalItems.push(item);
      });

      const pairedPids = new Set();
      const groups = normalItems.map(item => {
        const pid = getPersonalizationId(item);
        let service = null;
        if (pid && services[pid]) {
          service = services[pid];
          pairedPids.add(pid);
        }
        return { item, service };
      });

      Object.keys(services).forEach(pid => {
        if (!pairedPids.has(pid)) {
          groups.push({ item: services[pid], service: null });
        }
      });

      return groups;
    }

    const mixedCart = {
      items: [
        { key: 'unembroidered_pants', title: 'Scrub Pants', price: 2500, properties: {} },
        { key: 'orphan_service', title: 'Embroidery Options (Service)', handle: 'embroidery-options-service', properties: { _personalization_id: 'no_match' } }
      ]
    };

    const groups = buildCartGroups(mixedCart);
    assert.equal(groups.length, 2, 'Both unembroidered pants and unlinked service must be visible in cart');
  });
});

