# Vietnam Town

A complete, local, six-year negotiation board game inspired by Chinatown. Built as a static ES-module app for Sites. Play against three scripted computer opponents; progress is saved only in the current browser.

## Play

Choose offered plots, trade any package of cash / owned plots / shop tiles, then permanently build on your empty plots. Same-owner, same-type tiles connect along shared edges within a block. Receive income each year; most cash after year six wins, with placed tiles breaking ties.

The interface includes instructions, a game journal, business income breakdowns, and a source-backed design notebook under **Artbook**.

## Research and adaptation

Primary rules: [Z-Man Games Chinatown rulebook, 2014 (mirror)](https://cdn.1j1ju.com/medias/46/fa/78-chinatown-rulebook.pdf).

Reference: [BoardGameGeek](https://boardgamegeek.com/boardgame/47/chinatown).

Retained mechanics: six rounds, simultaneous-negotiation concept represented through package offers, permanent shops, orthogonal same-owner businesses, repeat income, oversized-group scoring, money victory and placed-shop tiebreak.

Adaptation: 72 plots in six fictional blocks named after places in Hồ Chí Minh City; six shop types; visible money; one human plus three scripted bots; sequential address choices. Shops are Cà phê (3), Bánh mì (3), Phở (4), Tiệm hoa (4), Tiệm may (5), and Tạp hóa (6). All UI amounts use đ as fictional game currency; balances and payouts are unchanged.

Original strategic income curve, expressed in đ:

| Size | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Incomplete | 10 | 20 | 40 | 60 | 80 | — |
| Complete | — | — | 50 | 80 | 110 | 140 |

Prototype allocations: keep 5/4/3/2/2/2 plots; offered up to two extra and return the remainder. Five shop tiles in year one, four thereafter. Twenty copies of each type in a 120-tile bag. A market-density and scarcity pass is still needed: these are intentional prototype differences, not original Chinatown allocations. Bots evaluate deals and optimize placements, but do not negotiate with one another or initiate offers.

## Next steps

1. Playtest business completion, frequency of trades, relative value of shop types, and affordability of counteroffers. Compare against a 12-type, 90-tile scarcity model.
2. Online rooms: authoritative server state; atomic resource validation; public unplaced tiles and private cash; simultaneous offers with versions/expiry; all-player ready checks; reconnect and undo policies; replayable game logs.
3. Aseprite art expansion: additional shop variants, people and seasonal details. The playable version now uses six distinct shop buildings, six landmarks, physical ownership tokens and the zodiac wheel.
4. Extend the Vietnamese/English interface to the research notebook and ask Vietnamese players to review the local voice.

## Development and validation

Serve `dist` over HTTP, for example `python3 -m http.server 4187 --directory dist`.

Run `node --test tests/*.test.mjs`. Coverage includes 100 seeded six-year simulations, all plot allocations, cash and tile conservation, permanent placement, adjacency boundaries, complete/incomplete/overflow income, rejection without mutation, ownership transfers and cash counteroffers.

The page feature-detects imperative WebMCP and registers read state, claim plots, begin build, place shop, quote/propose trade, collect income, and advance year tools. These use the same validated game actions as the UI. Registration and representative valid/invalid actions were checked in a supported browser context. Broader visual/browser UI testing was not requested and was not performed.

No backend, accounts, online multiplayer, external paid APIs, or network-stored game state. The private Sites audience is managed by Sites. Artwork is original pixel art authored using Aseprite Lua drawing APIs and saved as layered native documents; map geometry, copy, and interface are original. This is an independent prototype without affiliation to Chinatown’s designer or publisher.

## Tabletop redesign

The game now renders a zoomable and pannable street board, with numbered terrain plots, original shop building pieces, physical colored ownership tokens, market/church/villa/alley landmarks, moving scooter sprites, and a six-animal circular zodiac calendar. Original AI panorama assets were removed.

Drag ownership counters to offered plots; click or tap also places/lifts a counter. Drag shop pieces from the wooden rack to owned empty plots; select-and-tap works for keyboard and touch users. Placement is permanent, as before. Build and counter placement animate, income floats to wallets, and a year banner appears when advancing. Sound is optional and off by default; reduced-motion preferences stop recurring motion.

The sources under `art/` include native `.aseprite` files with named painting layers, Aseprite drawing scripts, and source/provenance notes. Aseprite was actually used to author/render the pixel drawings, not just convert an existing generated image. The artbook offers both source and PNG ZIP downloads. Shop and landmark references are linked in those notes and the in-game artbook.

No game rules, resource values or saved-game format changed. Old saves continue working and old currency labels in journal messages are normalized to đ.

## Living city update

The 1100×730 Aseprite board has offset neighborhoods, sloping boulevards, irregular sidewalks, curved park roads and river frontage. Plot IDs and within-block adjacency remain unchanged, so existing saved games keep their businesses and income. Decorative map/traffic elements stay mounted through game renders.

The Ninja Lead scooter includes a helmeted, sun-covered rider. A bus follows the main boulevard and pauses near its stop, and pedestrians use four-frame walk cycles at crossings. These are original drawings created and exported in native Aseprite; editable documents and drawing scripts are included in the artbook downloads. The zodiac dialog uses embedded copies of the original pixel sprites so its illustrations do not depend on a separate image request.

New interaction flow:
- Dismissible phase introductions with address-reveal reels, localized instructions, replay and highlights that also work on mobile.
- Compact player inventories with direct shop/plot trade shortcuts.
- A two-sided visual bargaining table, Vietnamese/English dialogue, inventory-limited selections, deliberate offer submission, rejection and editable cash counteroffers.
- Quick build selection from an owned plot or expansion selection from an existing business. Shop targets and connected-business progress are explicit.
- Animated zodiac turns, note flights from businesses to wallets and eased balance counting.
- Separate opt-in original synthesized lo-fi music and tap/event effects, with phase and bargaining variations, user-gesture unlock, visibility pause and reduced-motion support.
- Smaller controls in a shared bottom dock and a collapse control for more map space. Main game controls, instructions and trade dialogue support Vietnamese/English; the research notebook and historical engine log entries remain English.

Validation: all 12 engine and trading tests passed, including 100 full simulated games. Audio lifecycle mocks cover unlock, independent mute, phase changes, visibility and cleanup. Fresh isolated WebMCP test game completed receive, a rejected and accepted trade, building, payday and year advancement; duplicate placement and duplicate payday were rejected. Existing user/local saved games were not modified for this test.
