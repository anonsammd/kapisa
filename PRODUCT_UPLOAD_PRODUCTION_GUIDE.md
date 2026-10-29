# Production Product Upload Guide

This guide documents the product setup used by the Kapisa Shopify theme. It reflects the live metafield and metaobject **definitions** that were audited for this theme. It does not certify the values on every individual product.

## 1. Product and variant structure

### One product per color

Create a separate Shopify product for each color of a style. Each color product can have its own photos, inventory, and embroidery preview. Use Shopify variants for sizes within that color product, not for the color family.

For each color product:

1. Use a consistent style name and a clear color in the product title (for example, `Apex V-Neck Scrub Top - Navy`).
2. Set the product status, sales channels, description, vendor, product type, and collection membership.
3. Add that color's product photos and alt text. Publish the product only after confirming its variants and media.
4. Create native Shopify variants for every size you sell. Use the same option name (`Size`) and consistent size values across sibling colors.
5. Set the correct SKU, price, compare-at price (if applicable), inventory policy and quantity, and barcode for each size variant. Check that unavailable sizes are not accidentally marked in stock.

### Link color siblings

On every color product, set:

- `custom.color_name`: The storefront label for this color (for example, `Navy`).
- `custom.color_swatch`: The exact swatch color, using Shopify's color picker.
- `custom.color_family`: A consistent broad filter group (for example, `Blue`, `Green`, `Black`, or `Red`). Use the same taxonomy as the storefront collection filters.
- `custom.color_family_products`: Select the other products in this same style/color family. Include all sibling colors; use the same sibling list on each product, including the current product if practical. The theme avoids duplicating the current swatch.

The product page links these references to the sibling product pages. Collection cards also use the referenced products and their swatch colors. Do not rely on title parsing or the theme's color-name fallback as production data.

## 2. Live metafield definition audit

The following product definitions were found and are used by the theme:

| Namespace and key | Shopify type | Theme use | Merchant setup |
|---|---|---|---|
| `custom.color_name` | Single line text | Selected color label and swatch accessibility text | Set on every color product |
| `custom.color_swatch` | Color | PDP and collection swatch | Set the exact color on every color product |
| `custom.color_family` | Single line text | Collection color filtering | Use the storefront's consistent broad color taxonomy |
| `custom.color_family_products` | List of product references | Related-color swatches | Link all products in that style's color family |
| `custom.top_embroidery_image` | File reference | Required base image for the embroidery modal | Upload and assign one product-specific image |
| `custom.bottom_embroidery_image` | File reference | Optional bottom embroidery preview | Set only when a distinct bottom view is needed |
| `custom.combo_embroidery_image` | File reference | Optional bundle preview | Set only when a distinct bundle view is needed |
| `custom.embroidery_disabled` | Boolean | Hides the embroidery feature when true | Turn on for products that cannot be embroidered |

The three embroidery file-reference definitions exist but have no file-type validation rules. For production, edit each definition under **Shopify Admin > Settings > Custom data > Products** and restrict accepted files to **Images**. The theme requires `custom.top_embroidery_image` to display the customizer; bottom and combo images can be omitted and will use the top preview.

The theme also reads these product-specific detail keys, but their definitions were **not found** in the live audit. Create them if you want to manage these details per product:

| Namespace and key | Recommended Shopify type | Theme use |
|---|---|---|
| `custom.fabric_details` | Rich text | Fabric and construction accordion |
| `custom.care_instructions` | Rich text | Washing and care accordion |
| `custom.fit_guide` | Rich text | Fit accordion and size guide content |
| `custom.shipping_returns` | Rich text | Shipping and returns accordion |

Define each under **Settings > Custom data > Products** with the exact namespace/key above. They are optional: the theme can use its configured size-guide content when `custom.fit_guide` is empty, while other empty detail fields should remain absent from the product content. Review each new definition in a development theme before publishing.

The live store had no metaobject definitions and no `custom.embroidery_options` product metafield. The current theme does not depend on either: embroidery option names and prices come from available variants on the service product described below. Do not create the old `embroidery_option` metaobject solely for this theme.

## 3. Product-specific embroidery image

Each product that offers embroidery needs its own `custom.top_embroidery_image` value:

1. Prepare a clean, high-resolution image of the garment for the modal preview. Show the area customers will personalize, with the garment and chest/pocket placement clearly visible.
2. Use a consistent portrait crop and framing across the product family (the theme's default preview sizing is approximately 600 × 640). Keep the garment position consistent so the embroidery overlay aligns.
3. Upload the image in Shopify's Files area, then select that file in the product's `Top embroidery image` metafield. Do not assign the normal product gallery image as a substitute.
4. Preview the product page and test top, bottom, and bundle selections. If a distinct preview is needed for either latter option, upload it and set `custom.bottom_embroidery_image` or `custom.combo_embroidery_image`; otherwise those options use the top image.
5. Set `custom.embroidery_disabled` to true for products that must not show customization.

The modal keeps a white preview canvas and the image is cropped to fill its stage; upload consistently framed images with a compatible background and aspect ratio to avoid visible bars or a shifted overlay. The theme cannot automatically sample an image's background color.

## 4. Embroidery service product and pricing

The theme looks up the product with handle `embroidery-options-service`. Keep it active and available to the Online Store, and configure its variants with titles containing the appropriate option word:

- `Top` for top embroidery.
- `Bottom` for bottom embroidery.
- `Combo` or `Bundle` for the top-and-bottom option.

Set the correct price on each Shopify variant. Only available variants are offered; the theme uses the Shopify variant price and does not provide hardcoded fallback prices. Before launch, confirm the product handle, variant titles, availability, and prices in Shopify Admin, then test each choice through cart and checkout. Do not use the service product as a customer-facing garment.

## 5. Product details and reviews

### Product details

Write the product's title, description, vendor, and product category in Shopify's native product fields. Use the recommended `custom.*` rich-text metafields above for product-specific fabric, care, fit, and shipping/returns information. Review the rendered accordion on each template; do not enter claims that are not verified for that product.

### Customer reviews

The custom theme review block reads Shopify's standard aggregate rating metafields `reviews.rating` and `reviews.rating_count`. It can display the average and count, but it does not render individual review text or collect submissions by itself.

To let shoppers write reviews and read published review content:

1. Install and configure a Shopify-compatible review app. Set its moderation, verified-purchase, notification, and review-request policies.
2. In **Online Store > Themes > Customize**, open the product template and add the review app's product reviews/app block where the full reviews should appear. Enable any app embed the provider requires.
3. Confirm the app publishes aggregate values to `reviews.rating` and `reviews.rating_count` if you want the theme's aggregate summary populated.
4. In the Kapisa **Customer Reviews** block, set `Review link` to the app's product-specific review form or form anchor. If the app requires its own submission block or modal instead of a URL, use that app-provided control; do not point to a generic or unrelated page.
5. Test a product with reviews and one without. Confirm customers can reach the form, submit a review, and see approved individual reviews in the app block.

Never create or manually edit review aggregates to simulate customer feedback.

## 6. Production launch checklist

- [ ] Every color is a separate product, and sizes are native variants with correct SKU, price, and inventory.
- [ ] Color name, swatch color, filter family, and sibling product references are set consistently.
- [ ] Each embroidery-enabled product has its own image in `custom.top_embroidery_image`.
- [ ] Embroidery image metafields are validated as image files; optional bottom/combo images render correctly when assigned.
- [ ] Embroidery service product handle and variant titles match the theme's lookup rules; prices and availability are correct.
- [ ] Product-specific detail metafields are defined where needed and the storefront accordion is checked.
- [ ] Review app blocks, aggregate ratings, moderation, and the product review link work as intended.
- [ ] Test each color, size, purchase path, embroidery option, cart pairing, mobile layout, and unavailable variant on a preview theme before publishing.
