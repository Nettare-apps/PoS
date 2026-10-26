# Seed data

`pos_data.json` is a snapshot taken on 2026-10-26 from Nettare's Price Book, Menu Guide and Recipe Book. It contains:

- `products`: 377 entries.
  - 256 pours with costs (frontline, net, sale), container size, pack, servings and the custom-pour scale.
  - 121 menu items (`kind: "item"`) with price, allergens, station and an optional `recipe` of `{pid, ml}` for depletion.
- `categories`: 18.
- `inv`: starting bottle counts per pour. These are test values, not a real count.

Notes:

- **Overrides:** the serving `override` prices from the Price Book are still in this file. They were cleared on purpose in the prototype, so pours price from their target cost % until the menu is reconciled at go-live.
- **Placeholder prices:** 65 menu items have `placeholder: true`.
- **Container sizes:** beer, NA and bitters sizes are assumptions.
- **Recipe matching:** recipes were matched to products through an alias map in `sources/build_data.py`, and only for Cocktails and Cafe Drinks.
- **Not stored here:**
  - Category parents (Spirits, Modifiers and Food over their sub-categories).
  - The starter modifier groups and assignments.
  - The happy hour schedule.

  The prototype seeds these at load. See `seedParents()`, `seedMods()` and `migrateLib()` in the prototype.
