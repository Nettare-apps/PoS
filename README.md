# Pour Register: handoff packet

This packet carries the POS prototype work into a Claude Code project.

| Path | What it is |
|---|---|
| `CLAUDE.md` | Instructions Claude Code reads automatically: context, how Conner works, the non-negotiables. Put it at the repo root. |
| `SPEC.md` | The full product spec and decisions log. |
| `prototype/pour-register.html` | The clickable prototype (version 39) and the reference for behavior. Open it in a browser. Test PINs are 1111 (staff) and 2222 (manager). |
| `data/pos_data.json` | Seed library: 377 products, 18 categories, starting counts. |
| `data/sources/` | The scripts and extracted data used to build the seed. |
| `data/README.md` | Notes on the seed data. |

## Starting in Claude Code

1. Create a new repo, for example `pour-register`, and copy this folder's contents into it, keeping `CLAUDE.md` at the root.
2. Open it in Claude Code.
3. A good first prompt: "Read CLAUDE.md and SPEC.md, open the prototype, then propose a stack and a build plan for the first milestone. Don't write code yet."

A sensible first milestone is the library, the pricing engine and the event log, with tests. Most other behavior depends on those three.
