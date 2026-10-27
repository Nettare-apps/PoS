import json, re
from pb_data import S, C, W, D, B, N, X

OZ = 29.5735
def sv(label, qty, unit, target, price, basis):
    return {"label": label, "qty": qty, "unit": unit, "target": target, "override": price, "basis": basis}
BAS = {"f": "frontline", "n": "net", "s": "sale"}

def onhand_for(pid, kind):
    zero = {30, 154}            # a couple at zero so 86 behaviour shows up
    if pid in zero: return 0
    if pid == 69: return 10     # Down East, as in the earlier examples
    return {"spirit": 3, "cordial": 2, "wine": 6, "dessert": 2, "beer": 24, "na": 24, "other": 1}[kind]

products, inv, cats = [], {}, []
def addcat(c):
    if c not in cats: cats.append(c)

def push(pid, name, cat, size, cost, basis, scale, servings, kind, pack=1, section=None):
    p = {"id": f"pb{pid}", "pb": pid, "name": name, "cats": [cat], "primary": cat, "section": section,
         "size": size, "pack": pack, "cost": cost, "basis": basis, "scale": scale, "servings": servings}
    products.append(p); inv[p["id"]] = onhand_for(pid, kind); addcat(cat)

for pid, name, cat, sec, ml, f, n, s, p1, p2, ret, sret, pb in S:
    b = BAS[pb]
    sv_ = [sv("1 oz", 1, "oz", 15, p1, b), sv("2 oz", 2, "oz", 15, p2, b), sv("Retail bottle", ml, "ml", 65, ret, "frontline")]
    if sret: sv_.append(sv("Sale retail", ml, "ml", 55, sret, "sale"))
    push(pid, name, cat, ml, {"frontline": f, "net": n, "sale": s}, b, {"min": 15, "max": 25}, sv_, "spirit", section=sec)

for pid, name, cat, ml, f, n, oz, pp, ret, pb in C:
    b = BAS[pb]
    sv_ = [sv(f"{oz:g} oz", oz, "oz", 15, pp, b), sv("Retail bottle", ml, "ml", 65, ret, "frontline")]
    push(pid, name, cat, ml, {"frontline": f, "net": n, "sale": None}, b, {"min": 15, "max": 25}, sv_, "cordial")

for pid, name, sec, ml, f, n, s, g5, g25, half, btl, togo, sret, gb, bb in W:
    g, bt = BAS[gb], BAS[bb]
    sv_ = []
    if g5:   sv_.append(sv("5 oz glass", 5, "oz", 20, g5, g))
    if g25:  sv_.append(sv("2.5 oz taste", 2.5, "oz", 20, g25, g))
    if half: sv_.append(sv("½ bottle", ml / 2, "ml", 30, half, g))
    sv_.append(sv("Bottle (dine-in)", ml, "ml", 30, btl, bt))
    sv_.append(sv("Bottle (to-go)", ml, "ml", 65, togo, "frontline"))
    if sret: sv_.append(sv("Sale retail", ml, "ml", 55, sret, "sale"))
    push(pid, name, "Wine", ml, {"frontline": f, "net": n, "sale": s}, g, {"min": 20, "max": 35}, sv_, "wine", section=sec)

for pid, name, ml, f, oz, pp, btl, togo in D:
    sv_ = [sv(f"{oz:g} oz pour", oz, "oz", 30, pp, "frontline"), sv("Bottle (dine-in)", ml, "ml", 33, btl, "frontline"), sv("Bottle (to-go)", ml, "ml", 65, togo, "frontline")]
    push(pid, name, "Wine", ml, {"frontline": f, "net": None, "sale": None}, "frontline", {"min": 25, "max": 35}, sv_, "dessert", section="Dessert & Fortified")

for pid, name, ml, pack, f, n, packp, single, sb in B:
    sv_ = [sv("Single (on-prem)", ml, "ml", 20, single, BAS[sb]),
           sv(f"{pack}-pack (to-go)" if pack > 1 else "To-go", ml * pack, "ml", 65, packp, "frontline")]
    push(pid, name, "Beer & Canned", ml, {"frontline": f, "net": n, "sale": None}, "frontline", {"min": 20, "max": 30}, sv_, "beer", pack=pack)

for pid, name, ml, pack, f, ret, onp in N:
    sv_ = [sv("On-prem", ml, "ml", 25, onp, "frontline"),
           sv(f"{pack}-pack (retail)" if pack > 1 else "Retail", ml * pack, "ml", 65, ret, "frontline")]
    push(pid, name, "Non-Alc", ml, {"frontline": f, "net": None, "sale": None}, "frontline", {"min": 25, "max": 35}, sv_, "na", pack=pack)

for pid, name, ml, f, ret in X:
    push(pid, name, "Bitters & Syrups", ml, {"frontline": f, "net": None, "sale": None}, "frontline", {"min": 50, "max": 65},
         [sv("Retail", ml, "ml", 65, ret, "frontline")], "other")

# ---------- recipes -> product depletion ----------
ALIAS = {
 "all day aromatic": 227, "aromatic": 227, "aromatic bitters": 227, "amaro cinpatrazzo": 96, "aplos ease": 238,
 "apologue persimmon": 127, "chipotle cacao bitters": 234, "citrus bitters": 229, "dampfwerk cider apple brandy": 70,
 "dampfwerk grape": 72, "four peel gin": 64, "ginger liqueur": 128, "jack rudy tonic syrup": 225,
 "judson & moore red corn bourbon": 13, "land of muses gin": 62, "lavender bitters": 237, "letherbee gin": 58,
 "malort": 110, "mawby": 195, "mawby (to fill the glass)": 195, "method sweet vermouth": 122, "sweet vermouth": 122,
 "dry vermouth": 121, "misguided spicy triple sec": 142, "triple sec": 143, "norden aquavit": 65, "norden raspberry": 151,
 "oppidan old tom": 63, "pickle beer": 215, "thornton signature single malt": 22, "zissou red bitter": 220 if False else 120,
 "grapefruit bitter": 235, "spicy celery bitters": 228,
}
UNIT = {"oz": OZ, "ml": 1, "dash": 0.92, "dashes": 0.92, "drop": 0.92, "drops": 0.92, "barspoon": OZ / 8, "bsp": OZ / 8}
def parse(ing):
    m = re.match(r"^\s*([\d.]+)\s*(oz|ml|dash(?:es)?|drops?|barspoon|bsp)\s+(.*)$", ing, re.I)
    if not m: return None
    qty, unit, name = float(m.group(1)), m.group(2).lower(), m.group(3).strip()
    pid = ALIAS.get(name.lower())
    if pid is None: return None
    return {"pid": f"pb{pid}", "ml": round(qty * UNIT[unit], 2), "spec": ing.strip()}

recipes = json.load(open("recipes.json"))
rec_by_name = {}
for r in recipes:
    if r["i"] and r["n"].lower() not in rec_by_name: rec_by_name[r["n"].lower()] = r

menu = json.load(open("menu_items.json"))
PLACEHOLDER = {("Cocktails", "Specialty"): 17, ("Cocktails", "Classics"): 15, ("Cocktails", "Something Like…."): 15,
               ("Cocktails", "Small Sips"): 9, ("Cocktails", "Brunch"): 14, ("Cocktails", "Non-Alcoholic & Hemp"): 9,
               ("Cafe Drinks", "Core Menu"): 5, ("Cafe Drinks", "Specialty & Seasonal"): 7,
               ("Dinner", "Plates"): 30, ("Dinner", "Bread"): 14, ("Lunch", "Brunch"): 18}
items, seen = [], set()
for i, m in enumerate(menu):
    key = (m["c"], m["n"].lower())
    if key in seen: continue
    seen.add(key)
    price, placeholder = m["p"], False
    if price is None:
        price, placeholder = PLACEHOLDER.get((m["c"], m["s"]), 12), True
    rec = None
    if m["c"] in ("Cocktails", "Cafe Drinks"):
        rec = rec_by_name.get(m["n"].lower().strip("' ")) or rec_by_name.get(re.sub(r"^'old fashioned'\s*", "", m["n"].lower()))
    recipe, spec = [], []
    if rec:
        spec = rec["i"]
        for ing in rec["i"]:
            x = parse(ing)
            if x: recipe.append(x)
    it = {"id": f"mi{i}", "kind": "item", "name": m["n"], "cats": [m["c"]], "primary": m["c"], "section": m["s"],
          "price": price, "placeholder": placeholder, "allergens": m.get("a", []), "station": m.get("st"),
          "recipe": recipe, "spec": spec}
    items.append(it); addcat(m["c"])

order = ["Cocktails","Whisky","Gin & Vodka","Brandy & Absinthe","Cane & Agave","Amaro & Aperitivo","Liqueur","Tonics & Tinctures",
         "Wine","Beer & Canned","Non-Alc","Cafe Drinks","Dinner","Lunch","Dessert","Pastries","Cheese & Charcuterie","Bitters & Syrups"]
cats = [c for c in order if c in cats] + [c for c in cats if c not in order]
json.dump({"products": products + items, "inv": inv, "categories": cats}, open("pos_data.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(products), "products,", len(items), "menu items,", sum(1 for x in items if x["placeholder"]), "placeholder prices,",
      sum(1 for x in items if x["recipe"]), "items with depletion recipes,", sum(len(x["recipe"]) for x in items), "ingredient links")
for x in items:
    if x["recipe"]: print("  ", x["name"], "->", [(r["pid"], r["ml"]) for r in x["recipe"]])
