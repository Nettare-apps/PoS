# Pour Register: product spec

Pour Register is a point-of-sale system for beverage-heavy, fast-changing programs. It is built first for Nettare: a Chicago restaurant, craft cocktail bar and café, open Thursday to Sunday. This spec describes the behavior agreed during the prototype phase. The clickable prototype (`prototype/pour-register.html`) is the reference implementation. Where this document and the prototype disagree, ask the owner.

Status as of 2026-10-26: button-level design is complete; the production build has not started.

---

## 1. Principles

- **Item-level, beverage-first.** Pricing, counts and depletion come from a product library that knows container size, cost and serving sizes. Food is simple: manually priced buttons, with recipe costing kept in its own tool.
- **Record everything.** Every button press and action is written to an append-only event log. Flag the owner if that ever creates a data-volume problem.
- **Lean, not a suite.** Toast and Square feel bloated and Clover is built for retail. Use an established processor (Square or Stripe) for payments rather than building payments.
- **Drafts, not passive saves.** Library changes go through save draft, publish and revert. The register only ever reads the published library.
- **Fast on the floor.** Phone (6.5", portrait) and iPad Air (portrait and landscape) are the target devices. The ticket is always reachable, and the nav stays pinned on the floor and register.

---

## 2. Scope

### In the prototype (behavior defined)

- Library: products, servings, categories with parents, modifiers, happy hour, publishing.
- Register: ring-in, standard and custom pours, quantity, modifiers, seats, courses, send, hold and fire.
- Ticket: checks, splitting, item actions, removals (discount, comp, void), check discounts, manager approvals.
- Floor: tables and areas, opening tabs, guest prompt, joining tables, moving and merging, filters and sort, state colours.
- Tabs: name, notes, allergies by seat.
- Staff: PIN lock, clock in and out, shift close, tab transfers.
- Happy hour: schedule, menu and item pricing, end-of-window prompt.
- Event log.

### Deferred to the production build (not designed beyond notes here)

- Payments through Square or Stripe, including card on file.
- Taxes. Totals already carry cents, and percentage discounts are exact.
- The KDS. The prototype has a "KDS test" fulfil button only.
- Reporting. Every input needed is in the event log; see section 15.
- CSV inventory upload. The owner prefers this to a built-in inventory tool, because MarginEdge and Fintech already cover inventory and invoices.
- Real authentication, multiple devices, live shared state, and an offline mode.
  - With live shared state, approval requests and transfers must reach a manager or employee already signed in on another device.
  - The owner expects professional developers to own offline mode and other delicate parts.
- Tip-out and cash due at shift close.

---

## 3. Roles and auth

- Staff sign in with a 4-digit PIN. The prototype test codes are:
  - 1111 Alex (Staff)
  - 2222 Morgan (Manager)
  - 3333 Jordan, 4444 Riley, 5555 Casey (Staff)
- Signing in clocks the person in if they aren't already, and records the time.
- **Lock** returns to the PIN pad. **Clock out** goes through shift close (section 13).
- Permissions are a role-by-action table:
  - Staff need manager approval for discounts, comps and voids.
  - Managers can apply all three themselves.
  - Keep it a table so per-role limits (for example "staff may discount up to 10%") can be added later.

---

## 4. Data model (conceptual)

### Product (pour)

| Field | Notes |
|---|---|
| `id`, `name` | |
| `cats[]` | tags; a product can be in several categories |
| `primary` | the reporting category |
| `section` | |
| `size` | container size in mL |
| `pack` | units per pack |
| `cost` | `{frontline, net, sale}`, each a price per container |
| `basis` | the default cost basis |
| `scale` | `{min%, max%}`, the custom-pour cost range |
| `servings[]` | see below |
| `allergens[]` | |
| `hh?` | item happy hour override |

Each serving is `{label, qty, unit oz|ml, target %, basis, override?}`.

### Menu item

| Field | Notes |
|---|---|
| `kind:'item'`, `id`, `name`, `cats[]`, `primary`, `section` | |
| `price` | whole dollars |
| `placeholder` | true when the price is a placeholder |
| `allergens[]` | |
| `station` | |
| `recipe[]` | `{pid, ml}` products it depletes |
| `hh?` | item happy hour override |

### Library settings

- `parents` maps a category to its parent category.
- `hh` holds the happy hour schedule and menu rules.
- Ring-in unit (oz or mL).
- `mods`:
  - `groups[]`: `{id, kind?: seat|course, name, multi, alert, items[{id, name, price, link:{pid, ml}}]}`
  - `menus{category: [{gid, rule}]}`
  - `items{pid: {inherit:false, groups[]}}`
  - A rule is `required`, `force` (shown automatically, can be skipped) or `optional`.

### Floor

- Table: `{id, label, shape, x, y, w, h, area, min, std, max}`. The area drives reporting. `std` is the standard seating layout.
- Areas list. The seed areas are Dining Room, Bar and Chef's Counter.

### Tab

| Field | Notes |
|---|---|
| `id`, `no` | |
| `server` | staff PIN |
| `tables[]` | |
| `table` | the lowest table number, used for ticketing and KDS |
| `guests` | |
| `area` | |
| `name`, `notes` | |
| `allergies[]` | `{list[], seats[] or ['table']}` |
| `checks[]` | see below |
| `cur` | current check |
| `lines[]` | |
| `seatWarn?` | set after a full merge |
| `xfer?` | pending transfer id |
| `modified` | |

A check is `{id, label, seat?, origin?, adj?}`. The quick ticket behaves like a tab with no table.

### Line

| Field | Notes |
|---|---|
| `id`, `pid`, `label` | |
| `ml` | |
| `price`, `cost` | per unit |
| `kind` | `std`, `custom` or `item` |
| `qty` | |
| `part` | fraction of the item for split shares; default 1 |
| `mods[]` | |
| `seats[]` | seat numbers, or `share` for the whole table |
| `course` | |
| `deplete[]` | `{pid, ml}` |
| `status` | `new`, `held`, `fired` or `done`, with timestamps |
| `chk` | check id |
| `adj?` | see below |
| `hh?`, `basePrice?`, `hhWin`, `hhAsked?` | happy hour |
| `entryUnit`, `entry` | custom pours only |
| `repeatOf?`, `splitOf?` | |

An adjustment `adj` is `{kind: discount|comp|void, reason, note, pct|amt, made, by, at, state: pending|applied, approvedBy, approvedAt, reqId}`.

**Line total** is `(price + modifier prices) × qty × part`, less any applied adjustment.

### Request

Approval queue entry: `{id, scope?: 'check', tabId, chkId?, lineIds[], kind, reason, note, pct|amt, by, at}`.

### Transfer

`{id, from, to, tabIds[], at}`.

### Event

`{ts, type, user, tab, ...data}`, append-only. See section 15.

**Money.** Store money as integer cents in production. The prototype uses floats.

---

## 5. Pricing engine

### Standard pours

- price = cost-per-mL (on the serving's basis) × mL ÷ target %, rounded to the whole dollar.
- A manual override replaces that price.
- All seed overrides were cleared on purpose (2026-10-26). Pours price from target until the menu is reconciled at go-live.

### Custom pours (sliding scale)

- The container is split into 10 buckets, one per 10% of its volume.
- The cost % slides linearly from `scale.min` (bucket 1) to `scale.max` (bucket 10). Smaller pours carry a lower cost %.
- price = cost-per-mL × mL ÷ bucket %, rounded to the whole dollar.
- Custom pours price from the product's custom-pour basis, which is chosen separately from each button's basis.

### Snapping

- A custom volume that matches a standard pour rings in at that standard price.
- If several standards match (an on-premise bottle and a retail bottle, say), the bartender picks one.

### Cost basis

- Chosen per button: a 5 oz wine on net, a bottle on sale, for example.
- Net is expected to be the most used.

### Theoretical cost

- Always the lowest of frontline, net and sale, because that is what was actually paid.
- This is independent of the basis used for price.
- Cocktail recipe cost uses the same rule.

### Rounding

- Base menu and pour prices are whole dollars.
- Percentage discounts, happy hour % off and check math are exact to the cent. Guests can see the % and do the math.
- Display cents whenever an amount has them.

### Units

- The ring-in unit (oz or mL) is set in the library.
- On the custom pour keypad the bartender can switch oz or mL for that one ring. It resets after every ring-in, and switching converts the number already typed.
- The line keeps the volume in mL and records the unit and the number entered.

---

## 6. Inventory and counts

- Counts start from an on-hand bottle count per product (manual for now; the production source is CSV upload).
- The product screen shows bottles remaining and how many pours of each serving are left.
- Open-ticket pours come off the live count immediately.
- Depletion is posted when a check closes. It is qty × part × mL, plus recipe and modifier-linked `deplete` entries.
- Voided items are never made, so they never deplete. Comps and discounts deplete.
- Waste is reconciled through inventory counts, not assumed.
- **86:** a product at zero is non-interactable unless manually marked available.
- **Quick edit (long-press a product):** count, available or 86, price and cost. Quick edits should be rare, so each one is flagged and logged, and must be easy to find in reports.

---

## 7. Library

- **Tabs:** Products, Modifiers, Happy hour.
- **Publish bar:**
  - Discard edits.
  - Revert to published.
  - Save draft.
  - Publish.
  - The register shows a banner when the draft differs from what is published.
- **Categories:**
  - Multi-tag.
  - Rename and delete.
  - Parent categories:
    - Spirits over Whisky, Gin & Vodka, Brandy & Absinthe, Cane & Agave, Amaro & Aperitivo and Liqueur.
    - Modifiers over Tonics & Tinctures and Bitters & Syrups.
    - Food over Dinner, Lunch, Dessert, Pastries and Cheese & Charcuterie.
  - Each product also has a primary (reporting) category.
- **Products:**
  - Name, costs, size and pack, basis, scale, servings (label, amount, unit, basis, target %, override), on-hand count.
  - The modifier setup (inherit or its own groups) and the happy hour setting.
- **Menu items:** price, allergens, linked recipe (which shows its cost), modifiers and happy hour.
- **Layout:** the list on the left stays pinned with its own scroll on iPad, and the editor scrolls with the page.
- **Modifiers manager:**
  - Groups with items. An item can carry a price and an optional product link (pid, mL) for depletion.
  - Each group is assigned to menus (categories) with a rule.
  - Seat and Course are built-in groups.
  - A new group can be created from an item's page; it stays a group, tied to that item only.

---

## 8. Register

### Navigation

- Home · Floor · Library, pinned at the top on the floor and register.
- There is no Register nav button. The register is reached only by picking a table, a tab or Quick ticket on the Floor.
- The ticket header has a "← Floor" button.

### Pending lock

If a check has items that are new and have no course (not sent, held or coursed), leaving it shows **Pending items**. Leaving means the nav, ← Floor, or changing tabs. The choices are:
- **Discard:** removes them and logs it.
- **Stay on this check.**

### Ring-in

- Category chips, then sub-category chips.
- Product grid, then the pour screen:
  - Counts.
  - Standard pour buttons with price and how many are left.
  - Custom pour: sliding-scale gauge, bucket, cost target and price.
  - The custom keypad with the per-ring oz/mL toggle.
- A quantity bar (− 1 +, ×2, ×3, ×4, ×6) sets the quantity for the next ring-in.
- **Repeat** copies the selected item, or the last item on the current check. The copy gets no seats and no adjustment, and is re-priced for the current time (happy hour).

### Modifier screen

- Opens automatically after ring-in when a required or force-shown group applies. Tapping an item on the ticket also opens it.
- It is a full page, scrolled to the top, with a sticky Done button on the right.
- Group order: Seats, Course, then by rule.
- Done, Send and Close are blocked until required groups are answered.
- A Check row moves the item to another check when there is more than one.

### Seats

- Seats behave like a modifier group: "Share (table)" plus seats 1 to N.
- N is the table's standard layout, or the party size if that is larger.
- Several seats can be chosen. For seats on one item:
  - **Quantity equals seat count:** one each.
  - **Quantity 1:** shared.
  - **Anything else:** shown as "3 across 2 seats".

### Courses

- One course per item, from the Course group, which also sets firing order.
- **Send** sends new items and coursed held items:
  - If any of them has a course, a prompt asks which courses go now. The rest stay held.
  - New items without a course always go.
  - Afterwards it returns to the Floor.
- **Stay** does the same but stays on the check.
- **Hold** saves new items as held.
- **Send new** fires only items rung in since the last send or hold.
- Held courses get "Fire course N" buttons.
- Held items without a course fire one at a time: select the item, then "Fire selected item".

### Send across checks

If unsent items sit on more than one check, Send, Stay and Send new first ask:
- **Send all checks:** the default.
- **Only this check.**

### Item actions

- Selecting an item on the ticket shows **Remove** and **Split item** under it.
- There is no × on the line.
- Quantity can't change once an item is sent, adjusted or split into a share.

### Floor colours (KDS-driven)

| Colour | Meaning |
|---|---|
| Green | open, nothing sent |
| Blue | fired, waiting |
| Orange | waiting with items held |
| Red | fulfilled with items held |
| Grey | all fulfilled |

Unsent items are already accounted for in these states.

---

## 9. Checks and splitting

- Every tab has one or more checks.
- A bar at the top of the ticket shows each check with its total.
- Tap a check or swipe across the item list to switch. New items ring onto the current check.
- **Check bar actions:**
  - **Split:** the split screen.
  - **+ Check:** adds an empty check.
  - **Split by seat.**
  - **Combine:** puts everything back on one check. Shares stay as separate lines.
- **Split screen:**
  - Every check side by side.
  - Tap items, on any check, to select them, then tap the check they go on, or "+ New check".
  - Empty checks can be removed.
  - With exactly one item selected, "Split this item" is available.
- **Split item:**
  - **Separate some of a quantity** onto its own line, on the same check, another check or a new check.
  - **Divide into equal parts:** halves, 3, 4, 5 or 6 ways, or any number from 2 to 20. Optionally put each part on its own check, starting with the current check and adding checks as needed.
  - A $ amount adjustment on the item is divided proportionally.
  - Splitting is blocked while a removal on that item is pending.
- **Split by seat** builds one check per seat:
  - **Single seat:** the item goes to that seat's check.
  - **Quantity equals seat count:** one each.
  - **Otherwise:** shares, as is the whole-table "share" seat across all seats.
  - **No seat:** a "No seat" check.
  - Blocked while a removal or check discount is pending or applied.
- **Close** closes the current check:
  - It posts depletion and logs the close with an attribution of every discount.
  - Closing the last check closes the tab and returns to the Floor.
  - A check can't close while a removal on it is waiting on a manager.

---

## 10. Removals (discount, comp, void) and approvals

### Per-item flow

1. **Remove, then choose the kind.**
   - Unsent items offer **Delete** (no approval needed, nothing was made), Discount and Comp.
   - Sent items offer Discount, Comp and Void.
2. **Reason.** Preset reasons for each kind, plus a note. "Other" requires a note.
   - Discount reasons: Regular / industry, Service recovery, Promo, Price correction, Other.
   - Comp reasons: Service recovery, Quality / sent back, Wrong item made, Walkout, Staff drink, Manager guest, Tasting / promo, Other.
   - Void reasons: Rung in error, Duplicate ring, Wrong check, Guest changed mind, Other.
   - Discount amount: 10, 15, 20, 25 or 50%, an open %, or an open $.
3. **Code.**
   - Someone with permission taps Apply.
   - Staff without permission see a manager PIN pad (applies immediately under that manager) and a **Request** button.
   - A request keeps the item on the check at full price with a "… pending" badge.

### What each kind means

- **Void means never made.** The item comes off the check, stays in inventory, and shows struck through at $0.
- **Anything that was made is a comp.** The item stays on the check at $0 and depletes.
- **Discount:** the original price is shown struck through next to the new price.

### Check-level discount

- A Discount button on each check offers % (presets, open %, open $) or "Comp whole check".
- It uses the same reason, code and request flow.
- A check discount ignores items that already have their own discount, comp or void.
- A full check comp takes whatever is left on every item, including the remainder of items with their own discount.
- The reason is split per item in the close attribution: the item's own reason for its portion, the comp reason for the rest.

### Approvals

- When a manager signs in, the queue opens automatically if anything is waiting. A nav button (Approvals, Transfers or Inbox) shows the count.
- Each request shows the table and check, items, reason, who asked and how long ago, with Approve, Deny and Approve all.
- A denied request leaves "… denied by Morgan" on the item or check.
- Pending items can be cancelled by the server, or approved on the spot by a manager.
- A manager can undo an applied removal.
- Every step is logged, including failed codes and how long a request waited.

---

## 11. Floor

### Map

- The floor plan comes from the owner's layout image; in portrait it rotates 90°.
- It can be collapsed to show only open tabs.
- An edit mode covers table properties, area, guest range (min to max) and standard layout. For example, table 17 seats 3 to 5 with a standard layout of 4.

### Opening a tab

- Tap a table to get the guest prompt: count, tab name, notes and allergies.
- If the party is under the table's minimum, the prompt warns but still opens.
- If the party is over the maximum, choose "Seat anyway" or join tables: tap more tables until there are enough seats, with a confirm if there still aren't.
- Joined tables use the lowest table number.

### Tabs without a table

- "+ New tab" requires a dining area: one of the floor areas or **Standing room**.
- The tab reports under that area.

### Quick ticket

A check with no table.

### Open list

- Filters: All, Tables, Tabs (no table).
- Server filter: My tickets, All tickets, or a specific clocked-in employee.
- Order: Number (the default for tables), Most recent or Least recent.

### Mid-meal changes

- **Guest count:** tap "3 guests" in the ticket header to change it. It warns if the tables don't seat that many.
- **Move:** tap the table title in the ticket header, or long-press a table on the floor, then tap the new table.
- **Moving onto an occupied table:**
  - **Add as separate check:** the moving tab's checks keep their identity, labelled with the old table.
  - **Merge fully:** everything goes on the current check. Seat numbers are kept, and a popup plus a persistent tab note warn they may no longer be accurate.
  - Merging fully is blocked if the moving tab has a check discount.
  - Guests, notes and allergies combine, and pending requests follow the merged tab.

---

## 12. Allergies

- An "Add allergen" button sits in the new-tab prompt and in the tab's name and notes editor.
- It offers multi-select allergens (from the Allergens modifier group, plus an "Other" field) and a seat choice: whole table, or one or more seat numbers.
- Allergies show as a red strip at the top of the tab.
- Any item on an affected seat whose allergens match gets a bold "⚠ Seat 2 allergy: Tree nuts" line. Items with no seat are flagged too.
- Matching handles common naming differences: Dairy/Milk, Gluten/Wheat, Nuts/Tree nuts.
- The KDS must show these in production.

---

## 13. Shift close and transfers

### Close-out screen

- Clock out on Home opens a close-out screen with:
  - Hours.
  - Net sales and checks closed.
  - Items rung in.
  - Discounts, comps and voids (amounts and counts).
  - Pending removals.
  - Open tabs.
- Payment figures (tips, cash due, tip-out) come from the processor in production.
- Clock out stays disabled while the person has open tabs.

### Transfer all checks

- Pick a clocked-in employee.
- They either enter their code on the spot (takes effect now) or you send a request.
- A request pops up for them when they sign in, with Accept or Decline, and the nav button shows the count.
- A declined transfer leaves a "declined by …" note.
- The sender can cancel a pending transfer.

---

## 14. Happy hour

### Schedule

Editable in Library > Happy hour, and publishes like everything else.

| Day | Window |
|---|---|
| Thursday | 4:00 to 6:00 pm |
| Friday | 4:00 to 5:30 pm |
| Saturday | 4:00 to 5:30 pm |
| Sunday | 5:00 to 9:00 pm |

### Pricing

- Set per menu (category) or per item, never globally.
- The options are $ off, % off, or a set price (menu items only; pours get $ or % off per serving).
- **Precedence:** item rule, then primary menu, then other menus, then parent menus. An item can opt out.
- Happy hour changes the base price only, not modifier upcharges.
- % off is exact to the cent.
- No menu or item pricing has been set yet.

### Ring-in

- During the window, eligible items ring in at the happy hour price with an HH badge.
- The product screen shows "Happy hour until 6:00 PM" and tags eligible items.
- **End-of-window prompt:** within 5 minutes of the end, before or after, the register asks "Happy hour or Regular". The after side catches orders taken before the end and rung in late. The choice is logged.
- Every line records whether it was rung in during the window, so happy hour and standard sales can be compared.
- The prototype has a "Test time" control for simulating the clock.

---

## 15. Event log (audit)

Every action is an event. Event types in the prototype include:

- **Session:** login, lock, clock_in, clock_out, shift_close_open, test_time.
- **Ring-in and editing:**
  - ring_in (with hh, hhWindow, basePrice), qty_change, ring_unit.
  - modifier_add, modifier_remove, seat_assign, course_assign.
  - quick_edit, count_set.
- **Sending:**
  - send_scope, fire, hold, fulfil.
  - hh_prompt.
  - pending_prompt, pending_stay, discard_pending.
- **Removals:**
  - remove_tap, remove_all_tap, remove_flow, remove_unsent, remove_code_fail.
  - adjust_discount, adjust_comp, adjust_void.
  - adjust_request, adjust_request_cancel, adjust_approve, adjust_deny, adjust_undo.
- **Check discounts:**
  - check_discount_tap, check_discount, check_comp.
  - check_request, check_approve, check_deny, check_adjust_undo.
- **Checks:**
  - check_add, check_switch, check_move_item, check_move_items, check_combine, check_remove_empty.
  - split_open, split_by_seat, item_split.
  - close_check, close_tab, close_ticket. These carry sub, off, total, server, area and a per-item discount attribution.
  - close_blocked_pending.
- **Floor:**
  - open_tab, tab_edit, guest_change.
  - move_start, move_tab, move_cancel, merge_tab, seat_warn_dismiss.
  - allergy_add, allergy_remove.
- **Approvals and transfers:**
  - approvals_open, approvals_close.
  - transfer_start, transfer_request, transfer_accept, transfer_decline, transfer_cancel, transfer_code_fail, transfer_waited.
- **Library:** library_save_draft, library_publish, and similar.

Reporting needs these confirmed:

- Sales by area, server, category and primary category.
- Happy hour vs standard performance, using ring-in times and the hhWindow flag.
- Quick-edit frequency.
- Discounts, comps and voids by reason, person and approver, including how long approvals take.
- Theoretical cost and pour cost.

---

## 16. Decisions log (confirmed by the owner)

- Smaller pours carry a lower cost % that slides up; buckets every 10% of the container; cost basis per button.
- Percentages and other costs stay visible in testing; the final ring-in screen shows price only.
- The Register nav was removed; the ticket header has ← Floor; the pending-items lock applies.
- Seats work like a modifier group with a share option and can be multi-select; seat count comes from the table's standard layout or the party size if larger.
- One course per item; held items without a course fire manually, one at a time; any coursed item triggers the course prompt.
- Void means never made; made items are comps.
- Staff need manager approval for removals; checks can't close with a pending removal.
- Tabs without a table require an area or Standing room.
- Cheese & Charcuterie sits under Food.
- Theoretical cost uses the lowest cost on file.
- The ring-in unit can be chosen on each ring.
- Unsent items are already accounted for in the floor colours.
- Sending with unsent items on several checks asks, defaulting to send all.
- % discounts are exact; base menu prices stay whole dollars.
- Happy hour schedule as above; pricing per menu or item; a prompt within 5 minutes of the end.
- Price overrides were cleared for now and will be reconciled at go-live.
- One Burger (2026-10-27): the duplicate Lunch Burger was deleted from the seed; it is the same item on both
  menus, with the lunch price as a menu price modifier (+$4 over the $18 dinner price).

---

## 17. Open items

None of these block the build.

- Discount presets and reason lists are first drafts; review them with staff.
- Per-role permission limits (for example "staff may discount up to N%") are not designed yet.
- Floor rendering on the phone was accepted as is; revisit with real use.
- The seed data has 65 placeholder menu prices, assumed container sizes for beer, NA and bitters, and test inventory counts. Reconcile at go-live.

---

## 18. Seed data

`data/pos_data.json` holds 376 products: 256 pours from the Price Book and 120 menu items from the Menu Guide
(121 at handoff; the Lunch Burger was consolidated into the Dinner one on 2026-10-27 — see the decisions log and
`data/README.md`). It also includes 18 categories and starting counts.

- Cocktail and café recipes come from the Recipe Book and are matched to products through an alias map. Matching is limited to drink categories.
- The JSON still contains the Price Book serving overrides. The prototype strips them at load (`migNoOverride`).
- The owner's live apps (Price Book, Recipe Book, Menu Guide) are the long-term source; this file is a snapshot.
- How it was built is in `data/sources/`.
