/**
 * KAPISA Custom Embroidery — Knya Medical Apparel Edition
 * Live preview on left chest, single top image, icon overlay on right chest,
 * modal configuration, PDP summary card with mini-preview & edit pencil,
 * and deferred atomic add-to-cart on main product form submission.
 */
(() => {
  if (customElements.get('kapisa-embroidery')) return;

  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    const num = Number(cents) || 0;
    let formatString = format || window.theme?.moneyFormat || '{{amount}}';
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

  let scrollLocks = 0;

  class KapisaEmbroidery extends HTMLElement {
    connectedCallback() {
      if (this._ready) {
        this.placeTrigger();
        return;
      }

      const cfgEl = this.querySelector('[data-kemb-config]');
      this.dialog = this.querySelector('[data-kemb-dialog]');
      if (!cfgEl || !this.dialog) return;

      try {
        this.cfg = JSON.parse(cfgEl.textContent);
      } catch (e) {
        console.error('Kapisa Embroidery: Invalid config JSON', e);
        return;
      }

      this._ready = true;
      this.max = Number(this.dataset.max) || 22;
      this.needAck = this.dataset.ack === 'true';
      this.options = (this.cfg.options || []).slice().sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
      this.icons = window.KAPISA_EMBROIDERY_ICONS || [];

      // Embroidery active state for PDP and cart integration
      this.isConfigured = false;
      this.isActive = false;

      // Application State
      this.state = {
        option: this.options.find(o => o.kind === 'top') || this.options[0] || null,
        step: 'choose',
        line1: '',
        line2: '',
        bottomText: '',
        threadColor: { name: 'White', hex: '#FFFFFF' },
        fontType: 'block', // 'block' or 'script'
        bottomAddon: false,
        iconEnabled: false,
        selectedIcon: null,
        customLogoData: null,
        customLogoName: '',
        ack: false
      };

      this.q = (s) => this.dialog ? this.dialog.querySelector(s) : null;
      this.qa = (s) => this.dialog ? [...this.dialog.querySelectorAll(s)] : [];
      this.triggerWrap = this.querySelector('[data-kemb-trigger-wrap]');
      this.qt = (s) => (this.triggerWrap || this).querySelector(s);
      this.qat = (s) => (this.triggerWrap || this).querySelectorAll(s);

      // Elements inside Modal
      this.stage = this.q('[data-kemb-stage]');
      this.img = this.q('[data-kemb-img]');
      this.zoneText = this.q('[data-kemb-zone-text]');
      this.line1El = this.q('[data-kemb-line="1"]');
      this.line2El = this.q('[data-kemb-line="2"]');
      this.zoneIcon = this.q('[data-kemb-zone-icon]');
      this.iconDisplay = this.q('[data-kemb-icon-display]');

      this.inputs = {
        1: this.q('[data-kemb-input="1"]'),
        2: this.q('[data-kemb-input="2"]'),
        bottom: this.q('[data-kemb-input="bottom"]')
      };

      // Elements on PDP Card
      this.initialView = this.qt('[data-kemb-initial-view]');
      this.configuredView = this.qt('[data-kemb-configured-view]');

      this.bind();
      this.placeTrigger();
      this.renderChooser();
      this.renderIcons();

      // Initialize UI state: apply show/hide logic and sync from state
      if (this.state.option) {
        this.syncModalFromState();
      }

      // Register provider with KapisaPurchase
      if (window.KapisaPurchase && typeof window.KapisaPurchase.registerEmbroideryProvider === 'function') {
        window.KapisaPurchase.registerEmbroideryProvider(this.dataset.sectionId || 'pdp-embroidery', {
          hasActiveEmbroidery: () => this.isEmbroideryActive(),
          getItems: (context) => this.buildCartItems(context)
        });
      }
    }

    disconnectedCallback() {
      if (this.locked) this.unlock();
      if (window.KapisaPurchase && typeof window.KapisaPurchase.unregisterEmbroideryProvider === 'function') {
        window.KapisaPurchase.unregisterEmbroideryProvider(this.dataset.sectionId || 'pdp-embroidery');
      }
    }

    placeTrigger() {
      if (!this.triggerWrap) return;
      const hook = document.querySelector('[data-kapisa-embroidery-hook]');
      if (hook && this.triggerWrap.parentElement !== hook) {
        hook.appendChild(this.triggerWrap);
      } else if (!hook && !this.triggerWrap.isConnected) {
        this.prepend(this.triggerWrap);
      }
    }

    bind() {
      // 1. PDP Initial Card: Radios
      const radioAdd = this.qt('[data-kemb-radio-add]');
      const radioSkip = this.qt('[data-kemb-radio-skip]');

      radioAdd?.addEventListener('click', () => {
        this.open();
      });

      radioSkip?.addEventListener('change', () => {
        if (radioSkip.checked) {
          this.isActive = false;
        }
      });

      // 2. PDP Configured Card: Checkbox, Delete, Edit
      const cfgToggle = this.qt('[data-kemb-cfg-toggle]');
      cfgToggle?.addEventListener('change', () => {
        this.isActive = cfgToggle.checked;
      });

      const cfgDelete = this.qt('[data-kemb-cfg-delete]');
      cfgDelete?.addEventListener('click', () => {
        this.removeCustomization();
      });

      const cfgEdit = this.qt('[data-kemb-cfg-edit]');
      cfgEdit?.addEventListener('click', () => {
        this.open();
      });

      // 3. Modal Header / Navigation
      this.q('[data-kemb-close]')?.addEventListener('click', () => {
        this.dialog.close();
        // If not configured yet, make sure radio shows skip
        const curSkip = this.qt('[data-kemb-radio-skip]');
        if (!this.isConfigured && curSkip) {
          curSkip.checked = true;
        }
      });

      this.q('[data-kemb-back]')?.addEventListener('click', () => {
        this.showStep('choose');
      });

      this.dialog.addEventListener('close', () => {
        if (this.locked) this.unlock();
        const curSkip = this.qt('[data-kemb-radio-skip]');
        if (!this.isConfigured && curSkip) {
          curSkip.checked = true;
        }
      });

      let downOnBackdrop = false;
      this.dialog.addEventListener('mousedown', (e) => (downOnBackdrop = e.target === this.dialog));
      this.dialog.addEventListener('click', (e) => {
        if (e.target === this.dialog && downOnBackdrop) {
          this.dialog.close();
          if (!this.isConfigured && radioSkip) radioSkip.checked = true;
        }
      });

      // 4. Modal Inputs
      [1, 2, 'bottom'].forEach((key) => {
        const inp = this.inputs[key];
        inp?.addEventListener('input', () => {
          let val = String(inp.value || '').slice(0, this.max);
          inp.value = val;
          if (key === 1) this.state.line1 = val;
          else if (key === 2) this.state.line2 = val;
          else if (key === 'bottom') this.state.bottomText = val;
          this.updateCounter(key, val.length);
          this.clearError(key);
          this.renderPreview();
        });
      });

      // 5. Color Swatches
      const swatches = this.qa('.kemb-swatch-btn');
      swatches.forEach((btn) => {
        btn.addEventListener('click', () => {
          swatches.forEach((b) => {
            b.classList.remove('is-active');
            b.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('is-active');
          btn.setAttribute('aria-checked', 'true');
          this.state.threadColor = {
            name: btn.dataset.colorName,
            hex: btn.dataset.colorHex
          };
          this.q('[data-kemb-color-name]').textContent = this.state.threadColor.name;
          this.renderPreview();
        });
      });

      // Initialize the default thread color swatch as active
      const defaultSwatch = swatches.find(
        (s) => s.dataset.colorName === this.state.threadColor.name
      ) || swatches[0];
      if (defaultSwatch) {
        defaultSwatch.classList.add('is-active');
        defaultSwatch.setAttribute('aria-checked', 'true');
        // Sync state from the actual default swatch so hex is correct
        this.state.threadColor = {
          name: defaultSwatch.dataset.colorName || this.state.threadColor.name,
          hex: defaultSwatch.dataset.colorHex || this.state.threadColor.hex
        };
        const colorNameEl = this.q('[data-kemb-color-name]');
        if (colorNameEl) colorNameEl.textContent = this.state.threadColor.name;
      }

      // 6. Font Toggle (AA Block vs Aa Script)
      this.qa('.kemb-font-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.qa('.kemb-font-toggle').forEach((b) => {
            b.classList.remove('is-active');
            b.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('is-active');
          btn.setAttribute('aria-checked', 'true');
          this.state.fontType = btn.dataset.kembFont;
          this.renderPreview();
        });
      });

      // 7. Addon Toggles
      const bottomSwitch = this.q('[data-kemb-bottom-switch]');
      bottomSwitch?.addEventListener('change', () => {
        this.state.bottomAddon = bottomSwitch.checked;
        this.updateSummaryBar();
      });

      const iconCheckbox = this.q('[data-kemb-icon-checkbox]');
      iconCheckbox?.addEventListener('change', () => {
        this.state.iconEnabled = iconCheckbox.checked;
        const iconContent = this.q('[data-kemb-icon-content]');
        if (iconContent) {
          iconContent.hidden = !this.state.iconEnabled;
          iconContent.style.display = this.state.iconEnabled ? '' : 'none';
        }
        // When unchecked, clear any previously selected icon/logo so it doesn't persist
        if (!this.state.iconEnabled) {
          this.state.selectedIcon = null;
          this.clearCustomLogo();
          this.qa('.kemb-icon-card').forEach((c) => c.classList.remove('is-active'));
          const iconNameEl = this.q('[data-kemb-icon-name]');
          if (iconNameEl) iconNameEl.textContent = 'None';
        }
        this.updateSummaryBar();
        this.renderPreview();
      });

      // 8. Custom Logo Upload
      const logoInput = this.q('[data-kemb-logo-upload]');
      logoInput?.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          alert('Uploaded logo file must be 5MB or less.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.state.customLogoData = ev.target.result;
          this.state.customLogoName = file.name;
          this.state.selectedIcon = null;
          this.qa('.kemb-icon-card').forEach((c) => c.classList.remove('is-active'));
          this.q('[data-kemb-icon-name]').textContent = 'Custom Logo';

          const previewWrap = this.q('[data-kemb-upload-preview]');
          const uploadContent = this.q('[data-kemb-upload-content]');
          const previewImg = this.q('[data-kemb-upload-img]');
          if (previewWrap && previewImg) {
            previewImg.src = this.state.customLogoData;
            previewWrap.hidden = false;
            previewWrap.style.display = '';
            if (uploadContent) {
              uploadContent.hidden = true;
              uploadContent.style.display = 'none';
            }
          }
          this.renderPreview();
        };
        reader.readAsDataURL(file);
      });

      this.q('[data-kemb-upload-remove]')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.clearCustomLogo();
        this.renderPreview();
      });

      // 9. Reset Button
      this.q('[data-kemb-reset]')?.addEventListener('click', () => this.resetForm());

      // 10. Proceed Button: DOES NOT add to cart; updates PDP card & closes modal!
      this.q('[data-kemb-submit]')?.addEventListener('click', () => this.proceedCustomization());
    }

    clearCustomLogo() {
      this.state.customLogoData = null;
      this.state.customLogoName = '';
      const input = this.q('[data-kemb-logo-upload]');
      if (input) input.value = '';
      const previewWrap = this.q('[data-kemb-upload-preview]');
      const uploadContent = this.q('[data-kemb-upload-content]');
      if (previewWrap) {
        previewWrap.hidden = true;
        previewWrap.style.display = 'none';
      }
      if (uploadContent) {
        uploadContent.hidden = false;
        uploadContent.style.display = '';
      }
    }

    open() {
      this.lock();
      this.syncModalFromState();
      this.dialog.showModal();
      this.showStep(this.state.option ? 'custom' : 'choose');
    }

    lock() {
      if (this.locked) return;
      this.locked = true;
      if (!scrollLocks++) document.documentElement.classList.add('kemb-lock');
    }

    unlock() {
      this.locked = false;
      if (scrollLocks > 0 && !--scrollLocks) document.documentElement.classList.remove('kemb-lock');
    }

    showStep(step) {
      this.state.step = step;
      this.qa('[data-kemb-step]').forEach((el) => {
        el.hidden = el.dataset.kembStep !== step;
      });

      const isCustom = step === 'custom';
      this.q('[data-kemb-back]').hidden = !isCustom;
      this.q('[data-kemb-summary-bar]').hidden = !isCustom;
      this.q('[data-kemb-footer]').hidden = !isCustom;

      const titleEl = this.q('.kemb-heading');
      if (step === 'choose') {
        titleEl.textContent = this.cfg.modal_heading || 'Add Your Identity';
      } else if (isCustom && this.state.option) {
        titleEl.textContent = this.state.option.label;
      }

      this.q('.kemb-body').scrollTop = 0;
      this.renderPreview();
    }

    renderChooser() {
      const container = this.q('[data-kemb-card-list]');
      if (!container) return;
      container.innerHTML = '';

      // Ensure exact order: combo (bundle) -> or -> top -> bottom
      const orderMap = { combo: 1, top: 2, bottom: 3 };
      const sorted = this.options.slice().sort((a, b) => {
        return (orderMap[a.kind] || 99) - (orderMap[b.kind] || 99);
      });

      sorted.forEach((opt, idx) => {
        if (idx === 1) {
          const div = document.createElement('div');
          div.className = 'kemb-card-divider';
          div.innerHTML = '<span>or</span>';
          container.appendChild(div);
        }

        const card = document.createElement('div');
        const isActive = this.state.option && this.state.option.handle === opt.handle;
        card.className = `kemb-card ${isActive ? 'is-active' : ''}`;
        card.dataset.handle = opt.handle;

        let badgeHtml = '';
        if (opt.badge) {
          const badgeClass = opt.kind === 'combo' ? 'kemb-card__badge--green' : 'kemb-card__badge--red';
          badgeHtml = `<span class="kemb-card__badge ${badgeClass}">${opt.badge}</span>`;
        }

        let priceHtml = `<span class="kemb-card__price">${opt.formattedPrice}</span>`;
        if (opt.kind === 'combo') {
          const topOpt = this.options.find(o => o.kind === 'top');
          const botOpt = this.options.find(o => o.kind === 'bottom');
          let origPrice = '';
          if (topOpt && botOpt) {
            origPrice = formatMoney(Number(topOpt.price) + Number(botOpt.price), this.cfg.moneyFormat);
          }
          priceHtml = `
            <div class="kemb-card__price-wrap" style="text-align: right;">
              ${origPrice ? `<span class="kemb-price-original">${origPrice}</span>` : ''}
              <span class="kemb-card__price">${opt.formattedPrice}</span>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="kemb-card__radio"></div>
          <div class="kemb-card__content">
            <div class="kemb-card__top">
              <div class="kemb-card__title-wrap">
                <span class="kemb-card__title">${opt.label}</span>
                ${badgeHtml}
              </div>
              ${priceHtml}
            </div>
            <div class="kemb-card__desc">${opt.description || ''}</div>
          </div>
        `;

        card.addEventListener('click', () => {
          this.qa('.kemb-card').forEach((c) => c.classList.remove('is-active'));
          card.classList.add('is-active');
          this.selectOption(opt);
        });

        container.appendChild(card);
      });
    }

    // Applies field and section visibility rules strictly according to the selected option
    _applyOptionVisibility(opt) {
      if (!opt) return;
      const kind = opt.kind;
      const isBottom = kind === 'bottom';
      const isCombo = kind === 'combo';
      const isTop = kind === 'top';

      // Text fields
      const f1 = this.q('[data-kemb-field="line1"]');
      const f2 = this.q('[data-kemb-field="line2"]');
      const fb = this.q('[data-kemb-field="bottom_text"]');
      if (f1) { f1.hidden = isBottom; f1.style.display = isBottom ? 'none' : ''; }
      if (f2) { f2.hidden = isBottom; f2.style.display = isBottom ? 'none' : ''; }
      if (fb) { fb.hidden = !isBottom; fb.style.display = !isBottom ? 'none' : ''; }

      // Bottom Addon (Only visible on Top! Strictly hidden on Bottom & Combo)
      const bottomAddon = this.q('[data-kemb-bottom-addon]');
      if (bottomAddon) {
        bottomAddon.hidden = !isTop;
        bottomAddon.style.display = isTop ? '' : 'none';
      }

      // Bundle Banner (Only visible on Combo!)
      const bundleBanner = this.q('[data-kemb-bundle-banner]');
      if (bundleBanner) {
        bundleBanner.hidden = !isCombo;
        bundleBanner.style.display = isCombo ? '' : 'none';
      }

      // Icon section (Strictly hidden for Bottom)
      const iconSec = this.q('[data-kemb-section-icon]');
      const iconToggleBar = this.q('[data-kemb-icon-toggle-bar]');
      const iconContent = this.q('[data-kemb-icon-content]');

      if (iconSec) {
        if (isBottom) {
          iconSec.hidden = true;
          iconSec.style.display = 'none';
        } else {
          iconSec.hidden = false;
          iconSec.style.display = '';
          if (isCombo) {
            if (iconToggleBar) { iconToggleBar.hidden = true; iconToggleBar.style.display = 'none'; }
            if (iconContent) { iconContent.hidden = false; iconContent.style.display = ''; }
            this.state.iconEnabled = true;
          } else {
            // top
            if (iconToggleBar) { iconToggleBar.hidden = false; iconToggleBar.style.display = ''; }
            const chk = this.q('[data-kemb-icon-checkbox]');
            const enabled = chk ? chk.checked : this.state.iconEnabled;
            if (iconContent) {
              iconContent.hidden = !enabled;
              iconContent.style.display = enabled ? '' : 'none';
            }
          }
        }
      }

      // Update hint
      const hint1 = this.q('[data-kemb-hint="1"]');
      if (hint1) {
        hint1.textContent = isCombo ? '*on both top and bottom' : "*Above top's left pocket";
      }
    }

    // Full synchronization from internal state into modal controls
    syncModalFromState() {
      if (!this.state.option) return;

      // 1. Chooser cards active state
      this.qa('.kemb-card').forEach((c) => {
        c.classList.toggle('is-active', c.dataset.handle === this.state.option.handle);
      });

      // 2. Field & section visibility
      this._applyOptionVisibility(this.state.option);

      // 3. Inputs & counters
      if (this.inputs[1]) {
        this.inputs[1].value = this.state.line1 || '';
        this.updateCounter(1, (this.state.line1 || '').length);
        this.clearError(1);
      }
      if (this.inputs[2]) {
        this.inputs[2].value = this.state.line2 || '';
        this.updateCounter(2, (this.state.line2 || '').length);
        this.clearError(2);
      }
      if (this.inputs.bottom) {
        this.inputs.bottom.value = this.state.bottomText || '';
        this.updateCounter('bottom', (this.state.bottomText || '').length);
        this.clearError('bottom');
      }

      // 4. Color swatches
      this.qa('.kemb-swatch-btn').forEach((btn) => {
        const match = btn.dataset.colorName === this.state.threadColor.name;
        btn.classList.toggle('is-active', match);
        btn.setAttribute('aria-checked', match ? 'true' : 'false');
      });
      const colorNameEl = this.q('[data-kemb-color-name]');
      if (colorNameEl) colorNameEl.textContent = this.state.threadColor.name;

      // 5. Font toggle
      this.qa('.kemb-font-toggle').forEach((btn) => {
        const match = btn.dataset.kembFont === this.state.fontType;
        btn.classList.toggle('is-active', match);
        btn.setAttribute('aria-checked', match ? 'true' : 'false');
      });

      // 6. Bottom addon switch
      const bottomSwitch = this.q('[data-kemb-bottom-switch]');
      if (bottomSwitch) {
        bottomSwitch.checked = Boolean(this.state.bottomAddon);
      }

      // 7. Icon checkbox & content
      const iconCheckbox = this.q('[data-kemb-icon-checkbox]');
      if (iconCheckbox) {
        iconCheckbox.checked = Boolean(this.state.iconEnabled);
      }
      const iconContent = this.q('[data-kemb-icon-content]');
      if (iconContent) {
        iconContent.hidden = !this.state.iconEnabled;
        iconContent.style.display = this.state.iconEnabled ? '' : 'none';
      }

      // 8. Icon cards selection
      this.qa('.kemb-icon-card').forEach((c) => {
        const match = Boolean(
          this.state.iconEnabled &&
          this.state.selectedIcon &&
          c.dataset.iconId === this.state.selectedIcon.id
        );
        c.classList.toggle('is-active', match);
      });
      const iconNameEl = this.q('[data-kemb-icon-name]');
      if (iconNameEl) {
        if (this.state.iconEnabled && this.state.selectedIcon) {
          iconNameEl.textContent = this.state.selectedIcon.name;
        } else if (this.state.iconEnabled && this.state.customLogoName) {
          iconNameEl.textContent = `Custom (${this.state.customLogoName})`;
        } else {
          iconNameEl.textContent = 'None';
        }
      }

      // 9. Summary bar & preview
      this.updateSummaryBar();
      this.renderPreview();
    }

    selectOption(opt) {
      this.state.option = opt;
      // If switching away from top, reset bottom addon
      if (opt.kind !== 'top') {
        this.state.bottomAddon = false;
        const bottomSwitch = this.q('[data-kemb-bottom-switch]');
        if (bottomSwitch) bottomSwitch.checked = false;
      }
      if (opt.kind === 'bottom') {
        this.state.iconEnabled = false;
        this.state.selectedIcon = null;
        this.clearCustomLogo();
      }
      this._applyOptionVisibility(opt);
      this.updateSummaryBar();
      this.showStep('custom');
    }

    renderIcons() {
      const classicGrid = this.q('[data-kemb-classic-grid]');
      const limitedGrid = this.q('[data-kemb-limited-grid]');
      if (!classicGrid || !limitedGrid) return;

      classicGrid.innerHTML = '';
      limitedGrid.innerHTML = '';

      this.icons.forEach((ico) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'kemb-icon-card';
        card.dataset.iconId = ico.id;
        card.setAttribute('aria-label', ico.name);
        card.innerHTML = ico.svg;

        card.addEventListener('click', () => {
          if (this.state.selectedIcon && this.state.selectedIcon.id === ico.id) {
            this.state.selectedIcon = null;
            card.classList.remove('is-active');
            this.q('[data-kemb-icon-name]').textContent = 'None';
          } else {
            this.qa('.kemb-icon-card').forEach((c) => c.classList.remove('is-active'));
            card.classList.add('is-active');
            this.state.selectedIcon = ico;
            this.clearCustomLogo();
            this.q('[data-kemb-icon-name]').textContent = ico.name;
          }
          this.updateSummaryBar();
          this.renderPreview();
        });

        if (ico.category === 'limited') {
          limitedGrid.appendChild(card);
        } else {
          classicGrid.appendChild(card);
        }
      });
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

    updateSummaryBar() {
      const opt = this.getEffectiveOption();
      if (!opt) return;

      let typeLabel = 'Text';
      const hasIcon = (this.state.iconEnabled || opt.kind === 'combo') && (this.state.selectedIcon || this.state.customLogoData);

      if (opt.kind === 'combo') {
        typeLabel = hasIcon ? 'Both Text + Icon' : 'Both Text';
      } else if (opt.kind === 'top') {
        typeLabel = hasIcon ? 'Text + Icon' : 'Text';
      } else if (opt.kind === 'bottom') {
        typeLabel = 'Bottom Text';
      }

      this.q('[data-kemb-selected-type]').textContent = typeLabel;

      const { total, orig } = this.getComputedPrice();
      const origEl = this.q('[data-kemb-orig-price]');
      const currEl = this.q('[data-kemb-curr-price]');

      if (orig > total) {
        origEl.textContent = formatMoney(orig, this.cfg.moneyFormat);
        origEl.hidden = false;
      } else {
        origEl.hidden = true;
      }

      currEl.textContent = formatMoney(total, this.cfg.moneyFormat);
    }

    renderPreview() {
      const opt = this.getEffectiveOption();
      if (!opt) return;

      const kind = opt.kind;
      const isBottom = kind === 'bottom';

      // Switch stage image based on kind if configured
      const imgConfig = (this.cfg.previewImages && this.cfg.previewImages[kind]) || this.cfg.previewImage;
      if (imgConfig && imgConfig.url && this.img && this.img.getAttribute('src') !== imgConfig.url) {
        this.img.src = imgConfig.url;
      }

      // 1. Text on Left Chest (above pocket)
      if (isBottom) {
        this.zoneText.hidden = true;
        this.line1El.textContent = '';
        this.line2El.textContent = '';
      } else {
        this.zoneText.hidden = false;
        this.zoneText.style.setProperty('--kemb-thread-color', this.state.threadColor.hex);
        this.zoneText.classList.toggle('font--block', this.state.fontType === 'block');
        this.zoneText.classList.toggle('font--script', this.state.fontType === 'script');

        this.line1El.textContent = this.state.line1 || '';
        this.line2El.textContent = this.state.line2 || '';

        const maxLen = Math.max((this.state.line1 || '').length, (this.state.line2 || '').length);
        let baseSize = this.state.fontType === 'script' ? 16 : 14;
        if (maxLen > 15) baseSize -= 3;
        else if (maxLen > 10) baseSize -= 1.5;
        this.line1El.style.fontSize = `${baseSize}px`;
        this.line2El.style.fontSize = `${baseSize * 0.9}px`;
      }

      // 2. Icon on Right Chest
      const hasIcon = !isBottom && (this.state.iconEnabled || kind === 'combo');
      if (hasIcon && this.state.selectedIcon) {
        this.zoneIcon.hidden = false;
        this.iconDisplay.innerHTML = this.state.selectedIcon.svg;
      } else if (hasIcon && this.state.customLogoData) {
        this.zoneIcon.hidden = false;
        this.iconDisplay.innerHTML = `<img src="${this.state.customLogoData}" alt="Custom Logo" width="48" height="48">`;
      } else {
        this.zoneIcon.hidden = true;
        this.iconDisplay.innerHTML = '';
      }
    }

    updateCounter(key, count) {
      const c = this.q(`[data-kemb-count="${key}"]`);
      if (c) c.textContent = `${count}/${this.max}`;
    }

    clearError(key) {
      const el = this.q(`[data-kemb-err="${key}"]`);
      if (el) el.textContent = '';
    }

    setError(key, msg) {
      const el = this.q(`[data-kemb-err="${key}"]`);
      if (el) el.textContent = msg;
    }

    resetForm() {
      this.state.line1 = '';
      this.state.line2 = '';
      this.state.bottomText = '';
      this.state.selectedIcon = null;
      this.state.bottomAddon = false;
      this.state.iconEnabled = false;
      this.clearCustomLogo();

      Object.values(this.inputs).forEach((inp) => inp && (inp.value = ''));
      [1, 2, 'bottom'].forEach((k) => {
        this.updateCounter(k, 0);
        this.clearError(k);
      });

      const bottomSwitch = this.q('[data-kemb-bottom-switch]');
      if (bottomSwitch) bottomSwitch.checked = false;

      const iconCheckbox = this.q('[data-kemb-icon-checkbox]');
      if (iconCheckbox) iconCheckbox.checked = false;
      const iconContent = this.q('[data-kemb-icon-content]');
      if (iconContent) {
        iconContent.hidden = true;
        iconContent.style.display = 'none';
      }

      this.qa('.kemb-icon-card').forEach((c) => c.classList.remove('is-active'));
      this.q('[data-kemb-icon-name]').textContent = 'None';

      this.updateSummaryBar();
      this.renderPreview();
    }

    /* ---------- PROCEED CUSTOMIZATION (Closes modal & updates PDP card) ---------- */
    proceedCustomization() {
      const opt = this.getEffectiveOption();
      if (!opt) return;

      const isBottom = opt.kind === 'bottom';
      const isCombo = opt.kind === 'combo';
      const isTop = opt.kind === 'top';

      // Read current values directly from modal inputs to be 100% in sync
      if (isBottom) {
        this.state.bottomText = (this.inputs.bottom ? this.inputs.bottom.value : this.state.bottomText || '').trim();
        this.state.iconEnabled = false;
        this.state.selectedIcon = null;
        this.clearCustomLogo();
        this.state.bottomAddon = false;
      } else {
        if (this.inputs[1]) this.state.line1 = this.inputs[1].value.trim();
        if (this.inputs[2]) this.state.line2 = this.inputs[2].value.trim();

        if (isCombo) {
          this.state.iconEnabled = true;
        } else if (isTop) {
          const iconCheckbox = this.q('[data-kemb-icon-checkbox]');
          this.state.iconEnabled = Boolean(iconCheckbox && iconCheckbox.checked);
          if (!this.state.iconEnabled) {
            this.state.selectedIcon = null;
            this.clearCustomLogo();
          }
        }
      }

      // Validation
      let hasError = false;
      if (isBottom) {
        if (!this.state.bottomText) {
          this.setError('bottom', 'Please enter your name for bottom scrub.');
          hasError = true;
        }
      } else {
        if (!this.state.line1) {
          this.setError(1, 'Please enter text for line 1.');
          hasError = true;
        }
      }

      if (this.needAck && !this.q('[data-kemb-ack]')?.checked) {
        this.setError('ack', 'Please confirm to continue.');
        hasError = true;
      }

      if (hasError) return;

      // Mark configured & active
      this.isConfigured = true;
      this.isActive = true;

      // Update the PDP Configured Summary Card
      this.updatePdpSummaryCard();

      // Switch views on PDP
      if (this.initialView) {
        this.initialView.hidden = true;
        this.initialView.style.display = 'none';
      }
      if (this.configuredView) {
        this.configuredView.hidden = false;
        this.configuredView.style.display = '';
      }

      // Close modal
      this.dialog.close();
    }

    updatePdpSummaryCard() {
      const opt = this.getEffectiveOption();
      if (!opt) return;

      const { total } = this.getComputedPrice();
      const isBottom = opt.kind === 'bottom';
      const isCombo = opt.kind === 'combo';
      const hasIcon = !isBottom && (this.state.iconEnabled || isCombo) && Boolean(this.state.selectedIcon || this.state.customLogoData || this.state.customLogoName);

      // Price
      const priceEl = this.qt('[data-kemb-cfg-price]');
      if (priceEl) priceEl.textContent = formatMoney(total, this.cfg.moneyFormat);

      // Checkbox
      const chk = this.qt('[data-kemb-cfg-toggle]');
      if (chk) chk.checked = true;

      // Mini Preview Box
      const miniPreview = this.qt('[data-kemb-cfg-preview]');
      const miniLine1 = this.qt('[data-kemb-cfg-mini-line1]');
      const miniLine2 = this.qt('[data-kemb-cfg-mini-line2]');
      const miniIcon = this.qt('[data-kemb-cfg-mini-icon]');

      if (miniPreview) {
        miniPreview.classList.toggle('font--block', this.state.fontType === 'block');
        miniPreview.classList.toggle('font--script', this.state.fontType === 'script');
        miniPreview.style.setProperty('--mini-thread-color', this.state.threadColor.hex);
      }

      if (isBottom) {
        if (miniLine1) {
          miniLine1.textContent = this.state.bottomText.trim();
          miniLine1.style.color = this.state.threadColor.hex;
        }
        if (miniLine2) miniLine2.textContent = '(Bottom Scrub)';
        if (miniIcon) {
          miniIcon.innerHTML = '';
          miniIcon.hidden = true;
          miniIcon.style.display = 'none';
        }
      } else {
        if (miniLine1) {
          miniLine1.textContent = this.state.line1.trim();
          miniLine1.style.color = this.state.threadColor.hex;
        }
        if (miniLine2) {
          miniLine2.textContent = this.state.line2.trim();
          miniLine2.style.color = this.state.threadColor.hex;
        }
        if (miniIcon) {
          if (hasIcon && this.state.selectedIcon) {
            miniIcon.innerHTML = this.state.selectedIcon.svg;
            miniIcon.hidden = false;
            miniIcon.style.display = '';
          } else {
            miniIcon.innerHTML = '';
            miniIcon.hidden = true;
            miniIcon.style.display = 'none';
          }
        }
      }

      // Details Column
      const typeEl = this.qt('[data-kemb-cfg-type]');
      if (typeEl) {
        if (isCombo) typeEl.textContent = 'Embroidery Bundle';
        else if (isBottom) typeEl.textContent = 'Bottom Embroidery';
        else typeEl.textContent = hasIcon ? 'Text + Icon' : 'Text';
      }

      const posEl = this.qt('[data-kemb-cfg-pos]');
      if (posEl) {
        if (isCombo) posEl.textContent = 'Left Chest & Bottom';
        else if (isBottom) posEl.textContent = 'Scrub Bottom';
        else posEl.textContent = 'Left Chest';
      }

      const textVal = this.qt('[data-kemb-cfg-text-val]');
      if (textVal) {
        if (isBottom) {
          textVal.textContent = this.state.bottomText.trim();
        } else {
          textVal.textContent = this.state.line2.trim()
            ? `${this.state.line1.trim()}, ${this.state.line2.trim()}`
            : this.state.line1.trim();
        }
      }

      const colorVal = this.qt('[data-kemb-cfg-color-val]');
      if (colorVal) colorVal.textContent = this.state.threadColor.name;

      const fontVal = this.qt('[data-kemb-cfg-font-val]');
      if (fontVal) fontVal.textContent = this.state.fontType === 'script' ? 'Script' : 'Block';

      const iconRow = this.qt('[data-kemb-cfg-icon-row]');
      const iconVal = this.qt('[data-kemb-cfg-icon-val]');
      if (iconRow && iconVal) {
        if (hasIcon && this.state.selectedIcon) {
          iconVal.textContent = this.state.selectedIcon.name;
          iconRow.hidden = false;
          iconRow.style.display = '';
        } else if (hasIcon && this.state.customLogoName) {
          iconVal.textContent = `Custom (${this.state.customLogoName})`;
          iconRow.hidden = false;
          iconRow.style.display = '';
        } else {
          iconVal.textContent = '';
          iconRow.hidden = true;
          iconRow.style.display = 'none';
        }
      }
    }

    removeCustomization() {
      this.isConfigured = false;
      this.isActive = false;
      this.resetForm();

      if (this.configuredView) {
        this.configuredView.hidden = true;
        this.configuredView.style.display = 'none';
      }
      if (this.initialView) {
        this.initialView.hidden = false;
        this.initialView.style.display = '';
        const skipRadio = this.qt('[data-kemb-radio-skip]');
        if (skipRadio) skipRadio.checked = true;
      }
    }

    /* ---------- CART INTEGRATION (Invoked by main Product Add-To-Cart) ---------- */
    isEmbroideryActive() {
      return Boolean(this.isConfigured && this.isActive);
    }

    buildCartItems(context = {}) {
      if (!this.isEmbroideryActive()) return null;

      const opt = this.getEffectiveOption();
      if (!opt) return null;

      const garmentVariantId = Number(context.variantId);
      const quantity = Number(context.quantity) || 1;
      const serviceVariantId = Number(opt.variantId);

      if (!garmentVariantId || !serviceVariantId) return null;

      const isBottom = opt.kind === 'bottom';
      const isCombo = opt.kind === 'combo';
      const hasIcon = !isBottom && (this.state.iconEnabled || isCombo) && Boolean(this.state.selectedIcon || this.state.customLogoName);
      const pId = window.KapisaPurchase ? window.KapisaPurchase.generatePersonalizationId() : `emb_${Date.now()}`;

      const visible = {
        'Embroidery': opt.label,
        'Color': this.state.threadColor.name,
        'Font': this.state.fontType === 'script' ? 'Script' : 'Block'
      };

      if (isBottom) {
        visible['first_name'] = this.state.bottomText.trim();
      } else {
        visible['first_name'] = this.state.line1.trim();
        if (this.state.line2.trim()) visible['designation'] = this.state.line2.trim();
        if (isCombo || this.state.bottomAddon) {
          visible['bottom_name'] = this.state.line1.trim();
        }
      }

      if (hasIcon && this.state.selectedIcon) {
        visible['Icon'] = this.state.selectedIcon.name;
      } else if (hasIcon && this.state.customLogoName) {
        visible['Icon'] = `Custom Logo (${this.state.customLogoName})`;
      }

      const hidden = {
        '_personalization_id': pId,
        '_embroidery_option': opt.handle
      };

      const forLabel = context.variantTitle && context.variantTitle !== 'Default Title'
        ? `${context.productTitle || this.cfg.productTitle} / ${context.variantTitle}`
        : (context.productTitle || this.cfg.productTitle || 'Garment');

      return [
        {
          id: garmentVariantId,
          quantity: quantity,
          properties: {
            ...visible,
            ...hidden,
            _linked_variant_id: String(serviceVariantId)
          }
        },
        {
          id: serviceVariantId,
          quantity: quantity,
          properties: {
            ...visible,
            ...hidden,
            _linked_variant_id: String(garmentVariantId),
            'Embroidery For': forLabel
          }
        }
      ];
    }
  }

  customElements.define('kapisa-embroidery', KapisaEmbroidery);
})();
