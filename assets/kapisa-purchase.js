/**
 * KAPISA Purchase Controller & Embroidery Provider Registry
 * Manages atomic add-to-cart operations for main garments + embroidery service items.
 */

if (!window.KapisaPurchase) {
  const embroideryProviders = new Map();
  let addRequestInProgress = false;

  window.KapisaPurchase = {
    registerEmbroideryProvider(id, provider) {
      if (!id || !provider || typeof provider.getItems !== 'function') {
        throw new TypeError('An embroidery provider id and getItems function are required.');
      }
      embroideryProviders.set(id, provider);
    },

    unregisterEmbroideryProvider(id) {
      embroideryProviders.delete(id);
    },

    getActiveEmbroideryItems(context = {}) {
      for (const [id, provider] of embroideryProviders.entries()) {
        if (typeof provider.hasActiveEmbroidery === 'function' && provider.hasActiveEmbroidery()) {
          return provider.getItems(context);
        }
      }
      return null;
    },

    async addFromProvider(id, context = {}) {
      const provider = embroideryProviders.get(id);
      if (!provider) throw new Error('Embroidery setup is unavailable. Refresh the page and try again.');
      const items = await provider.getItems(context);
      return this.addToCart(items, { openCart: false });
    },

    /**
     * Helper to generate a unique personalization ID for pairing lines
     */
    generatePersonalizationId() {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `emb_${window.crypto.randomUUID()}`;
      }
      return 'emb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    },

    /**
     * Reads current variant ID from a form or container element
     */
    getSelectedVariantId(formElement) {
      if (!formElement) return null;
      const idInput = formElement.querySelector('[name="id"]');
      if (idInput && idInput.value) {
        const id = Number(idInput.value);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
      }
      const dataVariant = formElement.dataset.selectedVariantId;
      if (dataVariant) {
        const id = Number(dataVariant);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
      }
      return null;
    },

    /**
     * Submits items array atomically to /cart/add.js
     * @param {Array} items - Array of line items
     * @returns {Promise<Object>} Response JSON from /cart/add.js
     */
    async addToCart(items, options = {}) {
      if (addRequestInProgress) throw new Error('An add-to-cart request is already in progress.');
      if (!Array.isArray(items) || items.length === 0) throw new Error('No cart items were provided.');
      addRequestInProgress = true;
      try {
        const cartRoot = window.Shopify && window.Shopify.routes && window.Shopify.routes.root
          ? window.Shopify.routes.root
          : '/';
        const cartDrawer = document.querySelector('cart-drawer');
        const sections = cartDrawer && typeof cartDrawer.getSectionsToRender === 'function'
          ? cartDrawer.getSectionsToRender().map((section) => section.id)
          : [];
        const response = await fetch(`${cartRoot}cart/add.js`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            items,
            sections,
            sections_url: window.location.pathname
          })
        });

        let data = null;
        try {
          data = await response.json();
        } catch (parseError) {
          data = null;
        }

        // /cart/add.js with an items array is all-or-nothing: if any line is rejected (stock, unavailable
        // variant) Shopify answers 4xx and adds none of them.
        if (!response.ok || !data) {
          const errorMsg = (data && (data.description || data.message)) || 'Unable to add items to cart. Please try again.';
          throw new Error(errorMsg);
        }

        this.notifyCartUpdated(data, items, options);
        return data;
      } catch (error) {
        if (error instanceof TypeError) throw new Error('Network problem. Check your connection and try again.');
        throw error;
      } finally {
        addRequestInProgress = false;
      }
    },

    /**
     * Dispatches standard cart update events across Dawn / Kapisa theme
     */
    notifyCartUpdated(cartData, itemsAdded, options = {}) {
      document.dispatchEvent(
        new CustomEvent('kapisa:cart-updated', {
          detail: { cart: cartData, items: itemsAdded }
        })
      );

      document.dispatchEvent(
        new CustomEvent('cart:update', {
          detail: { cart: cartData, items: itemsAdded }
        })
      );

      if (window.pubsub && window.PUB_SUB_EVENTS) {
        window.pubsub.publish(window.PUB_SUB_EVENTS.cartUpdate, {
          source: 'kapisa-purchase',
          cartData
        });
      }

      const cartDrawer = document.querySelector('cart-drawer');
      if (!cartDrawer || !cartData.sections) return;
      if (options.openCart !== false && typeof cartDrawer.renderContents === 'function') {
        cartDrawer.renderContents(cartData);
        return;
      }

      const drawerHtml = cartData.sections['cart-drawer'];
      const bubbleHtml = cartData.sections['cart-icon-bubble'];
      if (drawerHtml) {
        const source = new DOMParser().parseFromString(drawerHtml, 'text/html').querySelector('.drawer__inner');
        const target = cartDrawer.querySelector('.drawer__inner');
        if (source && target) target.replaceWith(source);
      }
      if (bubbleHtml) {
        const source = new DOMParser().parseFromString(bubbleHtml, 'text/html').querySelector('#cart-icon-bubble');
        const target = document.querySelector('#cart-icon-bubble');
        if (source && target) target.replaceWith(source);
      }
    }
  };
}
