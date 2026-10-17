# Testing 0.1.4

A checklist for the new things. Links open the files (⌘-click for a new tab).

## Big CSV tables

- [x] Open [huge.csv](huge.csv) (100,000 rows). It should open quickly and scroll smoothly to the end, with no "Show more" button.
- [x] Click a cell, hold ↓ for a while: the table follows the selection.
- [x] Type in the filter (e.g. `Malmö`), press ↩: it jumps to the first match.
- [x] Row numbers up to 100001 stay on one line.

## Markdown tables keep their width

- [x] In [the tour](markdown-tour.md), drag the right edge of a header cell in the wide table well past the text column.
- [x] Scroll far down and back up: the note keeps the same width the whole time.
- [x] Double-click the edge: the table and note go back to normal.

## PDF search

- [x] Open [presentation.pdf](presentation.pdf), press ⌘F and search for `steps`: it jumps to page 2 and highlights it.
- [x] ⌘G / ⇧⌘G (or ↩ / ⇧↩) step through matches; ⎋ clears.
- [x] ⌘+ / ⌘− / ⌘0 and pinch zoom the pages.

## Smart paste (in Plain or Side by Side)

- [ ] Open [people.csv](people.csv) in Numbers or Excel, copy a few cells, and paste them below: they become a Markdown table.
- [ ] Select the words `this link` here, then paste a copied URL over them: they become a link.

Paste here:

id,name,email,city,joined,score
1,Ada Lovelace,ada@example.com,London,1843-01-10,98.5
2,Grace Hopper,grace@example.com,New York,1944-06-01,97
3,Alan Turing,alan@example.com,Manchester,1936-11-12,99.1
4,Katherine Johnson,katherine@example.com,Hampton,1953-05-20,96.4

## Side by Side scrolling

- [ ] Open [the tour](markdown-tour.md), press ⌥⌘E. Scroll the left side, then the right: each follows the other.

## Tabs

- [ ] Close this tab (⌘W) and press ⇧⌘T: it comes back.
- [ ] ⌥⌘T on a line in Plain view turns it into a task (it used to be ⇧⌘T).

## Updates and help

- [ ] **Jot → Check for Updates…** says Jot is up to date (0.1.4 is the newest).
- [ ] **Help → Report a Problem…** opens a new GitHub issue with the versions filled in.
