// Longboat Cruise: vehicles, places and credits.
// To add a vehicle (for example the C8 Corvette), add one entry to VEHICLES.
// file: a GLB in assets/cars/ with the front facing +X in Blender, wheels on the ground.

// Same projection as build/fetch_osm.py: local meters, x east, z south.
const LAT0 = 27.365, LON0 = -82.620, R = 6378137.0;
const KX = Math.cos(LAT0 * Math.PI / 180) * Math.PI / 180 * R;
const KZ = Math.PI / 180 * R;
export function xz(lat, lon) { return [(lon - LON0) * KX, -(lat - LAT0) * KZ]; }
export function latlon(x, z) { return [LAT0 - z / KZ, LON0 + x / KX]; }

export const MPH = 2.23694; // m/s to mph

export const VEHICLES = [
  { id: 'porsche-911', kind: 'car', name: 'Porsche 911 Turbo S', year: '2022', note: '992 generation, silver',
    file: 'assets/cars/porsche-911.glb', top: 125, accel: 10, grip: 11, credit: 'porsche' },
  { id: 'amg-gle63', kind: 'car', name: 'Mercedes-AMG GLE 63 Coupe', year: '2022', note: 'silver',
    file: 'assets/cars/amg-gle63.glb', top: 112, accel: 8.5, grip: 9, credit: 'gle' },
  { id: 'bmw-7', kind: 'car', name: 'BMW 7 Series', year: '2009 to 2015', note: 'F01 generation, silver',
    file: 'assets/cars/bmw-7.glb', top: 108, accel: 7, grip: 9, credit: 'bmw7' },
  { id: 'bmw-530i', kind: 'car', name: 'BMW 530i', year: '2008', note: 'E60, silver',
    file: 'assets/cars/bmw-530i.glb', top: 100, accel: 6.5, grip: 9.5, credit: 'bmw5' },
  { id: 'bmw-z4m', kind: 'car', name: 'BMW Z4 M Coupe', year: '2006', note: 'E86, black',
    file: 'assets/cars/bmw-z4m.glb', top: 112, accel: 8.5, grip: 10.5, credit: 'z4' },
  { id: 'audi-tt', kind: 'car', name: 'Audi TT 3.2 coupe', year: '2004', note: '8N, silver',
    file: 'assets/cars/audi-tt.glb', top: 98, accel: 7, grip: 10, credit: 'tt' },
  { id: 'subaru-outback', kind: 'car', name: "Kramer's Subaru Outback XT", year: '2024', note: 'scanned by Kramer',
    file: 'assets/cars/subaru-outback.glb', top: 92, accel: 6, grip: 9, credit: 'subaru' },
  { id: 'boat', kind: 'boat', name: "Dad's center console", year: '21 ft', note: 'white, T-top, one outboard',
    file: 'assets/cars/boat.glb', top: 41, accel: 4.6, grip: 1.4, credit: 'boat' },
  { id: 'semi', kind: 'truck', name: 'Cranberry reefer rig', year: '18 wheels', note: 'tractor and open-top reefer trailer',
    file: null, top: 66, accel: 2.8, grip: 7, credit: 'procedural' },
  // { id: 'corvette-c8', kind: 'car', name: 'Chevrolet Corvette', year: '2020s', note: 'C8',
  //   file: 'assets/cars/corvette-c8.glb', top: 120, accel: 10, grip: 11, credit: 'corvette' },
];

export const CREDITS = {
  porsche: '"2022 Porsche 911 Trubo S" by tonielpro520 (sketchfab.com/tonielpro520), CC BY 4.0. Repainted silver and decimated.',
  gle: '"Mercedes-AMG GLE 63 Coupe 2022" by ceron_alex (sketchfab.com/ceron_alex), CC BY 4.0. Repainted silver and decimated.',
  bmw7: '"BMW 7-series (F01)" by Black Snow (sketchfab.com/BlackSnow02), CC BY 4.0. Repainted silver and decimated.',
  bmw5: '"2008 BMW 530i (E60)" by beanz_ncheese (sketchfab.com/aiden.constante), CC BY 4.0. Repainted silver.',
  z4: '"2006 BMW Z4 M Coupe (E86)" by Ddiaz Design (sketchfab.com/ddiaz-design), CC BY-NC-SA 4.0. Repainted black.',
  tt: '"2004 Audi TT Coupe 3.2 Quattro" by OUTPISTON (sketchfab.com/outpiston), CC BY-NC-SA 4.0. Repainted silver and decimated.',
  subaru: "Kramer's own 2024 Subaru Outback XT, phone scan, cleaned and smoothed in Blender.",
  boat: "Dad's boat, built in Blender for this game. Original.",
  procedural: 'Built in code for this game. Original.',
};

// Real places (lat, lon). Positions snap to the nearest road or water at load time.
export const PLACES = {
  spawn: { ll: [27.3560, -82.6100], road: 'Gulf of Mexico Drive' },
  sunsetStart: { ll: [27.3600, -82.6140], road: 'Gulf of Mexico Drive' },
  newPass: { ll: [27.3365, -82.5845] },
  stArmands: { ll: [27.3185, -82.5772] },
  ringlingCrest: { ll: [27.3315, -82.5545] },
  bayfront: { ll: [27.3352, -82.5437] },
  dockCar: { xz: [267, -770] },                 // Harbourside Drive, bay side of Longboat Key
  dockBoat: { xz: [322, -770] },                // the slip just off it, open Sarasota Bay water
  warehouse: { xz: [7542, 2868] },              // Sarasota, on Fruitville Road a block from the bayfront
  publix: { ll: [27.3673, -82.6244] },
  golf: { ll: [27.3690, -82.6210] },
  // stone crab traps down the bay side of Longboat Key, from near the dock to the water off Cutter Lane
  buoys: [{ xz: [950, 150] }, { xz: [1500, 900] }, { xz: [2050, 1550] }, { xz: [2600, 2050] }, { xz: [2950, 2480] }],
  dadsPlace: { road: 'Cutter Lane' },
};

// The barrier-island center line in local meters (x, z), north to south, measured from the
// land mask. Water west of it is the Gulf; east is Sarasota Bay.
export const ISLAND_LINE = [[-7400, -9200], [-6903, -8300], [-6378, -7800], [-6075, -7300], [-5218, -6800], [-4890, -6300], [-4218, -5800],
  [-3768, -5300], [-3463, -4800], [-3090, -4300], [-2763, -3800], [-2503, -3300], [-2150, -2800], [-1763, -2300], [-1595, -1800],
  [-1350, -1300], [-740, -800], [-270, -300], [-15, 200], [397, 700], [647, 1200], [1112, 1700], [1615, 2200], [2085, 2700],
  [2700, 3100], [2787, 3700], [3462, 4200], [3295, 4700], [3625, 5200], [4212, 5700], [4715, 6200], [5067, 6700], [5500, 9200]];
