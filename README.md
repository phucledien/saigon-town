# Saigon Town

[![Saigon Town: Vietnamese storefronts, colorful stools, and a neighborhood ready for business](dist/assets/saigon-town-og-v8.png)](https://vietnamtown.phucledien.chatgpt.site/)

**Pull up a stool. There’s a deal to make.**

[**Play Saigon Town →**](https://vietnamtown.phucledien.chatgpt.site/) · [Run locally](#run-locally) · [Explore the art](art/)

**1 player · 3 neighbors · 6 years · 72 addresses**

A browser board game about opening shops, bargaining with neighbors, and finding the right corner of a fictional Sài Gòn. Inspired by [Chinatown](https://boardgamegeek.com/boardgame/47/chinatown), built with original Aseprite artwork, and playable in Vietnamese or English.

*Chốt một kèo. Mở một tiệm. Gầy dựng góc phố Sài Gòn.*

<p align="center">
  <img src="dist/assets/shops/coffee.png" width="96" height="96" alt="Cà phê shop">
  <img src="dist/assets/shops/banhmi.png" width="96" height="96" alt="Bánh mì shop">
  <img src="dist/assets/shops/pho.png" width="96" height="96" alt="Phở shop">
  <img src="dist/assets/shops/flowers.png" width="96" height="96" alt="Tiệm hoa florist">
  <img src="dist/assets/shops/tailor.png" width="96" height="96" alt="Tiệm may tailor">
  <img src="dist/assets/shops/grocery.png" width="96" height="96" alt="Tạp hóa grocer">
</p>

## Six years to make your corner count

You play against Linh, Minh, and An across 72 addresses in six irregular neighborhood blocks. Each year has four steps:

1. **Receive.** Choose your offered plots and collect shop pieces. Your colored stools mark your addresses.
2. **Trade.** Offer cash, plots, and shop pieces. A neighbor’s spare piece might complete your business; your empty corner might be exactly what they want.
3. **Build.** Place shops on your empty plots. Matching shops of your color connect along shared edges within a block. Complete the target printed on each piece to earn more.
4. **Collect.** Every business pays its owner, including unfinished groups. Keep unused pieces for next year.

The most cash after the sixth payday wins. Placed shop pieces break ties. Building is permanent, and roads and diagonal corners do not connect shops. Amounts shown in **đ** are fictional game values.

## A little street life

- Six distinct storefronts: cà phê, bánh mì, phở, flowers, tailoring, and groceries.
- Ninja Lead riders, buses, walking pedestrians, and shop-opening animations.
- A woven chiếu action belt, plastic ownership stools, a tear-off calendar, and a handwritten-style business ledger.
- Visual bargaining, counteroffers, and Vietnamese or English reactions from your neighbors.
- Phase guides, flying banknotes, animated earnings, and locally synthesized lo-fi music and sound effects.

All raster artwork has editable native Aseprite sources under [art/](art/), with Lua drawing and export scripts. Start with the [shop notes](art/shops/README.md), [street-life notes](art/life/README.md), or [tabletop artwork](art/tabletop-v9/README.md).

## Controls

| Action | Desktop | Phone or tablet |
| --- | --- | --- |
| Move around town | Drag the map | Swipe the map |
| Zoom | Mouse wheel or trackpad scroll over the map | Pinch with two fingers |
| Build a shop | Select a piece and click your plot, or drag it onto the plot | Select a piece, then tap your plot |
| Start a trade | Click a neighbor or their plot during Trade | Tap a neighbor or their plot during Trade |
| Inspect | Click a player, plot, or the calendar | Tap a player, plot, or the calendar |

With the map focused, **arrow keys** pan, **+ / −** zoom, and **0** resets the view. The shop rack scrolls sideways. Music starts after interaction; music and effects have separate switches in **Settings**.

## Run locally

No build step or package installation. Serve `dist/` over HTTP:

```sh
git clone https://github.com/phucledien/saigon-town.git
cd saigon-town
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Python 3 is only the local file server; the game runs in your browser.

Run the tests with Node.js:

```sh
node --test tests/*.test.mjs
```

The suite covers the economy, trades, board geometry, saved games, camera and gesture behavior, menu and loading flows, audio lifecycle, and preservation of the animated street scene during rendering.

## Around the repository

| Path | What’s inside |
| --- | --- |
| [dist/](dist/) | The playable static site, styles, and exported assets |
| [dist/engine.mjs](dist/engine.mjs) | Game rules, income, trading, and scripted opponents |
| [dist/app.mjs](dist/app.mjs) | Game screen, menus, and interactions |
| [dist/board-layout.mjs](dist/board-layout.mjs) | Shared plot geometry |
| [art/](art/) | Layered Aseprite originals, scripts, and asset notes |
| [tests/](tests/) | Tests using Node’s built-in test runner |
| [docs/implementation-notes.md](docs/implementation-notes.md) | Economy tables, architecture, save migrations, and research references |

## Current scope

This is a **single-player local game with scripted bots**. There is no online multiplayer or backend. Progress is saved in the current browser; it does not sync between devices, and the local development URL has its own save. The app can be added to a home screen, but it does not provide offline caching.

The main game interface and bargaining dialogue support Vietnamese and English. The research notebook and historical journal entries remain English. The in-game artbook contains design references and downloadable source artwork.

Saigon Town is an independent adaptation with original artwork and a fictional map. Bundled fonts are Be Vietnam Pro, Lora, and Bungee; their license files are included in [dist/assets/fonts/](dist/assets/fonts/).
