# Worn Well

A private closet app for my phone: see every piece, plan outfits around the weather, track what's in storage and how often things get worn, and keep a wish list.

## How it works

- **Closet**: every piece on a tile. New pieces start as a drawn shape in their real colour; add a photo whenever and the background is removed automatically. Stored pieces are faded and tagged with where they are.
- **Plus circle**: tap it on any piece to add it to the outfit being built. A bar above the tabs says which outfit that is.
- **Outfits**: give an outfit an occasion (Work, Workout, Going out, or your own) and a day, or leave it for "Someday" to sit under Waiting to wear. A day can hold several outfits. The ten-day strip shows the forecast, and pieces tagged for the wrong season are flagged. "Wore it" logs a wear for each piece of clothing.
- **Colour**, **Storage** and **Wear** are more views of the same closet: sorted by colour, grouped by storage place, and wear insights (most worn, not worn this year, cost per wear).
- **Wear counts** are kept for tops, bottoms, dresses and outerwear, not for shoes, bags, sunglasses or accessories.
- **Wish list**: paste a shop link and its photo and title are fetched.
- **Looks**: three takes on a white gallery style, switched in Settings.

## Where the data lives

Only on the phone. Details are in `localStorage`, photos in IndexedDB, and this repo holds only the app's code. Settings has a backup file to save or restore everything.

Two things leave the phone, and only when those features are used:

- the coordinates of the city set for weather go to [Open-Meteo](https://open-meteo.com) (free, no account);
- a wish's shop link goes to [microlink.io](https://microlink.io) to fetch its photo (free tier, 25 links a day).

Background removal runs on the phone with [@imgly/background-removal](https://github.com/imgly/background-removal-js). Its model (about 55 MB) downloads the first time a photo is added and is kept by the service worker.

## Development

Plain HTML, CSS and JavaScript with no build step. Serve the folder (`python3 -m http.server`) and open it.

Bump `CACHE` in `sw.js` on every change, or phones keep showing the old version.
