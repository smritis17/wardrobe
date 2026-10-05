# Wardrobe

A private closet app for my phone: see every piece, plan today's outfit, track what's in storage and how often things get worn, and keep a wish list.

Live at https://smritis17.github.io/wardrobe/ (open in Safari, then Share → Add to Home Screen).

## How it works

- **Closet**: every piece on a tile. New pieces start as a drawn shape in their real colour; add a photo whenever and the background is removed automatically. Stored pieces are faded and tagged with where they are.
- **Plus circle**: tap it on any piece to add it to today's outfit. The Today tab shows what's picked; "Wore it today" logs a wear for each piece.
- **Colour** and **Storage** are two more views of the same closet: one sorted by colour, one grouped by storage place.
- **Wear counts** are on by default for clothing and off for shoes, bags, sunglasses and accessories. "Count wears" on each piece changes that.
- **Wish list**: things to buy, with a link to the shop.

## Where the data lives

Only on the phone. Details are in `localStorage`, photos in IndexedDB. Nothing is uploaded, and this repo holds only the app's code. "Backup & storage" at the bottom of the Closet saves or restores everything as one file.

Background removal runs on the phone with [@imgly/background-removal](https://github.com/imgly/background-removal-js). Its model (about 55 MB) downloads the first time a photo is added and is kept by the service worker.

## Development

Plain HTML, CSS and JavaScript with no build step. Serve the folder (`python3 -m http.server`) and open it.

Bump `CACHE` in `sw.js` on every change, or phones keep showing the old version.
