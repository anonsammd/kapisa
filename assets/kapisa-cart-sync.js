/**
 * Keeps personalized garment and embroidery service lines paired in the cart.
 */
(function () {
  let isSyncing = false;
  let isRemovingPair = false;

  function cartUrl(endpoint) {
    const root = window.Shopify && window.Shopify.routes && window.Shopify.routes.root
      ? window.Shopify.routes.root
      : '/';
    return `${root}cart${endpoint}`;
  }

  function personalizationId(item) {
    return item.properties && item.properties['_personalization_id'];
  }

  function isServiceLine(item) {
    return Boolean(item.properties && item.properties['Embroidery For']);
  }

  async function changeLine(key, quantity) {
    const response = await fetch(cartUrl('/change.js'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ id: key, quantity })
    });
    const cart = await response.json();
    if (!response.ok) {
      throw new Error(cart.description || cart.message || 'Could not update the cart.');
    }
    return cart;
  }

  function announce(message) {
    const status = document.getElementById('shopping-cart-line-item-status') ||
      document.getElementById('CartDrawer-LineItemStatus');
    if (status) {
      status.textContent = message;
      return;
    }
    const row = document.querySelector('.cart-item[data-personalization-id]');
    if (row) {
      let alert = row.querySelector('[data-kapisa-cart-alert]');
      if (!alert) {
        alert = document.createElement('p');
        alert.dataset.kapisaCartAlert = 'true';
        alert.setAttribute('role', 'alert');
        row.querySelector('.cart-item__details')?.appendChild(alert);
      }
      if (alert) alert.textContent = message;
    }
  }

  async function refreshCart() {
    const response = await fetch(cartUrl('.js'));
    if (!response.ok) throw new Error(`Cart refresh failed (${response.status}).`);
    const cart = await response.json();
    const root = window.Shopify && window.Shopify.routes && window.Shopify.routes.root
      ? window.Shopify.routes.root
      : '/';
    const sectionResponse = await fetch(
      `${root}cart?sections=cart-drawer%2Ccart-icon-bubble&sections_url=${encodeURIComponent(window.location.pathname)}`
    );
    if (!sectionResponse.ok) throw new Error(`Cart section refresh failed (${sectionResponse.status}).`);
    const sections = await sectionResponse.json();

    const cartDrawer = document.querySelector('cart-drawer');
    if (cartDrawer && sections['cart-drawer']) {
      const source = new DOMParser().parseFromString(sections['cart-drawer'], 'text/html').querySelector('.drawer__inner');
      const target = cartDrawer.querySelector('.drawer__inner');
      if (source && target) target.replaceWith(source);
    }
    if (sections['cart-icon-bubble']) {
      const source = new DOMParser().parseFromString(sections['cart-icon-bubble'], 'text/html').querySelector('#cart-icon-bubble');
      const target = document.querySelector('#cart-icon-bubble');
      if (source && target) target.replaceWith(source);
    }

    document.dispatchEvent(new CustomEvent('kapisa:cart-updated', { detail: { cart } }));
    document.dispatchEvent(new CustomEvent('cart:update', { detail: { cart } }));
    if (window.pubsub && window.PUB_SUB_EVENTS) {
      window.pubsub.publish(window.PUB_SUB_EVENTS.cartUpdate, {
        source: 'kapisa-cart-sync',
        cartData: cart
      });
    }
    return cart;
  }

  function markMissingServiceLines(cart) {
    const serviceIds = new Set(
      cart.items.filter(isServiceLine).map(personalizationId).filter(Boolean)
    );
    document.querySelectorAll('.cart-item[data-personalized-line="true"]').forEach((row) => {
      const missing = !serviceIds.has(row.dataset.personalizationId);
      row.dataset.serviceMissing = missing ? 'true' : 'false';
      let warning = row.querySelector('[data-service-missing-warning]');
      if (missing && !warning) {
        warning = document.createElement('p');
        warning.dataset.serviceMissingWarning = 'true';
        warning.setAttribute('role', 'alert');
        warning.textContent = 'Embroidery service line missing. Please remove this personalized garment and add it again.';
        row.querySelector('.cart-item__details')?.appendChild(warning);
      } else if (!missing && warning) {
        warning.remove();
      }
    });
  }

  async function reconcileCart() {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const response = await fetch(cartUrl('.js'));
      if (!response.ok) throw new Error(`Cart check failed (${response.status}).`);
      const cart = await response.json();
      const garmentsById = new Set();
      const servicesById = new Map();

      cart.items.forEach((item) => {
        const id = personalizationId(item);
        if (!id) return;
        if (isServiceLine(item)) {
          const lines = servicesById.get(id) || [];
          lines.push(item);
          servicesById.set(id, lines);
        } else {
          garmentsById.add(id);
        }
      });

      const orphanOrDuplicateServices = [];
      servicesById.forEach((lines, id) => {
        if (!garmentsById.has(id)) {
          orphanOrDuplicateServices.push(...lines);
        } else if (lines.length > 1) {
          orphanOrDuplicateServices.push(...lines.slice(1));
        }
      });

      for (const service of orphanOrDuplicateServices) {
        await changeLine(service.key, 0);
      }

      markMissingServiceLines(cart);
      if (orphanOrDuplicateServices.length) {
        await refreshCart();
      }
    } catch (error) {
      console.error('Kapisa cart reconciliation failed:', error);
      announce('We could not verify the paired embroidery item. Please refresh your cart.');
    } finally {
      isSyncing = false;
    }
  }

  async function removePersonalizedLine(row) {
    if (isRemovingPair) return;
    isRemovingPair = true;
    try {
      const response = await fetch(cartUrl('.js'));
      if (!response.ok) throw new Error(`Cart check failed (${response.status}).`);
      const cart = await response.json();
      const id = row.dataset.personalizationId;
      const pairedLines = cart.items.filter((item) => personalizationId(item) === id);
      for (const item of pairedLines) {
        await changeLine(item.key, 0);
      }
      await refreshCart();
    } catch (error) {
      console.error('Kapisa paired cart removal failed:', error);
      announce(error.message || 'Could not remove the personalized item. Please try again.');
    } finally {
      isRemovingPair = false;
    }
  }

  document.addEventListener('click', (event) => {
    const removeButton = event.target.closest('cart-remove-button');
    if (!removeButton) return;
    const row = removeButton.closest('.cart-item');
    if (!row) return;

    if (row.dataset.serviceLine === 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
      announce('This embroidery service is linked to its garment. Remove the garment to remove both items.');
      return;
    }
    if (row.dataset.personalizedLine === 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
      removePersonalizedLine(row);
    }
  }, true);

  document.addEventListener('change', (event) => {
    const input = event.target.closest('.cart-item[data-personalization-id] input[name="updates[]"]');
    if (!input) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    input.value = input.getAttribute('value');
    announce('Personalized items have a locked quantity. Remove the item and add it again to change the quantity.');
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    reconcileCart();
  });
  document.addEventListener('kapisa:cart-updated', () => {
    reconcileCart();
    window.setTimeout(() => markVisibleServiceLines(), 300);
  });
  document.addEventListener('cart:update', () => {
    reconcileCart();
    window.setTimeout(() => markVisibleServiceLines(), 300);
  });

  function markVisibleServiceLines() {
    document.querySelectorAll('.cart-item[data-service-line="true"]').forEach((row) => {
      row.querySelectorAll('input[name="updates[]"], .quantity__button').forEach((control) => {
        control.disabled = true;
      });
    });
  }
})();
