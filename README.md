# Vietnam Town

A complete, local, six-year negotiation board game inspired by Chinatown. Built as a static ES-module app for Sites. Play against three scripted computer opponents; progress is saved only in the current browser.

## Play

Choose offered plots, trade any package of cash / owned plots / shop tiles, then permanently build on your empty plots. Same-owner, same-type tiles connect along shared edges within a block. Receive income each year; most cash after year six wins, with placed tiles breaking ties.

The interface includes instructions, a game journal, business income breakdowns, and a source-backed design notebook under **Behind the game**.

## Research and adaptation

Primary rules: [Z-Man Games Chinatown rulebook, 2014 (mirror)](https://cdn.1j1ju.com/medias/46/fa/78-chinatown-rulebook.pdf).

Reference: [BoardGameGeek](https://boardgamegeek.com/boardgame/47/chinatown).

Retained mechanics: six rounds, simultaneous-negotiation concept represented through package offers, permanent shops, orthogonal same-owner businesses, repeat income, oversized-group scoring, money victory and placed-shop tiebreak.

Adaptation: 72 plots in six fictional blocks named after places in Hồ Chí Minh City; six shop types; visible money; one human plus three scripted bots; sequential address choices. Shops are Cà phê (3), Bánh mì (3), Phở (4), Tiệm hoa (4), Tiệm may (5), and Tạp hóa (6). Fictional M₫ amounts represent million đồng, not real economic estimates.

Original strategic income curve, expressed in M₫:

| Size | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Incomplete | 10 | 20 | 40 | 60 | 80 | — |
| Complete | — | — | 50 | 80 | 110 | 140 |

Prototype allocations: keep 5/4/3/2/2/2 plots; offered up to two extra and return the remainder. Five shop tiles in year one, four thereafter. Twenty copies of each type in a 120-tile bag. A market-density and scarcity pass is still needed: these are intentional prototype differences, not original Chinatown allocations. Bots evaluate deals and optimize placements, but do not negotiate with one another or initiate offers.

## Next steps

1. Playtest business completion, frequency of trades, relative value of shop types, and affordability of counteroffers. Compare against a 12-type, 90-tile scarcity model.
2. Online rooms: authoritative server state; atomic resource validation; public unplaced tiles and private cash; simultaneous offers with versions/expiry; all-player ready checks; reconnect and undo policies; replayable game logs.
3. Aseprite production assets: common sprite scale, six distinctive shop types, separate ownership overlays, PNG atlases, and optional opening animations. Current letter markers prioritize legibility.
4. Vietnamese/English localization and cultural review by Vietnamese players.

## Development and validation

Serve `dist` over HTTP, for example `python3 -m http.server 4187 --directory dist`.

Run `node --test tests/engine.test.mjs`. Coverage includes 100 seeded six-year simulations, all plot allocations, cash and tile conservation, permanent placement, adjacency boundaries, complete/incomplete/overflow income, rejection without mutation, ownership transfers and cash counteroffers.

The page feature-detects imperative WebMCP and registers read state, claim plots, begin build, and place shop tools. These use the same validated game actions as the UI. Registration and representative valid/invalid actions were checked in a supported browser context. Broader visual/browser UI testing was not requested and was not performed.

No backend, accounts, online multiplayer, external paid APIs, or network-stored game state. The private Sites audience is managed by Sites. Artwork is original generated raster art; map geometry, copy, and interface are original. This is an independent prototype without affiliation to Chinatown’s designer or publisher.
