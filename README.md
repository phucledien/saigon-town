# Saigon Town

A complete local six-year negotiation board game inspired by Chinatown, hosted on Sites. One person plays against Linh, Minh and An, three scripted computer neighbors. The primary game interface and bargaining dialogue support Vietnamese and English. Game progress stays in the current browser.

## Playing

Choose offered addresses, negotiate any package of cash, shop pieces and owned plots, permanently build shops, and collect annual income. Same-owner shops of the same type connect only across shared edges within a neighborhood. The richest player after the sixth payday wins; placed shop pieces break ties.

The 72 plots form six different irregular shapes, with stepped rows and cut-out corners. Courtyards, rooftops, roads and diagonal corners never create connections. `dist/board-layout.mjs` is the shared geometry used by rendering, income, computer moves and trade valuations.

Shop targets: Cà phê 3, Bánh mì 3, Phở 4, Tiệm hoa 4, Tiệm may 5, Tạp hóa 6. Incomplete groups of 1/2/3/4/5 pieces earn 10/20/40/60/80 đ annually. Complete targets of 3/4/5/6 earn 50/80/110/140 đ. Larger groups pay complete target-sized sets plus an incomplete remainder. The rack explicitly shows stock, connected-piece targets and annual payouts.

Keep 5/4/3/2/2/2 addresses in years 1–6. Receive five shop pieces initially, then four per year from a 120-piece bag. Cash starts at 50 đ. These are fictional game values.

## Interface and art

- One full-viewport game screen with a fixed player HUD, zodiac wheel, bottom action belt, and a collapsible shop rack. No page scrolling is needed to reach controls. There is no district shortcut bar or zoom-button toolbar; two-finger pinching controls map scale.
- An Aseprite city board with automatic camera sizing, swipe-to-pan movement, and pinch zoom anchored between the fingers. Default camera sizing keeps plots at least 45 screen pixels wide; players can deliberately pinch out to an overview. Keyboard focus brings offscreen plots into view. High-contrast signs use six original, transparent monochrome Aseprite icons. The faint map title has been removed.
- Touch gestures are separated: the map pans, the rack scrolls horizontally, and dialogs scroll their contents. The mobile HUD drops its separate brand row, shortens the action belt, and uses a compact shop drawer that closes after touch selection. Touch building uses tap-piece then tap-plot; mouse drag-and-drop remains available. Dialog positioning follows the phone keyboard viewport.
- Ninja Lead scooter riders, a bus with passengers, walking pedestrians and fictional lotus banknotes. Nine corrected zebra crossings follow the roads, clear the center markings and have paired curbside traffic lights. Pedestrian foot-contact paths align with the corrected crossings. Street animation persists across state renders.
- Dismissible phase guides, address-reveal reels, target highlights, quick building, zodiac turns, flying banknotes and wallet count-up.
- A visual two-sided bargaining table with inventory limits, plot/piece shortcuts, counteroffers, and scripted Vietnamese/English reactions.
- Original synthesized lo-fi music defaults on when there is no saved preference, starting after the first user gesture. Explicit mute remains respected. A separate music-and-sound settings panel controls music and tap effects independently. Bot reactions use moving vowel formants: happy ascending babble, skeptical descending babble, and thinking murmurs. No recorded voices or external audio services. All speech follows the sound-effects switch; music has its own switch. Gesture unlock, visibility pause, overlap cancellation and cleanup are enforced.
- An old bound shop ledger with ruled pages, completion stamps, per-business earnings, expansion notes, totals, and page navigation.

All raster artwork was drawn and exported through native Aseprite, with editable layered sources and reproducible Lua scripts under `art/`. The in-game artbook offers source and PNG archives. No AI panorama remains in the active board.

## Saved games

The existing storage key `vietnamtown-save-v1` is intentionally preserved after the rename. The irregular-map revision retains plot IDs, owners, placed shops, cash, hands, bag, current phase/year and previous payouts. It changes visible adjacency, so future income and trade values follow the new geometry. The first load records this transition once in the journal and shows a brief notice. New games start directly on this board revision.

## Research and adaptation

[Chinatown on BoardGameGeek](https://boardgamegeek.com/boardgame/47/chinatown) · [2014 Z-Man Games rulebook, mirrored](https://cdn.1j1ju.com/medias/46/fa/78-chinatown-rulebook.pdf).

Retained: six rounds, package negotiation, permanent shops, shared-edge businesses, repeat income, overflow scoring and cash victory. Adapted: 72 plots rather than 85, six business types, a larger tile supply, visible cash, sequential address choices and scripted opponents. The fictional city layout and artwork are original. The research notebook links cultural storefront and landmark references. Its prose and historical game-log entries remain English.

## Development and validation

Static ES modules in `dist`; no build step. Serve that directory over HTTP. Run `node --test tests/*.test.mjs`.

Twenty-four camera/gesture/audio-preference/engine/trading tests pass, including pinch anchoring and zoom limits, two-finger to one-finger transitions, cancellation and tap protection, default music versus saved mute, reachability of all 72 plots at phone and landscape dimensions, camera bounds and tray resizing, 100 complete simulated games, resource conservation, permanent placement, mixed trades, exact counteroffers, geometry bridges, overflow income, one-time payday, and saved-state migration preservation. Audio mocks cover formant creation, positive/negative cadences, overlap cancellation, phase transitions, independent muting, visibility and cleanup.

Feature-detected WebMCP exposes game state, address claims, build, placement, quote/propose trade, payday and year advancement. Contract checks use an isolated fresh game; existing player saves must not be mutated for testing. Broad browser visual testing was not requested.

The existing private Sites link is retained under the new Saigon Town name. There is no backend, online multiplayer or remote game-state storage. Online rooms and wider economy playtesting remain future work.

## Mobile interaction references

The compact HUD uses contextual controls, direct object manipulation, reachable primary actions and fewer persistent overlays, informed by [Apple Game Controls](https://developer.apple.com/design/human-interface-guidelines/game-controls). The pointer state machine follows the interaction lifecycle described in [MDN Pinch Zoom Gestures](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures), with world-anchor preservation and cancellation handling. Music starts on a user gesture in accordance with [browser autoplay policies](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay). These informed implementation; physical-phone visual QA has not been performed.
