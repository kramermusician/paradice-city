# Longboat Key: Paradice City (folder: longboat-cruise)

An open-world driving game for Kristian Gibson's birthday. Drive Dad's silver cars on the real streets of Longboat Key, over New Pass and the Ringling Bridge to St. Armands and downtown Sarasota at sunset, take his center-console boat out to his stone crab traps, and run a reefer truck full of cranberries to the Longboat Key grocery dock. Non-violent: no weapons, no hitting people.

Free and non-commercial. Live at https://kramermusician.github.io/paradice-city/ (Kramer's call, 2026-11-12). Two car models are CC BY-NC-SA 4.0: the site may never be sold, ad-supported or monetized, and the decimated copies of those two cars are shared under the same license.

Done when: Kramer can open the game in a browser, pick any of Dad's cars, drive Longboat Key's real streets over the New Pass and Ringling bridges to St. Armands at sunset, and play at least three short missions.

## Run

```
./run.sh --open
```

That serves this folder on port 8915 (only if nothing is serving there yet) and prints `http://localhost:8915/`. Without `--open` it only prints the URL. Chrome works best. No npm, no build step: three.js r169 is vendored in `vendor/`.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Gas | W or Up | Right trigger |
| Brake, then reverse | S or Down | Left trigger |
| Steer | A, D or Left, Right | Left stick |
| Handbrake drift (tires screech) | Space | A or right bumper |
| Camera: chase, driver's seat, overhead | C | Y |
| Swap car and boat at the dock, pull a trap (hold) | E | X |
| Change vehicle (the picker; V or Esc goes back) | V | Back / Select |
| Big map (zoom, drag, click to drop a target) | M, or click the minimap | |
| Fly: climb, descend (jet: pull up, dive) | Space, Shift | A, B or right stick |
| Pause menu (missions, change vehicle, settings, credits) | Esc or P | Start |
| Pick a vehicle on the select screen | Up, Down, Enter (or click) | D-pad, A |

## What is in it

- Vehicle select with a turntable: Porsche 911 Turbo S, Mercedes-AMG GLE 63 Coupe, BMW 7 Series, BMW 530i, BMW Z4 M Coupe, Audi TT, Kramer's Subaru Outback, Dad's boat, and the cranberry rig. Every vehicle has a spinning pinwheel antenna (the boat's is on the T-top).
- Free roam starts on Gulf of Mexico Drive. Arcade handling with speed-sensitive steering, handbrake drifts, building collisions. Cars that drive into the water splash and come back on the nearest road.
- Dad's boat (his Grady-White Fisherman 216, no name on the hull) is tied up at his dock on the canal behind his house on Cutter Lane (gold "Dad's place" marker in the street). Drive to it and press E to swap; drive the boat back to the dock and press E to get the car back. Boat physics: planes at about 35 mph, drifty turns, the bow rises with throttle and settles, wake, spray, bobbing, the propeller spins. It stops at the shoreline and slides along it.
- HUD: mph, the posted speed limit (from OpenStreetMap where tagged), area name, heading-up minimap with mission markers.
- Light ambient traffic on the main roads (toggle in the pause menu). Golf carts with drivers cross near the Harbourside course and Bay Isles. 18 boats (center consoles, sailboats, pontoons, cruisers, skiffs) cruise the bay and gulf near you, steer around land, give your boat room and bump off it.

## Kramer's Dropbox 3D set (added 2026-11-13)

- New in the picker: jet ski (a second boat; picking it ties it up at Dad's dock instead of the center console), Bugatti Veyron, Porsche 911 GT3, a life-size LEGO Technic Corvette, Mustang Cobra Jet, 1970 Firebird Trans Am, Lucid Air Sapphire (only when the game runs on this Mac, see licenses), Rolls-Royce Spectre and Phantom, a 2022 Subaru Outback, a fire truck and a golf cart.
- Police cruisers and the speed-trap SUV are the Ford Explorer police model with our own flashing light bar (the code-built cruiser is the fallback if the file fails to load).
- Two 32 m motor yachts cruise with the boat traffic. An LNG tanker steams up and down the Gulf about 3 km off the beach. Sea turtles swim near you in open water, surface for a few seconds and dive again, and slip away from a boat.
- Real palm models (three kinds, with bushes at their feet) replace the code-built palms within 240 m of you; farther out the cheap ones stay.
- Pipeline: the downloads in `~/Dropbox/3d assets/` (never modified) go through `build/prep_dropbox_assets.py` (Blender, background): turn front to +X, real size, on the ground, full-detail copy to `Owner's Inbox/3D Library/` with a `library.json` entry, decimated web copy to `assets/cars/` or `assets/props/`. `js/props.js` loads the props and merges each into a few meshes. Checks: `build/test/assets.cjs` (every new car from the chase cam), `props.cjs` and `props2.cjs` (jet ski, turtle, yacht, tanker, police), `tris.cjs` and `fps.cjs` (cost against the last commit).

## Flying (added 2026-11-13)

Three flyers are on the picker, all built in code: a jetpack, a white and orange helicopter, and an unarmed fighter jet. Press V any time to switch; a flyer takes off from wherever you are, and a car picked from the sky lands on the nearest road below.

- Jetpack and helicopter hover: W forward, S back, A/D turn, Space climbs, Shift comes down. They land on roads, ground and rooftops and stop at building walls. The helicopter's rotor is heard; the jetpack's flames grow with thrust.
- Fighter jet: starts at about 500 ft. W is full throttle (afterburner), S slows, A/D bank and turn, Space pulls up, Shift dives. Too slow and the nose drops. A gentle touchdown on land rolls; hitting the ground or a building hard bounces it back up with "Pull up!". No weapons.
- The HUD shows altitude in feet instead of the speed limit, the minimap zooms out, and the view distance and fog open up as you climb. Missions still need a car or the boat.

## Big map and targets

Click the minimap (or press M). Scroll to zoom, drag to move, click to drop a pink X. In a car a pink route line shows on the map and the road arrows lead there (when road arrows are on); in the boat or a flyer the top-right tag points the way with the distance. Arriving clears it; right-click or "Clear target" removes it. A mission's checkpoint takes over the arrows while the mission runs.

## Police (free roam)

Six patrol cruisers drive in traffic, a few now and then answer a call with lights on, and up to seven speed traps sit on the shoulder of Gulf of Mexico Drive and the Ringling Causeway. Go 15 mph or more over the limit within about 110 m of one, or bump one, and a chase starts (`js/police.js`). One star: a cruiser on your tail. 18 seconds: two stars, another cruiser. 40 seconds: three stars, a helicopter with a searchlight. Stop with a cruiser behind you and you get a warning; get more than about 320 m ahead for 5 seconds (10 with the helicopter) and you lose them. Cruisers top out near 105 mph, so the fast cars can get away. Nobody rams, shoots or gets hurt. Off during missions (the Cranberry Run keeps its own police) and switchable in the pause menu (Police patrols).

## Cyclists

Up to 40 riders in groups of one to four (pace lines), weighted toward Gulf of Mexico Drive, on the right-hand edge of the island streets (`js/bikes.js`). They pedal, slow behind you, and if you clip one they tip over, sit a moment and get back on. They follow the Traffic toggle.

## Settings (pause menu, saved in the browser)

- Road arrows on or off. During a car or truck mission, soft chevrons on the pavement lead to the next checkpoint along the real roads (`js/nav.js`: one shortest-path sweep per checkpoint, so a wrong turn re-routes at once). If the route is behind you a "Turn around" note appears. No arrows in free roam or on the boat.
- Camera: Chase, Driver or Overhead (same as the C key). The driver view hides the car body and shows a simple cockpit with a steering wheel that turns, because the scanned and decimated models have no clean cabin. Overhead looks straight down with your heading up the screen.
- Traffic on or off (cars, boats and cyclists).
- Police patrols on or off.

A gold "Dad's place" marker (D on the minimap) sits at the middle of Cutter Lane.

## Missions

Drive into a glowing marker to start one, or pick it in the pause menu to jump to its start.

1. Sunset Run (car): from Gulf of Mexico Drive on Longboat Key, over the New Pass Bridge, around St. Armands Circle, over the Ringling Bridge crest to the Sarasota bayfront before the sun goes into the Gulf (5:30). The sun really drops as the clock runs.
2. Check the Traps (boat): five soccer-ball buoys down the bay side of Longboat Key, the first about 1.1 km south of the dock and the last in the open water off Cutter Lane (positions in `PLACES.buoys`, `js/config.js`). Slow down beside each and hold E to pull the trap; each one gives a stone crab claw count.
3. Cranberry Delivery (car): crates on the roof from the Sarasota cold-storage warehouse on Fruitville Road to St. Armands Circle. Hard braking and crashes drain the crate meter.
4. Cranberry Run (any car, at the warehouse): intro in a dark freezer warehouse where robot forklifts load glowing crates into a white open-top reefer trailer. Then drive the articulated truck over the Ringling Causeway, around St. Armands, over New Pass and up Gulf of Mexico Drive to the grocery loading dock behind the Shoppes of Bay Isles, and back the trailer in. Speed limits are enforced the way Kramer asked (2026-11-12): the moment you are over the posted limit a police SUV lights up behind you; stop within 10 seconds for a ticket and a restart, or keep going and helicopters with searchlights join (one more every 15 seconds) until you stop or about 60 seconds pass, then a "Busted" card. Nobody rams or shoots. Hard braking and golf carts spill crates. Finish shows "Happy birthday Kristian" in the store window. Score is crates and time. There is a 3 second grace when the limit drops so you can slow down for a new sign.

## Data sources

- Map: © OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright). Fetched with `python3 build/fetch_osm.py` from public Overpass servers (polite, generic User-Agent, falls back to mirror endpoints; buildings only for the islands and downtown). Raw replies are cached in `build/raw/`; rerun with `--refetch` to update. Data was fetched 2026-11-12 (real OSM data, no hand-built fallback was needed).
- `build/bake_world.py` turns `data/areas.json` into `data/world.png` (land, parks, golf, beach mask at 5 m per pixel), used for the ground, the minimap, the shoreline physics and water tests.
- OSM has few house footprints on the key, so residential streets are lined with simple generated houses. Real footprints are used wherever OSM has them. The grocery store sits on its real OSM footprint (27.3673, -82.6244).
- Speed limits: OSM `maxspeed` where tagged (45 on most of Gulf of Mexico Drive, 35 near New Pass), with game values for St. Armands Circle (20), Bay Isles Parkway (25) and the store lot (15), per `research/longboat-key-asset-research-2026-11-12.md`.

## Birthday opening (2026-11-22)

For Dad's birthday (Nov 26). The first drive after load now starts on the Ringling causeway bridge, climbing toward downtown Sarasota with the bay on both sides, in a clear morning (sun 24 degrees up at bearing 115; above 6 degrees `G.setSun` blends the sky to blue, so Sunset Run's colours are unchanged). `?spawn=newpass` gives the 2026-11-18 New Pass start, `?spawn=key` the Gulf of Mexico Drive start. The New Pass start was tried for the opening too, but its road turns off the view of the sky.

- About 1 s in, the Extra 330sc stunt plane (`js/skywriter.js`) dives from behind and above, passes low beside the car with a whoosh (`whoosh()` in js/audio.js), then climbs straight ahead.
- From about 5 s to 12.6 s it writes HAPPY BIRTHDAY over DAD in white smoke on a vertical plane 1.7 km ahead of the spawn, facing the spawn heading. Letters are a small stroke font of polylines; the plane flies one path through every stroke (pen up between strokes) far faster than a real plane, dropping a smoke puff every 2.2 m. The smoke is one instanced billboard draw call; puffs grow, drift up and fade out over about 75 s.
- The plane then climbs off to the right and is gone by 19 s. Speeding stops are held off while it writes. It runs only on the first drive after load, never after a vehicle change. `?nointro=1` skips it.
- Model: `build/prep_stunt_plane.py` (Blender) makes the full copy `Owner's Inbox/3D Library/vehicles/extra-330sc-2026-11-22.glb` (with its library.json entry) and the web copy `assets/props/stunt-plane.glb` (about 1 MB, body plus a separate prop that spins). The download in Dropbox is never modified.
- Screenshots: `node build/test/opening.cjs [spawn] [prefix]` writes `screenshots/opening-*.png` at 2, 5, 8, 12 and 15 s plus the close pass, holding the throttle.

## Licenses and credits

Also shown in game under Esc, Credits.

- "2022 Porsche 911 Trubo S" by tonielpro520 (sketchfab.com/tonielpro520), CC BY 4.0. Repainted silver, decimated.
- "Mercedes-AMG GLE 63 Coupe 2022" by ceron_alex (sketchfab.com/ceron_alex), CC BY 4.0. Repainted silver, decimated.
- "BMW 7-series (F01)" by Black Snow (sketchfab.com/BlackSnow02), CC BY 4.0. Repainted silver, decimated.
- "2008 BMW 530i (E60)" by beanz_ncheese (sketchfab.com/aiden.constante), CC BY 4.0. Repainted silver.
- "2006 BMW Z4 M Coupe (E86)" by Ddiaz Design (sketchfab.com/ddiaz-design), CC BY-NC-SA 4.0. Repainted black.
- "2004 Audi TT Coupe 3.2 Quattro" by OUTPISTON (sketchfab.com/outpiston), CC BY-NC-SA 4.0. Repainted silver, decimated.
- Dropbox set (2026-11-13), all from Sketchfab: "Jet Ski (RWB)" by KnightOwl, CC BY 4.0. "2014 Bugatti Veyron Legend Ettore Bugatti", "LEGO Technic Chevrolet Corvette Stingray 42205" and "2018 Ford Mustang Cobra Jet" by Ddiaz Design, CC BY-NC-SA 4.0. "Porsche 911 GT3" by ChevroletSS, CC BY 4.0. "1970 Pontiac Firebird Trans Am" by everhard, CC BY 4.0. "Rolls Royce Spectre" by iSteven, CC BY-NC-SA 4.0. "2022 Rolls-Royce Phantom Extended Series II" by ig.ghazigfx, CC BY 4.0. "2022 Subaru Outback" by tonielpro520, CC BY 4.0. "Low Poly Fire Truck" by jg-3d, CC BY 4.0. "Area 9 Golf Cart" by maxdragonn, CC BY 4.0. "Ford Explorer Police" by Megarobloxfr, CC BY 4.0. "Frickie's Yacht" by KurumA, CC BY-NC 4.0. "LNG Ship" by KoreanNavy, CC BY 4.0. "Sea Turtle" by C.J..Goldman, CC BY 4.0. "Stylized Palm tree set" by Parelaxel, CC BY 4.0. "Real Bush" by Salman Ramezani, CC BY 4.0. All decimated.
- "Lucid Air Sapphire (2024)" by geyges, Sketchfab Standard license. That license does not allow handing out the file, so `assets/cars/lucid-air.glb` is gitignored and the car only appears when the game runs on localhost.
- Stunt plane: "Extra 330sc - Aerobatic Aircraft" by PODSHOOT (https://sketchfab.com/3d-models/extra-330sc-aerobatic-aircraft-bf7133064c934c3fa38834f22dbdbf96), CC BY 4.0. Decimated.
- Kramer's 2024 Subaru Outback XT: his own phone scan (smoothed copy, decimated).
- Dad's boat (Grady-White 216 shape), his bigger boat (a generic 33 ft center console until we know the real one) and the pedal kayaks: built in Blender for this project from family photos, original. Scripts in `build/boats/`.
- Jetpack, player helicopter, fighter jet, cyclists, police cruisers, truck, trailer, crates, golf carts, police SUV, helicopters, store, warehouse, signs, freezer set, traffic cars, traffic boats: built in code here, original.
- three.js r169, MIT.

The two CC BY-NC-SA cars mean the public site must stay free and non-commercial, with credits shown (in-game credits screen and this README).

## How to add a car (the C8 Corvette, for example)

1. Put the original GLB in `Owner's Inbox/3D Library/vehicles/` with its `library.json` entry (front +X in Blender, wheels on the ground, real size).
2. Add it to the `CARS` table in `build/decimate_cars.py`, then make the web copy (originals are never modified):
   `/Applications/Blender.app/Contents/MacOS/Blender --background --python build/decimate_cars.py -- corvette-c8`
   Under about 58k faces it is copied as is; otherwise it is welded, flat areas dissolved and collapsed to about 45k faces with normals rebuilt.
3. Add one entry to `VEHICLES` in `js/config.js` (there is a commented Corvette line ready), and its credit line to `CREDITS`.

## Files

- `index.html`, `js/main.js` (loop, cameras, select screen, swaps, intro, menus), `js/world.js` (map build and spatial queries), `js/vehicles.js` (car, boat, truck physics), `js/missions.js`, `js/models.js` (procedural models), `js/hud.js`, `js/traffic.js`, `js/boats.js` (boat traffic), `js/water.js`, `js/sky.js`, `js/effects.js`, `js/input.js`, `js/audio.js`, `js/nav.js` (road arrows), `js/config.js`, `js/police.js` (patrols, speed traps, chases), `js/bikes.js` (cyclists), `js/bigmap.js` (big map and targets), `js/props.js` (Dropbox props: loader, mesh merge, turtles, palms up close). `build/test/fly.cjs` and `fly2.cjs` check the flyers, the V picker, the big map target, a police chase and the cyclists. `build/test/fixes.cjs` re-checks the 2026-11-13 fix pass (trailer, cameras, arrows, traps, select screen). `build/test/boats.cjs` counts boat traffic and times the frame stall when a helicopter or the police appear (the helicopter used to freeze the game about 2.8 s; lights are now in the scene from the start and chase models are pre-compiled).
- `build/fetch_osm.py`, `build/bake_world.py`, `build/retry_buildings.sh`, `build/decimate_cars.py`.
- `build/test/`: headless Chrome checks (needs a puppeteer install; the scripts default to the one in `../esl-3d-viz/node_modules`). `shots.sh` regenerates the screenshots, `play.cjs` drives every mission end to end, `eval.cjs` prints expressions from a loaded game.
- `screenshots/`: select screen, Longboat Key, Ringling Bridge at sunset, boat at the buoys, freezer intro, birthday sign, truck at the dock, golf cart.

URL flags for testing: `?auto=select|drive|bridge|boat|dock|intro|golf`, `&car=<id>`, `&cam=x,y,z` (fixed camera offset), `&shot=1` (keeps the frame buffer for screenshots).

## Safari black cars (fixed 2026-11-15)

On Kramer's M1 iMac, Safari built a reflection map (PMREM from the sky) that turned every MeshStandard/Physical material black, so every GLB car was black while the Lambert world looked fine. `js/main.js` now probes the map once at startup (a white sphere lit only by it, read back at 8-bit); if it reads black, the game drops the map, raises the hemisphere light, and tones metal down to 0.35 on cars, traffic and props. Force the fallback for testing with `?noenv=1`. The console logs `env probe ... ok` or `BROKEN`.

## Safari car materials (2026-11-15, second fix)
The env-map fallback did not cure the black cars on the M1 iMac. Safari now draws every car, prop and traffic material with MeshLambertMaterial, the same material the world uses (known good there); cars look more matte in Safari only. Other browsers are unchanged. URL flags: `?carmat=standard` or `?carmat=physical` to try the shinier materials in Safari, `?diag=1` for an on-screen line showing the mode, env probe result and Safari version. Code: `G.fixMaterial` in js/main.js, called from loadModel in js/vehicles.js and the 1.5 s sweep.

## Dad's place and canal docks (2026-11-15)

- Dad's house at Cutter Lane, built in code (`js/dads.js`) from the May 2026 Street View photos in `~/Dropbox/Paradice City Looks/`: peach stucco, pale terracotta tile hip roofs, white trim, one-story wings with a two-story middle, a front-gable garage wing with white quoins and the oval ornament, a curved paver drive around an island bed of three royal palms, red ti plants and an agave.
- The lot is placed from the map data, not a geocoder (his address never leaves the machine): `PLACES.dadsPlace` in `js/config.js` has `at` (0 is the south end of Cutter Lane, 1 the north end) and `side` (1 east, -1 west). Change those two numbers to move the house.
- His dock is on the canal behind the house. His boat ties up there (it replaced the old Harbourside Drive dock; the gold "Dad's place" marker in the street is the car to boat swap), with his bigger boat behind it and two pedal kayaks on the dock. The Check the Traps start moved into his canal.
- Every generated canal-front house on the bay side gets a dock (`world.canalLots`), and most docks get a boat: center consoles, cruisers, pontoons, a few sailboats and skiffs, some up on lifts. The player's boat bumps off them. They are instanced per 1 km tile and drawn within 1.6 km.
- `build/label_refs.py` labels every photo in the Dropbox drop folder with the local vision model (qwen3-vl:30b-a3b) and writes `labels.json` and `labels.md` beside them. `build/test/dads.cjs` screenshots the house, the dock and the canal.

## Reference photos

`research/photos/`: 165 open-licensed photos (no NC or ND) of Longboat Key, St. Armands Circle, the New Pass and Ringling bridges, Lido, the Sarasota bayfront and downtown, and the Ringling Museum, pulled 2026-11-16. Every file has its credit in `research/photos/SOURCES.md`; any photo used as a texture in the published game needs its line in the game credits. Refetch with `scripts/utilities/commons_photo_fetch.py research/photos/spots.json research/photos`.

## St. Armands Circle (2026-11-16)

The six merged OSM blocks around the circle are gone (`W.exclusions.push([4232, 5185, 125])` in `js/main.js`, before buildings are indexed). `js/armands.js` (`buildArmands`, called once from `buildSetPieces` next to Dad's place) builds the rest from the real road data at load time, from `research/st-armands-visual-spec.md` and `st-armands-geometry.md`:

- Shop ring: one and two storey stucco shops about 6.6 m beyond the ring road's outer edge (the ring is out of round, so the front follows it), 17 to 31 m deep, 29 shops in 9 arcs. Every road that meets the ring leaves a gap 3.6 m wider than its edge. Barrel-tile gables, tan hip roofs, a few slim-column arcades, striped and solid awnings, blank sign boards, blade signs, planters, one small white turret (NW). Window walls on the arc ends that face a gap. Arc colliders (custom colliders, one polygon per arc).
- Wide sidewalk with a brick strip, curb, a parking bay and about 20 parked cars outside the road edge (they have no collider and do not narrow the road), dark green globe lamps, slim palms every 9 m.
- Centre park: patchy lawn and sandy mulch, 7 paths, a brick ring plaza at the middle (the exact centre is empty for the checkpoint marker), 16 gnarled shade trees (some flowering) and about 15 tall palms, benches, hedges, a flagpole, 12 white statues on plinths at the park edge, the bronze John Ringling statue on a red-brown plinth and brick plaza (bearing 146), black marker posts, Circus Ring of Fame plaques, and the Three Graces alcove (bearing 282, facing the Lido spoke, "ST. ARMANDS KEY" from a canvas texture). Statues and tree trunks have small colliders; they are all inside the ring road.
- Brick herringbone crosswalks (canvas texture) with white bars across each spoke.
- `js/world.js` `buildPalms` skips code-built palms within 100 m of the centre so nothing doubles up. Palms elsewhere are untouched.
- Cost (first build, superseded by the v2 figures below): about 25k triangles, 7 draw calls (shops, solid props, foliage, ground, crosswalks, Graces lettering, parked cars), Lambert materials only, only the shops cast shadows. No image files.

Test: `PUPPETEER_PATH=../esl-3d-viz/node_modules/puppeteer node build/test/armands.cjs armands-after` (overhead and street shots plus a probe), `build/test/armands2.cjs` (Boulevard of the Presidents approach, Three Graces, crosswalk, inside the park), `build/test/armands-drive.cjs` (drives the real car physics round the ring and out each spoke, counts collisions).

### Fix pass v2 (2026-11-16)

- Centre and radii are defined once: `ARMANDS` in `js/config.js` is only the fallback; `armandsPlace(W)` in `js/armands.js` fits the centre from the "Saint Armands Circle" road points and is what `main.js` (building exclusion), `world.js` (palm filter) and `armands.js` use. The OSM exclusion is `clear` (125 m), the palm filter `palms` (100 m).
- One collider per shop at that shop's own roof height (hip roofs count the middle of the pitch); the turret has its own taller collider. Tree and palm colliders are trunk-only (h 1.8, about 0.7 m square), so a flyer can land on the ground under a canopy while the trunk still blocks a car. Parked cars (also in the service lots), sidewalk and park lamps and sidewalk palms now have small colliders; benches and hedges stay passable.
- Spoke mouths: `readRoads` finds where each named road meets the ring and gives the inner-edge point at that bearing (`G.armands.mouths`). Statues are slid along the park edge until they are 14 m from every mouth (so plinth and hedge are over 10 m), or dropped (9 of 12 kept). Trees, markers, park-side lamps, the Ringling plaza and the Graces alcove keep 10 m or more from every mouth too.
- Back band between the shops and the 125 m edge: rows of low back buildings (plain stucco, windows, some tan hip roofs, some two storey), infill buildings, 3 to 4 service lots with parked cars, shade trees and palms. Everything is placed only where every sample point is on land, 4 m or more from every road (the shop clearance test), outside every other collider (`W.buildingAt`) and inside 122 m. Buildings carry colliders. About 50 back buildings, so the footprints reach the minimap and big map by themselves: `hud.js buildMap` draws every `bList` polygon, and the Circle's shop and back-building colliders are flagged (`armandsBld`, drawn in a stronger brown) while the tiny ones (trunks, lamps, cars, statues; `tiny`) are skipped.
- Three Graces: one long plinth with three standing figures (robe, hips, torso, shoulders, head with a hair knot), arms linked across each other's shoulders, outer arms hanging.
- Lawn: one canvas texture (soft patches of green and dry grass, sandy mulch under every tree and palm) on one fan mesh, replacing the 72x18 flat-colour grid.
- Back and end walls of the shops are mixed 40 percent toward cream (no near-black navy in the evening shade) and have a row of windows and a service door; arcade awnings and backs are dark green or deep red, the black sign board colour is gone.
- Speed limit: near bearing 100 the HUD showed 30 because South Boulevard of the Presidents (limit 30), John Ringling Boulevard and Fillmore Drive run along or over the ring, and `roadAt` picks the first road at equal height. `Missions.limitAt` now returns 20 when the car is on the ring band (`G.armands.onRing`). The ring itself was already 20.
- Cost now: about 29k triangles, 8 draw calls (shops and back buildings, solid props, foliage, ground, lawn, crosswalks, Graces lettering, cars), Lambert only.

Tests need the ABSOLUTE puppeteer path, the relative one fails from `build/test`:
`PUPPETEER_PATH="/Users/<you>/.../coding projects/esl-3d-viz/node_modules/puppeteer" node build/test/armands-qa1.cjs` (static overlap with asphalt, must be 0), `armands-qa7.cjs` (roof height of each collider against the visible roof), `armands-qa3.cjs audi-tt 20 4` (drive fuzz at 20 mph; the fourth argument is the smoothing number and must not be 0, or the test crashes), `armands-v2-shots.cjs <outdir>` (Graces close-up, back band, shop backs, minimap and big map). `fps.cjs` needs the port: `node build/test/fps.cjs 8915`.

## Pelicans (2026-11-20)

Brown pelicans in `js/pelicans.js`, hooked into `js/main.js` with three lines (import, construct after the cyclists, update each frame). Thirty birds in total, four InstancedMeshes (body, head, left wing, right wing; Lambert vertex colors, about 400 triangles a bird), so the whole flock is four draw calls and nothing outside 400 m is simulated.

- Ten perch on dock pilings: the canal docks (`world.canalLots`) and Dad's dock, which gets extra weight so he usually has a few. They turn their heads now and then, and flush when a car or boat comes within 15 m, then settle on another piling 70 to 320 m away.
- Four flocks (4 to 6 birds, V or line) glide low along the shore and bay, with a few slow flaps between long glides and stretches of skimming just above the water. A flock that gets more than about 470 m away respawns near a shoreline close to you.
- Every 12 to 24 s one bird in a flock near you climbs, plunge-dives with a splash (reuses `G.fx.splash`), floats a moment and beats back to its place in the line.
- Follows the Traffic toggle in the pause menu (off hides them and frees the pilings).
- Tests: `build/test/pelicans.cjs` (counts, fps with and without) and `build/test/pelican-shots.cjs` (boat-view shots to `screenshots/pelicans-*.png`). Debug handle: `G.pelicans`.

## Street View pass (2026-11-20)
`js/streetview.js` (`buildStreetView`, called from `buildSetPieces` in js/main.js, skip with `?nosv=1`) dresses Dad's drive home to match Kramer's Street View screenshots: the New Pass bridge (blue bascule leaf, tender house, pipe rail, fender walls, DRAW BRIDGE AHEAD sign, guardrails at both ends), South Gulf of Mexico Drive to Cutter Lane (mown verges, bay-side concrete path, sea grape thickets, sabal palms, clipped hedges) with the Welcome to the Town of Longboat Key sign (`G.lbkSign`), and Cutter Lane (lawns, mailboxes, shrubs, flower beds, palms). Generated houses on Cutter and Channel Lane are now single storey, white, with pale metal roofs (`lbk` flag in js/world.js). Cost: about 56k triangles in 4 draw calls (merged solid props, flat ground patches, two textured signs), Lambert only, no shadows. Compare page: `screenshots/streetview-compare/index.html` (local, git-ignored; shots from `build/test/streetview.cjs`).


Cursive skywriting (2026-11-23): the message is now Happy Birthday / Dad in Hershey 'cursive', a public-domain single-stroke script (A. V. Hershey, US NBS), baked into js/skywriter.js by build/bake_skyscript.py. The plane flies each connected stroke and lays thick fresh smoke right behind its tail, and it is drawn larger far away so it stays visible at the tip of the trail.

## Causeway pass (2026-11-23)
`js/causeway.js` (`hookTowers` before world.load, `buildCauseway` from `buildSetPieces` in js/main.js; skip with `?nocw=1`) dresses the opening drive. Downtown: the tall OSM footprints visible from the causeway are taken from the generic builder and drawn as pale condo towers (cream, white, peach; balcony bands or glass with white slab lines from a small shader; penthouse on each, terracotta hip roofs, domes or open frames on the tallest). Ringling bridge: smooth light parapet with pipe rail, light fascia, box girder soffit, round columns, twin-arm lamps (the generic lamps and piers on this bridge are hidden). Causeway: sandy shoulders, riprap at the water, sea grape and sabal palms, a few anglers. Causeway park: bay beaches, sandy paths, teal picnic shelters, palms. About 45 moored boats off Marina Jack. Lambert only, 5 draw calls, about 60k triangles. Shots: `node build/test/causeway.cjs <outdir> <before|after> [stop] [&flags]`; compare page `screenshots/causeway-compare/index.html` (local, git-ignored).
