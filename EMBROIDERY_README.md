# Kapisa custom embroidery — rebuild notes

## What changed
- `sections/kapisa-custom-embroidery.liquid` + `snippets/kapisa-custom-embroidery-inner.liquid`: single implementation; server-side option resolution; markup. Inline CSS/JS removed.
- `assets/kapisa-embroidery.css|js`: new modal (native `<dialog>`: top layer, focus trap, Esc, inert background), live preview, validation, add-to-cart.
- `assets/kapisa-purchase.js`: JSON-safe error handling, network error message. `assets/kapisa-cart-sync.js`: uses store root for /cart.js.
- `blocks/kapisa-cart-page.liquid`: shows new property names (Thread Colour / Font / Embroidery type), locks personalized garment qty at 1.
- `templates/product.json`: 2 fonts (Serif = Playfair Display Bold, Modern = Inter Bold).

## Pricing
Charged price = the real service variant (metaobject `service_variant`) added in the same `/cart/add.js` request as the garment. The modal total is display-only, computed in Liquid (multi-currency safe). Change prices by editing the service variant in Admin.

## Theme editor
Product page > Kapisa Custom Embroidery: set "Default embroidery options" (or the per-product metafield), edit thread colours, up to 4 font blocks (any font; "Fallback style" is used while loading). The trigger button moves next to the buy buttons (`data-kapisa-embroidery-hook`).

## Re-tuning placement
Open `/products/<handle>?embroidery_debug=1` in the theme editor or an unpublished theme preview, open the modal, click the image (Shift+click = bottom zone) and paste the JSON into the option's `placement` field. x,y = centre %, w = max width %, rot = degrees.

## Known limits
Client-side validation is not enforcement; someone could add the service variant alone via /cart/add. Checkout enforcement would need a Shopify Function (limited on non-Plus). Colour-override images must share the framing of the option's default image.
