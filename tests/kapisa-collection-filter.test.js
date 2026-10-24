import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Kapisa Collection & Color Filter Tests', () => {
  const COLOR_FAMILIES = {
    black: ['black', 'noir', 'onyx', 'midnight', 'dark'],
    blue: ['blue', 'navy', 'royal', 'ceil', 'teal', 'cyan', 'sky', 'indigo'],
    green: ['green', 'hunter', 'olive', 'sage', 'mint', 'emerald', 'forest'],
    red: ['red', 'burgundy', 'wine', 'maroon', 'crimson', 'berry', 'ruby'],
    pastel: ['pastel', 'lavender', 'lilac', 'blush', 'peach', 'rose', 'mauve', 'soft', 'pink'],
    grey: ['grey', 'gray', 'slate', 'heather', 'charcoal', 'silver', 'ash'],
    gray: ['grey', 'gray', 'slate', 'heather', 'charcoal', 'silver', 'ash']
  };

  function matchCard(card, targetColor) {
    let cleanTarget = targetColor.toLowerCase().replace(/all\s+/i, '').trim();
    if (cleanTarget.endsWith('s') && !['burgundy'].includes(cleanTarget)) {
      cleanTarget = cleanTarget.slice(0, -1);
    }
    const family = COLOR_FAMILIES[cleanTarget] || [cleanTarget];

    const cardColors = (card.colors || '').toLowerCase();
    const cardTags = (card.tags || '').toLowerCase();
    const cardTitle = (card.title || '').toLowerCase();

    return family.some(k =>
      cardColors.includes(k) || cardTags.includes(k) || cardTitle.includes(k)
    );
  }

  const sampleProducts = [
    { title: 'Signature Scrub Set', colors: 'black,navy,royal blue', tags: 'scrub,classic', price: 4500 },
    { title: 'The 3p Fulfilled Snowboard', colors: 'multi', tags: 'sports,snowboard', price: 9900 },
    { title: 'Gift Card', colors: '', tags: 'gift', price: 2500 },
    { title: 'Hunter Green Scrub Top', colors: 'hunter green,sage', tags: 'green,scrub', price: 3200 },
    { title: 'Burgundy Classic Scrub', colors: 'burgundy,wine', tags: 'red,scrub', price: 4200 },
    { title: 'Midnight Onyx Scrub Bottom', colors: 'black,onyx', tags: 'bottom,black', price: 3500 },
  ];

  it('1. Filters Black products correctly and excludes non-black products', () => {
    const matched = sampleProducts.filter(p => matchCard(p, 'Black'));
    assert.equal(matched.length, 2, 'Should match exactly 2 black products');
    assert.equal(matched[0].title, 'Signature Scrub Set');
    assert.equal(matched[1].title, 'Midnight Onyx Scrub Bottom');
  });

  it('2. Filters Blue / Navy products correctly', () => {
    const matched = sampleProducts.filter(p => matchCard(p, 'All Blues'));
    assert.equal(matched.length, 1, 'Should match Navy/Royal blue scrub');
    assert.equal(matched[0].title, 'Signature Scrub Set');
  });

  it('3. Filters Green products correctly', () => {
    const matched = sampleProducts.filter(p => matchCard(p, 'All Greens'));
    assert.equal(matched.length, 1, 'Should match Hunter Green scrub');
    assert.equal(matched[0].title, 'Hunter Green Scrub Top');
  });

  it('4. Filters Red / Burgundy products correctly', () => {
    const matched = sampleProducts.filter(p => matchCard(p, 'All Reds'));
    assert.equal(matched.length, 1, 'Should match Burgundy scrub');
    assert.equal(matched[0].title, 'Burgundy Classic Scrub');
  });

  it('5. Handles non-matching filter and triggers empty state condition', () => {
    const matched = sampleProducts.filter(p => matchCard(p, 'Yellow'));
    assert.equal(matched.length, 0, 'No products should match yellow');
  });
});
