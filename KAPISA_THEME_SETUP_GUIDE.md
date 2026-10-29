# 🩺 Kapisa Shopify Theme — Full Store Setup & Deployment Guide

This comprehensive guide covers how to set up, configure, and launch the **Kapisa Premium Medical Apparel Theme** on any Shopify store.

---

## 📑 Table of Contents
1. [Theme Architecture & Overview](#1-theme-architecture--overview)
2. [Step 1: Store Currency Configuration (INR / Multi-Currency)](#step-1-store-currency-configuration-inr--multi-currency)
3. [Step 2: Metafields Setup (Audited)](#step-2-metafields-setup-audited)
4. [Step 3: Setting Up Custom Embroidery Service Product](#step-3-setting-up-custom-embroidery-service-product)
5. [Step 4: Product setup overview](#step-4-product-setup-overview)
6. [Production Product Upload Guide](./PRODUCT_UPLOAD_PRODUCTION_GUIDE.md)
7. [Step 6: Custom Embroidery PDP & Cart Workflow](#step-6-custom-embroidery-pdp--cart-workflow)
8. [Step 7: Customizing Theme Settings in Shopify Theme Editor](#step-7-customizing-theme-settings-in-shopify-theme-editor)

---

## 1. Theme Architecture & Overview

The **Kapisa Theme** is built natively on Shopify Online Store 2.0 (OS 2.0).

### Key Architectural Highlights:
* **Custom Embroidery Reusable Section & Element**: Implemented via `sections/kapisa-custom-embroidery.liquid` and `<kapisa-embroidery>` custom element.
* **Single Top Preview Image**: One close-up preview image per product is used across all options (Top, Bottom, and Combo/Bundle).
  * **Top Embroidery**: Live text is previewed on the left chest above the pocket; selected icon / logo is previewed on the right chest.
  * **Embroidery Bundle**: Live text is previewed on the top scrub left chest; icon on right chest. Bottom scrub text is captured via the form and added to the cart line item properties.
  * **Bottom Embroidery**: Scrub image remains visible on the left to keep layout balanced; no text is drawn on the top scrub image.
* **Deferred Cart Submission**: Clicking `PROCEED` in the embroidery modal updates the summary card on the PDP without redirecting to cart. The customer can review, edit via the pencil icon (`✎`), or delete via trash icon (`🗑`). When the customer finally clicks the main product's **ADD TO CART** button, both items (garment + embroidery service variant) are submitted together atomically via `/cart/add.js`.
* **Dynamic Currency & Money Filters**: Never hardcoded. All prices adapt dynamically to store currency settings (USD, INR `₹`, EUR, GBP, etc.).

---

## Step 1: Store Currency Configuration (INR / Multi-Currency)

1. In your **Shopify Admin**, go to **Settings > Store details**.
2. Scroll to **Store currency** and click **Change store currency**.
3. Select **Indian Rupee (INR)**.
4. Under **Currency formatting**, set:
   * **HTML with currency**: `₹{{amount}}` (or `₹ {{amount_no_decimals}}`)
   * **HTML without currency**: `₹{{amount}}`
5. Click **Save**.
*The theme automatically reads `shop.money_format` and renders all prices in INR dynamically.*

---

## Step 2: Metafields Setup (Audited)

Go to **Shopify Admin > Settings > Custom data > Products > Add definition**:
The live store audit found the color and embroidery-preview definitions below already exist. Verify them before adding anything to avoid creating duplicate definitions; the optional product-detail and embroidery-option definitions are not currently present.

### 1. Color Name
* **Name**: `Color Name`
* **Namespace and key**: `custom.color_name`
* **Type**: `Single line text`
* **Description**: The color title (e.g. `Navy Blue`, `Wine`, `Ceil Blue`).

### 2. Color Swatch
* **Name**: `Color Swatch`
* **Namespace and key**: `custom.color_swatch`
* **Type**: `Color`
* **Description**: The hex code used for circular swatch dots (e.g. `#0E1F3C`).

### 3. Color Family
* **Name**: `Color Family`
* **Namespace and key**: `custom.color_family`
* **Type**: `Single line text`
* **Description**: Broad color group used by storefront filters (e.g. `Blue`, `Red`, `Black`).

### 4. Color Family Products
* **Name**: `Color Family Products`
* **Namespace and key**: `custom.color_family_products`
* **Type**: `List of Products` (`product_reference` - list)
* **Description**: Links related color products so customers can switch colors on PDP with one click.

### 5. Product Details (Optional)
Create these product metafield definitions if the product details accordion should show product-specific content. Use `Rich text` for each:
* `custom.fabric_details`
* `custom.care_instructions`
* `custom.fit_guide`
* `custom.shipping_returns`

The accordion uses these values when present. `custom.fit_guide` also supplies the PDP size-guide modal; its Theme Editor content setting is an optional fallback. Theme Editor accordion content fields are empty by default, so placeholder text is never shown to customers.

### 6. Embroidery Preview Image (Left Chest)
* **Name**: `Embroidery preview image (left chest)`
* **Namespace and key**: `custom.top_embroidery_image`
* **Type**: `File` (Image)
* **Description**: One product-specific preview image is required to show the customizer. Use consistent portrait framing and restrict accepted files to images in the definition's validation settings.

### 7. Embroidery Disabled (Opt-Out)
* **Name**: `Embroidery disabled`
* **Namespace and key**: `custom.embroidery_disabled`
* **Type**: `True/false` (Boolean)
* **Description**: Check to hide custom embroidery on specific non-embroiderable products (e.g. scrub caps, socks).

### 8. Bottom and Combo Embroidery Preview Images (Optional)
* `custom.bottom_embroidery_image` — File (Image)
* `custom.combo_embroidery_image` — File (Image)

The live store audit found these three file-reference definitions but no image-only validation rules. It also found no `embroidery_option` metaobject definition and no `custom.embroidery_options` product definition; the theme does not need them. Embroidery choices and prices come from available variants on the service product. See the [Production Product Upload Guide](./PRODUCT_UPLOAD_PRODUCTION_GUIDE.md) for all definition findings and review-app setup.

Shopify's standard `reviews.rating` and `reviews.rating_count` metafields supply the rating summary when a reviews app writes those values; the theme's summary block does not render individual review text or collect submissions. Add the review app's product block to display reviews and configure the theme's review link to the app form.

---

## Step 3: Setting Up Custom Embroidery Service Product

The cart charges the real Shopify variant for embroidery. You need one service product published to Online Store.

1. Go to **Shopify Admin > Products > Add product**.
2. **Title**: `Embroidery Options (Service)`
3. **Handle**: `embroidery-options-service`
4. **Description**: `Custom embroidery service add-on for medical apparel.`
5. **Shipping**: Uncheck `"This is a physical product"`.
6. **Inventory**: Uncheck `"Track quantity"`.
7. Under **Variants**, add Option Name: `Type`.
8. Create 3 variants:
   * Add service variants whose titles include `Top`, `Bottom`, and `Combo` (or `Bundle` for the bundle). Set production prices and availability intentionally; the sample amounts below are not verified production pricing.
   * **Example Variant 1**:
     * Option: `Top`
     * Price: Set your approved production price.
     * SKU: `EMB-TOP`
   * **Example Variant 2**:
     * Option: `Bottom`
     * Price: Set your approved production price.
     * SKU: `EMB-BOTTOM`
   * **Example Variant 3**:
     * Option: `Combo`
     * Price: Set your approved production price.
     * SKU: `EMB-COMBO`
9. **Sales Channels**: Ensure **Online Store** is active and checked.
10. Click **Save**.

*Note: You can adjust the variant prices at any time in Shopify Admin; the storefront modal, triggers, and cart calculate dynamically.*

---

## Step 4: Product setup overview

The theme reads embroidery choices and their prices from the available variants on the `embroidery-options-service` product. A product-specific `custom.top_embroidery_image` file is required before the customizer is shown; the normal product gallery image is never substituted for the embroidery preview. Bottom and combo preview fields are optional and use the product's top preview when empty.

Follow the [Production Product Upload Guide](./PRODUCT_UPLOAD_PRODUCTION_GUIDE.md) for audited live metafields, separate products per color, size variants, product details, embroidery image requirements, and review-app setup. The live store currently has no `embroidery_option` metaobject definition, and the theme does not require one.

---

## Step 6: Custom Embroidery PDP & Cart Workflow

### 1. PDP Initial Trigger
* Positioned directly above the Buy buttons.
* Shows custom embroidery banner with starting price (`Starting at ₹199 personalise your scrubs`).
* Radio options:
  * `Add Embroidery` — opens customization modal.
  * `Skip for Now` — leaves item standard without embroidery.

### 2. Customization Modal
* **Left Side**: Clean scrub preview stage with `✕ CLOSE` button.
  * Text rendered on left chest directly above pocket (`Line 1` name, `Line 2` designation).
  * Icon rendered on right chest (12 classic medical icons, 5 limited edition icons, or uploaded custom logo).
* **Right Side**:
  * Step 1: Selection cards (Bundle with savings badge, Top, Bottom).
  * Step 2: Customization form with live character counters, 6 thread color swatches, font toggle (`AA Block` / `Aa Script`), bottom scrub add-on, and icon grid.
  * `RESET`: Restores defaults.
  * `PROCEED`: Saves customization and closes modal (**does not redirect to cart**).

### 3. PDP Configured Summary Card
* After clicking `PROCEED`, the PDP widget transforms into the configured card:
  * Checkbox: `☑ Custom Embroidery` with price.
  * **Mini Preview Box**: Shows the user's name & designation rendered in the selected font and thread color.
  * **Details**: Text position, text entered, color, font, and icon.
  * **Edit Button (`✎`)**: Reopens the modal with existing values preloaded for easy edits.
  * **Delete Button (`🗑`)**: Clears customization and reverts to initial widget.

### 4. Cart Submission
* When customer clicks the main **ADD TO CART** button:
  * Garment variant + Embroidery service variant are submitted together atomically via `/cart/add.js`.
  * The cart drawer opens displaying both items paired with properties:
    * `first_name`: Line 1
    * `designation`: Line 2
    * `Color`: Selected thread color
    * `Font`: Block / Script
    * `Icon`: Selected icon name
    * `Embroidery For`: Garment title & size
    * `_personalization_id`: Hidden unique pairing key

---

## Step 7: Customizing Theme Settings in Shopify Theme Editor

1. Open **Shopify Admin > Online Store > Themes > Customize**.
2. Navigate to any Product template (`Default product`).
3. Click on the **Kapisa Custom Embroidery** section in the sidebar:
   * **Toggle button label**: `Add embroidery`
   * **Modal initial heading**: `Add Your Identity`
   * **Max characters per line**: `22` (default)
   * **Require acknowledgment checkbox**: Optional toggle for non-refundable notice.
4. Under Blocks:
   * **Thread colour blocks**: Add, edit, or reorder thread color dots (`White`, `Black`, `Gold`, `Grey`, `Neon Green`, `Pink`).
5. Click **Save**.
