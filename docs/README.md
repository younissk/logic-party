# Course material

Local reference for building the minigames: JKU *Computational Logic for AI*,
WS 2025/2026 (Hofstadler, Seidl, with Kauers and Kutsia).

**The contents of this folder are git-ignored on purpose.** They are the
course's copyrighted material, kept here so the exercises can be built against
the real syllabus. Only this README and the `.gitignore` are tracked. Do not
commit the PDFs, and do not copy exam questions verbatim into the app — the
generators exist so the app makes its own.

To repopulate after a fresh clone, unzip the course archive into this folder:

```bash
unzip -q -j "path/to/Computational Logics.zip" -x "__MACOSX/*" -d docs/
```

## What is here

| Files | Chapter |
|---|---|
| `ln.pdf` | Full lecture notes — all five chapters, the authoritative source |
| `recap.pdf` | Recap deck |
| `sat2.pdf`, `sat3.pdf`, `gc.pdf` | Propositional logic and SAT (`gc` is the k-colouring encoding). Note `sat1.pdf` is **not** in the archive |
| `eq1.pdf` – `eq3.pdf` | Equational reasoning |
| `fo1.pdf` – `fo3.pdf` | First-order logic |
| `theories1.pdf` – `theories3.pdf` | Theories in first-order logic |
| `exam25a.pdf`, `exam26a.pdf`, `exam26b-A.pdf` | Past exams |
| `Exercise 1–12`, `Quiz 1–2`, `Collection of Practice Exercises` | Moodle exercise and quiz attempts |

## Syllabus

From the lecture notes' contents page. These are the four categories the app is
organised by, and the sections under each are what the minigames should cover.

**2 Propositional Logic** — syntax and semantics · normal forms · resolution ·
solving · certificates

**3 Equational Reasoning** — terms · substitution and unification · normal
forms · completion

**4 First-Order Logic** — syntax and semantics · normal forms · resolution ·
first-order logic with equality

**5 Theories in First-Order Logic** — quantifier elimination · natural numbers
· real numbers
