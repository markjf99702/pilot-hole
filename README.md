# Pilot Hole

**Use it: [junkdrawer.works/pilot-hole](https://junkdrawer.works/pilot-hole/)**

**The drill bit for any screw, bolt or insert, in the bits you own.** Pick a fastener and what it's going into, and Pilot Hole gives every hole that matters: pilot, shank, countersink or counterbore, tap drill and clearance, plus the wrench or hex key it takes. Each answer names the nearest bit in the sets you've ticked and how far off it is. Lay a stray screw from the junk drawer on the screen and it tells you what it is.

## How it works

- **Holes.** Wood screws #2 to #14; machine screws and bolts #0-80 to 1/2-20 and M2 to M12, coarse and fine; lag screws, sheet-metal screws, heat-set inserts for 3D prints, threaded inserts for wood, dowels, shelf pins and 35 mm hinge cups. They go into hardwood, softwood, plywood, MDF, aluminium, steel or a printed part. A section through the joint shows where each hole goes, coloured to match its card.
- **In your bits.** Tick the sets in your drawer (fractional, number, letter, metric, the drills from a tap set, Forstner bits) and add loose ones. Each hole names the bit of yours that suits it best and how far off it is: exact, 0.0018″ big, or the 72% thread a 13/64″ bit gives a 1/4-20 tap. When nothing you have will do, it says what to get and what's wrong with the nearest either side: "95% thread: too tight, the tap may snap".
- **The drill index.** Each set you own is drawn as a steel case with every bit standing in a hole sized to it: gold fractional bits, black number bits, bright letter bits, cobalt metric ones. Tap a bit to see everything it's right for, in pilot holes, tap drills, clearance holes, inserts and counterbores; tap 7/64″ and it lists the pilot for an old-style #8 in hardwood, the shank hole for a #4 and the tap drill for #6-32. Mark the ones that went missing, and the answers stop using them.
- **The screw gauge.** Calibrate the screen once by matching a line to the end of a bank card (85.60 mm long, the same for every card), lay a screw on the glass, and slide two jaws to its threads and its length. Hold its threads against true-size combs that span ten threads, so 1/4-20, M6 × 1 and 1/4-28 come apart, and it names it: 1/4-20 × 1½ hex bolt, M3 × 0.5 × 10 socket head, #8 × 1¼ wood screw, with its holes and tools. Lay a drill bit down instead and it says which one it is. The gauge locks pinch-zoom, ignores a finger holding the card or the screw, and asks again if the screen or the zoom changes.
- **Where the numbers come from.** Number and letter drills from ASME B94.11M. Unified inch threads (ASME B1.1) and ISO metric threads (ISO 261 and 262), with tap drills by the shop formula for a 75% thread, which lands on the usual chart bit for every thread. Close and free clearance from the Little Machine Shop chart for inch sizes and ISO 273 for metric. Wood screw pilot, shank and counterbore sizes from WOOD Magazine's chart, for production and traditional screws. Socket, button and countersunk heads from ASME B18.3, ISO 4762, ISO 7380 and ISO 10642; hex heads and nuts from ASME B18.2.1 and B18.2.2 and ISO 4014 and 4032. Lag lead holes from the NDS, sheet-metal pilots from ASME B18.6.4, heat-set insert holes from Ruthex and CNC Kitchen, wood insert holes from E-Z Lok's chart, and hinge cups on Blum's 45/9.5 pattern.
- No account and no server. Your bits stay in your browser; save a copy to move them to another device. It works offline and installs to a phone's home screen. Light and dark follow your phone.

## Running it

It's a static site: plain HTML, CSS and JavaScript modules, with no build step.

```sh
npx serve .                   # or any static file server, then open the printed address
npm test                      # the tables and the hole maths (Node 20+), then the real page in Chromium (needs Playwright)
node tools/make-icons.mjs     # redraws the PNG icons from icon.svg
```

To put it online with GitHub Pages: **Settings → Pages → Build and deployment → Deploy from a branch**, then pick `main` and `/ (root)`.

### Files

- `js/drills.js`: every bit in the four series, Forstner bits, and the sets they come in. `js/threads.js`: inch and metric threads, tap drills and clearance holes. `js/fasteners.js`: wood screws, heads, lags, sheet-metal screws, inserts, dowels, shelf pins and hinge cups, with the published numbers. `js/holes.js`: turns a fastener and a material into holes, picks the bit you own for each, and lists everything one bit is right for. `js/identify.js`: the gauge's arithmetic. No page code in any of them, so the tests run them in Node.
- `js/screens/holes.js`, `index.js`, `gauge.js` and `bits.js`: the Holes screen, the drill index, the screw gauge and Your bits. `js/draw.js`: the drawings (bits standing in their holes, sections through the joints, icons). `js/app.js`: which screen goes with which address. `js/ui.js`: pieces every screen uses. `js/store.js`: saving in the browser, and the copy you can save.
- `fonts/`: Archivo (SIL Open Font License), served from here so nothing loads from elsewhere.
- `sw.js`: keeps a copy for using offline.
- `test/unit.test.mjs` checks every table against its published values, that the 75% formula picks the chart's tap drill for every thread, that every fastener in every material gives sensible holes, that every hole can be found again from its own bit, and the gauge's arithmetic. `test/e2e.mjs` uses it on a phone: picks fasteners and materials, ticks a metric set, marks a bit missing, saves and loads the bits, calibrates the gauge with a drag and names a bolt and a drill bit; then checks it installs and works offline.
