ROLE
You are a senior Shopify theme engineer. Work inside the existing Kapisa Shopify theme repository (local, run with Shopify CLI against the dev store kapisa-9cbbfhcv.myshopify.com, on an unpublished/development theme only). Do not build a demo. Do not rewrite unrelated working features. Follow the theme's existing conventions. Vanilla JS, no paid apps, no external APIs, no new dependencies.

=====================================================
A. WHAT ALREADY EXISTS IN THE STORE (do NOT create or modify any of it)
=====================================================
All store data is already set up. Your job is THEME CODE ONLY. You have no Admin credentials and must not try to create metafields, metaobjects, products or files. If something cannot be read from Liquid, report it instead of changing store data.

1) Metaobject definition  type: embroidery_option  (Storefront access: public read, publishable/Active capability on)
   Fields:
    - label (single line text)             e.g. "Top"
    - kind (single line text)              one of: top | bottom | combo
    - service_variant (variant reference)  the Shopify variant whose price is charged
    - default_preview_image (file, image)  optional
    - placement (JSON)                     optional, text zones in percentages (see section C)
    - sort_order (integer)                 optional, ascending
      Existing ACTIVE entries (handles): top, bottom, combo
    - top    -> service variant "Top"    (price 399.00), kind top,    one zone "top"
    - bottom -> service variant "Bottom" (price 399.00), kind bottom, one zone "bottom"
    - combo  -> service variant "Combo"  (price 699.00), kind combo,  two zones "top" and "bottom"
      Prices differ on purpose. Never assume the three prices are equal.

2) Product metafields (namespace custom, ALL optional):
    - custom.embroidery_options        list of embroidery_option references
    - custom.embroidery_disabled       boolean (opt-out)
    - custom.top_embroidery_image      file, image  (colour-specific override)
    - custom.bottom_embroidery_image   file, image
    - custom.combo_embroidery_image    file, image
      Existing unrelated metafields used by the current theme: custom.color_name, custom.color_swatch, custom.color_family, custom.color_family_products. Do not touch them.

3) Service product (Active, published to Online Store, non-shipping, inventory not tracked):
   handle: embroidery-options-service, title "Embroidery Options (Service)", option "Type" with variants Top / Bottom / Combo.
   Read the variant through the option's service_variant field. NEVER hardcode these handles, titles, variant IDs or prices in theme code.

4) Legacy product: handle custom-embroidery-service (single variant, price 499.00) is used by the CURRENT embroidery code. The new code must not use it. Leave the product itself alone.

5) Test products already configured:
    - classic-v-neck-scrub-top   (4 sizes)  custom.embroidery_options = top, bottom, combo
    - core-stretch-scrub-set     (4 sizes)  custom.embroidery_options = top, bottom
    - every other product: no options set (relies on the section's default_options setting)

6) Preview images are TEMPORARY PLACEHOLDERS (ordinary scrub photos, different aspect ratios, one is 1200x675 landscape). Placement values in the entries are rough guesses. So:
    - The preview container must adopt each image's own aspect ratio (use image width/height). Do NOT force 3/4.
    - Build the placement debug helper (section C) so the merchant can re-tune coordinates once real images are uploaded.

7) Store currency is set to USD while catalogue prices look like rupee amounts. Do not assume a currency symbol anywhere; use Shopify money filters only.

=====================================================
B. GOAL
=====================================================
Move the custom embroidery feature out of sections/kapisa-product-info.liquid into its own reusable section sections/kapisa-custom-embroidery.liquid, and build a full preview modal where the customer types custom text onto specific garment areas, picks a thread colour and one of 4 fonts, sees a live preview, and adds the garment plus exactly one correct embroidery service line to the cart. Scope is deliberately small: NO designation field, NO logo/icon, NO placement chooser for the customer. The merchant defines the text areas; the customer only supplies text, colour and font.

STEP 0 - INSPECT FIRST (before changing anything)
Read AGENTS.md/README, layout/theme.liquid, templates/product.json, sections/kapisa-product-info.liquid (current embroidery + add-to-cart code), cart drawer/page/notification code and their events, existing JS conventions, config/settings_schema.json, and any app touching the product form or cart. Write a short plan of what you found, then proceed. Verify against current Shopify docs anything marked (VERIFY).

PRESERVE the design language: bg #FAF7F0, navy #0E1F3C, gold #C9A227, blue-gray #8FA3B8, text #2B2B2E, support text #60758B. Premium, minimal, healthcare-apparel feel. Do not change unrelated product-page behaviour (gallery, swatches, size guide, price, quantity).

=====================================================
C. WHAT TO BUILD
=====================================================

C1. Option resolution (server-side Liquid, per product)
1) custom.embroidery_disabled true -> feature off.
2) custom.embroidery_options non-empty -> use it.
3) else section setting default_options (a metaobject list setting of type embroidery_option; (VERIFY) the exact schema setting type, likely metaobject_list with metaobject_type "embroidery_option").
4) none -> feature off, normal purchasing unaffected, toggle hidden.
   Sort by sort_order.
   Image for an option = product override by kind (custom.top/bottom/combo_embroidery_image) -> else option.default_preview_image -> else option is NOT offered.
   An option is offered ONLY if it has a usable image AND a service variant that exists, is published to Online Store and is available. Never substitute another option's image or price.
   Show the price of the selected option, formatted with Shopify money filters, from the service variant. No prices in JS/CSS/settings.
   Misconfigured option: hide it on the storefront; in the theme editor (request.design_mode) show an admin-only diagnostic such as "Top: service variant missing".
   (VERIFY) Liquid access to metaobject fields and variant_reference values, and that entries must be Active and the definition storefront-readable. Document findings.

C2. Placement zones (data already stored in each option's placement JSON)
Format: {"zones":[{"id":"top","x":60,"y":30,"w":18,"rot":0}]}
Semantics (define and document exactly this): x,y = CENTRE of the text area as a percentage of the preview image box (0-100); w = maximum text width as a percentage of the image box width; rot = rotation in degrees. Zone ids: "top" and "bottom". kind top uses zone top, kind bottom uses zone bottom, kind combo uses both.
If placement is missing or invalid, use documented defaults per kind (top: x62,y30,w18; bottom: x38,y45,w16; combo: both) and show an editor-only warning.
Position text with percentage left/top and translate(-50%,-50%) so it scales with the image on any screen. Size text with container-relative units (container queries/cqw or an equivalent) and then shrink-to-fit so the text never exceeds the zone width w; set a minimum font size and stop accepting characters rather than overflowing.
Debug helper: with ?embroidery_debug=1 (only in design mode or on an unpublished theme), clicking the preview shows the x/y percentages and a copy-ready JSON zone snippet so the merchant can paste into the metaobject. Keep it tiny.
Known limitation to document: colour-specific override images should share the same framing as the option's default image, because zones belong to the option, not the colour.

C3. The preview modal
- A toggle "Add embroidery" (copy editable in section settings) opens an accessible modal: focus trap, Escape to close, backdrop click, body scroll lock, focus returned to the trigger, Back and Close buttons. Responsive for desktop, tablet and mobile (landscape too). On mobile the preview stays visible while the form scrolls.
- Step 1: option chooser showing only valid options with their label and live price. One valid option -> skip the chooser. Zero -> no toggle at all.
- Step 2: customise. Left/top: live preview. Right/bottom: form.
- Preview = the option's image with the customer's text overlaid in each zone, rendered with textContent (never innerHTML), updating on every keystroke, in the chosen thread colour and font. Lazy-load only the selected option's image; reserve space using its width/height to avoid layout shift. Preview images never enter the product gallery, thumbnails, featured image, or structured data.
- Give the text an embroidered look using CSS only (for example subtle text-shadow/letter-spacing/slight texture) and state in the UI that the preview is a visual approximation.
- Form fields:
    * One text input per zone, labelled by area ("Top text", "Bottom text"). Combo shows both, with a "Use the same text for bottom" checkbox. Max 20 characters each (section setting, default 20), live counter, trimmed, whitespace-only invalid, required.
    * THREAD COLOUR: swatch buttons (radio semantics, visible selected state, accessible names). The colour list is merchant-managed through section blocks of type "thread_color" (name + colour setting). Ship defaults: White, Navy, Gold, Black, Silver, Red (adjust to sensible set). Whitelist only; apply to the text in the preview.
    * FONT: exactly 4 selectable font options (minimum 3, maximum 4), each rendered as a button showing the label in that font, merchant-managed through section blocks of type "font_option" (label + font_picker setting). Defaults: a bold sans "Block", a script "Script", a classic serif "Serif", a handwriting/rounded "Handwriting" style. Use Shopify-hosted fonts via font_picker plus the font_face filter, loaded with font-display: swap and only what the modal needs. (VERIFY) valid font_picker default handles; no external font CDNs, no paid fonts.
    * Live price line for the selected option.
    * Optional acknowledgment checkbox (section toggle, default on): "Embroidered items cannot be returned or exchanged" (text editable in settings). Required when on.
- Inline accessible validation errors next to fields (aria-describedby, aria-live), cleared as the customer corrects them. Never submit empty or invalid values.
- Primary button "Add to cart" inside the modal. After success show "Personalize another" and "View cart", and refresh the cart UI through the theme's real contract (drawer/events/badge; inspect it, do not assume).
- Changing the garment size while the modal is open must not reset the typed text.

C4. Cart architecture (most important)
- ONE owner of purchase submission. Create a small shared module (for example assets/kapisa-purchase.js) used by the product form. The embroidery section registers a provider through a documented custom-event contract or registry; on submit the controller asks it for extra line items and sends ONE POST to /cart/add.js with an items array: the scrub variant plus exactly one service variant. (VERIFY) that a failure on any item rejects the whole request. Must work regardless of section order and with multiple section instances. Prevent double submission, show loading state, surface Shopify's error text sensibly. Re-read the selected variant at submit time; do not assume size is option1; inspect the option structure.
- Embroidery off -> add scrub only, no stale embroidery properties, normal quantity.
- Personalized -> quantity 1 per add.
- Pair both lines with a unique id. Hidden properties (underscore prefix): _personalization_id, _embroidery_option (entry handle), _linked_variant_id.
- Visible properties on the scrub line: "Embroidery" (Top/Bottom/Combo label), "Top Text" and/or "Bottom Text", "Thread Colour" (name), "Font" (label). Service line: same visible properties plus "Embroidery For: <scrub title / size>". Only include relevant ones.
- Prices always come from the real service variant; never trust client-side prices.
- CART INTEGRITY (cart drawer + cart page JS): service lines have locked quantity and no independent remove; removing a scrub removes its paired service line (match _personalization_id via /cart/change.js); changing scrub quantity is blocked or kept in sync; on cart load remove orphan service lines and flag scrub lines whose service line is missing. State honestly in the docs that checkout-level enforcement would need a Shopify Function (limited on non-Plus) and is out of scope.
- Remove the old custom-embroidery-service lookup and all old embroidery HTML/CSS/JS/handlers from kapisa-product-info.liquid. Leave only a minimal documented hook. Never leave two implementations active.

C5. Section quality
Valid {% schema %} with a preset, usable in the theme editor (add, remove, reorder, reload). Settings: toggle label, modal heading and helper copy, max characters, acknowledgment toggle and text, default_options, blocks thread_color and font_option. Add the section to templates/product.json (inspect it; do not leave it orphaned) and also make sure it is visible on the two test products. CSS and IDs scoped per section instance. Clean up listeners on editor reload. No duplicate custom-element registration. Escape Liquid output. No localStorage for embroidery data. No analytics or external dependencies.

=====================================================
D. ACCEPTANCE TESTS
=====================================================
Run theme check/lint and static checks. Clearly separate "verified by code inspection" from "needs browser testing on the store". Cover:
- classic-v-neck-scrub-top: chooser shows Top, Bottom, Combo with prices 399 / 399 / 699 formatted by Shopify.
- core-stretch-scrub-set: chooser shows Top and Bottom only.
- a product with no options and no default_options: no toggle; normal purchase works.
- a product with default_options set in the editor: options appear.
- custom.embroidery_disabled = true hides the feature.
- Option with image but missing/unavailable service variant is hidden (diagnostic in design mode); option with variant but no image is hidden.
- Top: only the top zone shows text; Bottom: only the bottom zone; Combo: both zones, same-text checkbox works; combo adds ONE combo service line at 699.
- Long text shrinks inside the zone; empty/whitespace blocked; 20-character limit; XSS-looking input renders as plain text.
- All thread colours and all 4 fonts change the preview; fonts load without layout jump.
- Different image aspect ratios (placeholder landscape image) keep text aligned at several viewport widths and orientations.
- Normal purchase after a personalized one carries no embroidery properties.
- Correct size variant is added after changing size, including while the modal is open.
- Rapid clicks, network/Shopify error, keyboard-only use, screen-reader labels, mobile, theme-editor reload, two section instances.
- Cart: delete scrub removes service line, delete service line is blocked/handled, quantity change handled, reload cart orphan cleanup.
- Gallery shows no preview images.

=====================================================
E. DELIVERABLES
=====================================================
Complete working implementation, not a plan. Then report: files changed and why; how the section reads the existing metaobject/metafields (and any (VERIFY) findings); theme-editor steps (add the section, set default_options to Top/Bottom/Combo, edit thread colours and fonts); how to re-tune placement with the debug helper once real images are uploaded; how the merchant changes prices (edit the service variant); test results; known limitations (visual approximation only; browser-side validation is not enforcement; Shopify variants control price). Do not claim anything was browser-tested unless it was.

NON-NEGOTIABLE
No hardcoded handles, variant IDs or prices. No requirement that all options exist. No broken modal when configuration is incomplete. No duplicate cart submissions. No new store data created from theme code. No unrelated rewrites. Smallest robust change that satisfies everything above.