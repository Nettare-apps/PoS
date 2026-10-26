# CLAUDE.md: Pour Register

## What this is

Pour Register is a beverage-first point-of-sale system, built first for Nettare, a restaurant, cocktail bar and café in Chicago. The owner is Conner. He designed the behavior at the button level in a clickable prototype and is now moving to a real build.

- `SPEC.md`: the product spec and decisions log. Read it before any feature work.
- `prototype/pour-register.html`: the reference implementation of every agreed behavior. It is a single file of vanilla JS, with state in `S` and storage in localStorage under `pourreg2.*`.
  - When the spec is silent, match the prototype.
  - When both are silent, ask.
  - Don't copy its architecture. It is a prototype: floats for money, one global state object, no server.
- `data/pos_data.json`: seed library (products, menu items, categories, counts). See `data/README.md`.

## Working with Conner

- **Scope:** apply only the changes he explicitly asks for, and confirm before making any change he didn't ask for. If a requested change needs something else changed, say so and ask.
- **Ambiguity:** when a request can be read more than one way, ask a short question with concrete options, and state your recommended default.
- **Assumptions:** when you make an assumption to keep moving, list it plainly at the end of your reply so he can correct it.
- **Updates:** keep them short and concrete: what changed, what to check, what's open. Skip step-by-step narration.
- **Plain text:** when he asks for something copy/pasteable, give plain text with no markdown.
- **Data volume:** he wants every button press and action recorded. If that ever causes a data-volume or performance problem, flag it rather than quietly reducing logging.
- **Deferred work:** payments go through Square or Stripe; don't build payment processing. He expects professional developers for offline mode and other delicate parts, so flag when work enters that territory.

## Non-negotiables from the spec

- **Event log.** Every action writes an append-only event: `{ts, type, user, tab, ...}`. Reporting is built from it.
- **Publishing.** The register reads only the published library. Library edits are drafts until published, and can be reverted.
- **Rounding.** Base menu and pour prices are whole dollars. Percentage discounts, happy hour % off, check math and taxes are exact to the cent. Store money as integer cents.
- **Theoretical cost** uses the lowest of frontline, net and sale cost. The price basis is chosen per serving button and is independent of it.
- **Removals.**
  - Void means never made: no depletion.
  - Comp means it was made: it depletes.
  - Staff need manager approval for discounts, comps and voids, either a code on the spot or a queued request.
  - A check can't close with a pending removal.
- **Pending lock.** Leaving a check with new, uncoursed items prompts Discard or Stay.
- **Send across checks.** If unsent items sit on more than one check, ask before sending. "Send all" is the default.
- **Joined tables** take the lowest table number for ticketing and KDS.
- **Happy hour** pricing is set per menu or per item, never globally. Ring-ins within 5 minutes of the window's end, before or after, prompt for happy hour or regular.

## Likely first decisions

Bring these to Conner; don't decide them alone.

1. **Stack and hosting.** Tablet-first web app (PWA) vs native, the backend and database, and how realtime sync between devices works.
2. **Processor.** Square vs Stripe Terminal. This affects card-on-file, tips and the shift-close figures.
3. **Data source.** Live sync with his existing Price Book, Recipe Book and Menu Guide apps vs CSV import. The spec leans toward CSV for inventory.
4. **Offline strategy.** Who owns it.

## Quality bar

- Every rule in `SPEC.md` should have a test, especially pricing, rounding, splits, check discounts and their attribution, and approvals.
- Phone (6.5" portrait) and iPad Air (portrait and landscape) are the target devices. Check both.
