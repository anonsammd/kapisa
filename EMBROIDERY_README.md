# Kapisa custom embroidery

## Verified store setup

A read-only Shopify Admin audit on 2026-11-26 found these product definitions:

- `custom.top_embroidery_image`, `custom.bottom_embroidery_image`, and `custom.combo_embroidery_image`: `file_reference`.
- `custom.embroidery_disabled`: `boolean`.
- `custom.embroidery_options` and the `embroidery_option` metaobject definition/entries: **not found**.

The three file definitions were updated during this task with upload descriptions and image-only file validation. The descriptions recommend a consistent 7:10 portrait crop (700 x 1000 px); Shopify cannot enforce that ratio. The failing `selling-plans-ski-wax` product had no embroidery metafield values. The previous CTA logic only checked the opt-out flag, so it showed a button even though no preview component was rendered.

## Current storefront behavior

- Embroidery is enabled per product by assigning a valid image with pixel dimensions to `custom.top_embroidery_image`. Set `custom.embroidery_disabled` to `true` to opt out.
- The modal options are resolved from available variants on the `embroidery-options-service` product whose titles contain Top, Bottom, Combo, or Bundle. Prices are Shopify variant prices, not hardcoded values or metaobject references.
- The audited service variants were Top 299.00, Bottom 199.00, and Combo 598.00 in the store's configured currency. Confirm the currency and final pricing in Admin before publishing.
- Bottom and Combo preview images are optional; when absent or invalid, the Top image is used. A missing/invalid Top image or missing usable service variant hides the CTA.
- The modal preview now preserves the selected image's aspect ratio and uses `object-fit: contain`, so the garment is not cropped. Keep images consistently framed so the fixed embroidery overlay lands on the correct chest area.

## Merchant workflow

For the full product creation, metafield audit, upload recommendations, service-variant setup, and pre-launch checklist, follow [PRODUCT_UPLOAD_PRODUCTION_GUIDE.md](./PRODUCT_UPLOAD_PRODUCTION_GUIDE.md).

Use portrait artwork near 7:10 (recommended 700 × 1000 px; Knya's inspected preview was 661 × 941 px). Keep the garment's position and crop consistent. Shopify's native file validation cannot enforce this aspect ratio, so verify each uploaded image in the preview.

## Known limits

Cart pairing and browser-side validation improve the normal theme flow, but they are not checkout enforcement. Customers or integrations could still add a service variant directly; checkout-level enforcement requires a server-side Shopify mechanism. The store audit found no metaobject-backed option list, so per-product option selection beyond the enabled/disabled toggle is not currently configured.
