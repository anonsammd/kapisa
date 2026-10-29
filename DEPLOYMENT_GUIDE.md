# Kapisa Shopify Theme — Full New Store Setup & Deployment Guide

This guide provides step-by-step instructions to deploy, configure, and launch the **Kapisa Premium Medical Apparel Theme** on any new Shopify store.

---

## 📋 Table of Contents
1. [Theme Overview & Architecture](#1-theme-overview--architecture)
2. [Step 1: Uploading Theme to Shopify](#step-1-uploading-theme-to-shopify)
3. [Step 2: Metafields Configuration (Mandatory)](#step-2-metafields-configuration-mandatory)
4. [Step 3: Creating Products & Color Families](#step-3-creating-products--color-families)
5. [Step 4: Setting Up Custom Embroidery Service](#step-4-setting-up-custom-embroidery-service)
6. [Step 5: Creating Collections & Navigation Menus](#step-5-creating-collections--navigation-menus)
7. [Step 6: Customizing the Theme in Theme Editor](#step-6-customizing-the-theme-in-theme-editor)
8. [Step 7: Final Pre-Launch Verification](#step-7-final-pre-launch-verification)

---

## 1. Theme Overview & Architecture

The **Kapisa Theme** is built on Shopify Online Store 2.0 (OS 2.0) architecture using reusable sections and theme blocks.

### Core Features Included Out-of-the-Box:
- **Dynamic Color Swatches & Color Family Switcher**: Allows buyers to browse available colors on PDP and collection pages seamlessly.
- **Custom Embroidery Add-On**: A reusable product section with garment preview, personalized text, thread color, and font selection.
- **Custom Header & Drawer Search**: Instant predictive search, wishlist link, and mobile bottom navigation bar.
- **Bestsellers Carousels & Grids**: Touch-friendly horizontal carousels with smooth scrolling and quick add.
- **Shop by Category & Shop by Color**: Interactive visual discovery sections.
- **Trust & Conversion Badges**: Built-in payment icons, trust badge strips, marquee announcement ticker, and customer review cards.

---

## Step 1: Uploading Theme to Shopify

### Updating an existing store without resetting Theme Editor content

Shopify stores section settings—including uploaded hero videos, Instagram tiles, and institutional banner images—in JSON files such as `templates/index.json`. Those files are merchant-managed configuration, not just theme code. A normal push of stale local JSON can replace the values saved in Shopify with the local defaults or older file references.

The root `.shopifyignore` protects `config/settings_data.json`, all `templates/*.json` files, and `sections/*-group.json` during routine Shopify CLI pushes. Keep this file in the theme folder and use Shopify CLI for incremental updates to an existing theme. Deploy code changes to a duplicate/staging theme first, preview it, and publish only after verifying the hero video, homepage imagery, and other Theme Editor content.

Do not upload a fresh ZIP over an existing production theme for routine code updates: ZIP uploads do not use this CLI ignore safeguard. For an initial installation or a deliberate template/layout change, explicitly include the protected JSON files only after merging the current Theme Editor settings from Shopify into the local files and reviewing the result. Never publish a newly created theme with unreviewed defaults as a replacement for the configured production theme.

1. Select all files and folders in this directory:
   - `assets/`
   - `blocks/`
   - `config/`
   - `layout/`
   - `locales/`
   - `sections/`
   - `snippets/`
   - `templates/`
   - `DEPLOYMENT_GUIDE.md`

   Do not include `.shopifyignore` in the ZIP; it is a local Shopify CLI deployment safeguard, not a theme asset.

2. Compress these files into a single `.zip` file (e.g. `kapisa-theme.zip`).

3. Log in to your **Shopify Admin**.
4. Go to **Online Store > Themes**.
5. In the **Theme library** section, click **Add theme > Upload zip file**.
6. Select `kapisa-theme.zip` and click **Upload file**.
7. Once uploaded, click **Actions > Publish** when you are ready to make it live.

The ZIP workflow above is for an initial theme installation. For existing production stores, follow **Updating an existing store without resetting Theme Editor content** instead.

---

## Step 2: Metafields Configuration (Mandatory)

For color swatches, color families, and review ratings to work automatically, set up the following custom product metafield definitions in your store.

Go to **Shopify Admin > Settings > Custom Data > Products > Add definition**:

### 1. Color Name
- **Name**: `Color Name`
- **Namespace and key**: `custom.color_name`
- **Type**: `Single line text`
- **Description**: Stores the specific color title (e.g. "Royal Blue", "Burgundy", "Ceil Blue").

### 2. Color Swatch
- **Name**: `Color Swatch`
- **Namespace and key**: `custom.color_swatch`
- **Type**: `Color` (or `Single line text` with hex value, e.g. `#1B365D`)
- **Description**: Used to render circular color dots on PDP, carousels, and grid cards.

### 3. Color Family
- **Name**: `Color Family`
- **Namespace and key**: `custom.color_family`
- **Type**: `Single line text`
- **Description**: Used for filtering products by color group (e.g. "Blue", "Red", "Black").

### 4. Color Family Products
- **Name**: `Color Family Products`
- **Namespace and key**: `custom.color_family_products`
- **Type**: `List of Products` (`product_reference` - list)
- **Description**: Links related products in the same color family, enabling one-click color switching on PDP.

### 5. Product Reviews (Standard Shopify Reviews)
- **Namespace and key**: `reviews.rating`
- **Type**: `Rating`
- **Namespace and key**: `reviews.rating_count`
- **Type**: `Integer`
*(Note: These are populated automatically by review apps like Judge.me, Okendo, or Shopify Reviews).*

---

## Step 3: Creating Products & Color Families

### Creating a Product:
1. Go to **Products > Add product**.
2. Enter Title (e.g., `Apex V-Neck Scrub Top`).
3. Add Description, Price, and Images.
4. Under **Variants**, add Size options (`XS`, `S`, `M`, `L`, `XL`, `2XL`).
5. Scroll down to **Metafields** at the bottom of the product form:
   - **Color Name**: Enter `Navy Blue`
   - **Color Swatch**: Select or enter `#0E1F3C`
   - **Color Family**: Enter `Blue`
   - **Color Family Products**: Select related color variations of this product (e.g. `Apex V-Neck Scrub Top - Royal Blue`, `Apex V-Neck Scrub Top - Burgundy`).
6. Click **Save**.

---

## Step 4: Setting Up Custom Embroidery Service

The embroidery experience is implemented in `sections/kapisa-custom-embroidery.liquid` and included on the product template. It reads the existing `custom.embroidery_options` product metafield first, then the section's `default_options` metaobject-list setting. A true `custom.embroidery_disabled` value opts a product out.

Each `embroidery_option` metaobject must have a label, kind (`top`, `bottom`, or `combo`), service-variant reference, image (product image override or the option's default preview image), and optional placement JSON. Options without a usable image, valid kind, or available variant are omitted from the storefront. In the theme editor, diagnostics explain missing configuration. Prices and formatted currency come from each referenced service variant; edit that variant's price in Shopify to change the customer-facing price. The theme does not create or modify products, metafields, metaobjects, or files.

Shopify Liquid exposes a referenced variant through the variant-reference field's `.value`; the variant's `available` property is used as the storefront availability check. A publishable metaobject definition requires active entries to be accessible in Liquid, and a custom metaobject definition must be available to the storefront. These behaviors and the `metaobject_list` setting's required `metaobject_type` are documented in [Shopify's metaobject Liquid reference](https://shopify.dev/docs/api/liquid/objects/metaobject) and [theme input settings reference](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings#metaobject_list). Liquid does not expose an independent sales-channel publication flag for a referenced variant. Shopify's [Ajax Cart API](https://shopify.dev/docs/api/ajax/reference/cart) rejects variants that aren't available in the Online Store channel, so verify the service variant's channel publication in Admin too.

To customize the controls, open **Online Store > Themes > Customize > Products** and select **Kapisa Custom Embroidery**:

1. Set `Default Embroidery Options` only if products without their own option list should inherit defaults.
2. Edit the `Thread Colour` blocks and keep three or four `Font Option` blocks. Font options use Shopify's hosted font picker and the theme's `font_face` filter; there are no external font services.
3. Adjust toggle, heading, helper, character limit, and acknowledgment copy in the section settings.
4. Change an option's service variant price in Shopify Admin. Do not enter prices in theme settings.

Placement JSON uses `{"zones":[{"id":"top","x":60,"y":30,"w":18,"rot":0}]}`. `x` and `y` are the center of the text zone as percentages of the preview-image box, `w` is the maximum zone width as a percentage of image width, and `rot` is degrees. Top/bottom options use their matching zone; combo uses both. Missing or invalid placement falls back to top `(62,30,18)` and bottom `(38,45,16)`. To tune placement after uploading final preview images, open the unpublished theme or theme editor with `?embroidery_debug=1` and click the preview for a copyable coordinate snippet. Color-specific override images should use the same framing as the option's default image because the placement zones belong to the option, not the image.

The preview is a visual approximation, not a production embroidery rendering. Personalized garment and service lines are paired by a hidden personalization ID; the service quantity/removal is locked and removing the garment removes its service line. Orphan service lines are cleaned up on cart load, and garments missing a service line are flagged. This is theme-side cart handling only; checkout enforcement would require a Shopify Function, which is outside this theme implementation.

---

## Step 5: Creating Collections & Navigation Menus

### 1. Collections Setup
Go to **Products > Collections > Create collection**:
- `All Scrubs` (Handle: `scrubs` or `all`)
- `Men's Scrubs` (Handle: `mens`)
- `Women's Scrubs` (Handle: `womens`)
- `New Arrivals` (Handle: `new-arrivals`)
- `Accessories` (Handle: `accessories`)

### 2. Navigation Menus Setup
Go to **Online Store > Navigation**:

#### Main Menu (`main-menu`):
- Home (`/`)
- All Scrubs (`/collections/scrubs`)
- Men (`/collections/mens`)
- Women (`/collections/womens`)
- About Us (`/pages/about-us`)
- Contact (`/pages/contact`)

#### Footer Menus:
- **Shop**: Links to main collections
- **Support**: Size Guide, Shipping & Returns, Contact Us, FAQ
- **Company**: Our Story, Vision & Mission, Wholesale/Bulk Enquiries

---

## Step 6: Customizing the Theme in Theme Editor

1. Go to **Online Store > Themes > Customize**.
2. **Header**: Upload your store logo, adjust logo width, and set announcement ticker messages.
3. **Homepage**:
   - Customize **Hero Banner** heading, image, and CTA links.
   - Select collection for **Bestsellers Carousel**.
   - Set up **Shop by Category** images and category links.
   - Adjust **Trust Badges** & **Newsletter Signup**.
4. **Product Pages**:
   - Customize size guide text, care instructions, and product details accordion.
5. **Footer**:
   - Add store summary, copyright text, and social media account URLs (**Facebook**, **Instagram**, **LinkedIn**).

---

## Step 7: Final Pre-Launch Verification

Before opening your store to the public, perform this quick checklist:

- [ ] Theme uploaded cleanly without errors or warnings.
- [ ] Product metafields created (`custom.color_name`, `custom.color_swatch`, `custom.color_family`, `custom.color_family_products`).
- [ ] Test product created with size variants and color metafields filled out.
- [ ] Service product and variants referenced by the active embroidery options are available and published to Online Store.
- [ ] Core collections created and assigned in homepage blocks.
- [ ] Main Navigation and Footer Menus linked.
- [ ] Test purchase flow: Add item to cart, open cart drawer/page, and proceed to checkout.

---
*Your Kapisa theme is fully clean, optimized, and ready for deployment!*
