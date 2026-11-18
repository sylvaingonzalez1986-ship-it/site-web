import { getKqWarehouseFixturePositions } from "@/lib/kanab-quest-warehouse-fixtures";
import { getKqWarehouseOption } from "@/lib/kanab-quest-warehouse-options";
import { type RoomBatch, randomFrom, type Point3 } from "./KqGrowRoomGeometry";
import { growRoomDeckHeight, plantSeed, plantStage, type KqGrowRoomZone } from "./KqGrowRoomModel";

const skinColors = ["#457940", "#447e55", "#638241", "#527844"];
const blossomColors = ["#b1ac78", "#b49b91", "#a8b879", "#ab9e87"];

type PlantDetail = "full" | "reduced" | "distant";

function branchPlant(a: RoomBatch, x: number, z: number, y: number, stage: ReturnType<typeof plantStage>, seed: number, scale: number, detail: PlantDetail) {
  if (stage === "empty" || stage === "complete" || stage === 5)
    return;
  const rand = randomFrom(seed);
  const foliage = skinColors[seed % 4], bright = ["#6b944e", "#619366", "#83974f", "#719253"][seed % 4];
  if (detail === "distant") {
    const height = (stage === "dead" ? .21 : [.12, .28, .70, 1.02, 1.10][stage]) * scale;
    const radius = (stage === "dead" ? .13 : [.075, .17, .29, .35, .36][stage]) * scale;
    const twist = rand() * Math.PI * 2;
    a.box("wood", stage === "dead" ? "#806846" : "#647844", x, y + height * .45, z, .017, height * .90, .017);
    a.part("crown", "leaf", stage === "dead" ? "#947746" : foliage, [x, y + height * .69, z], [radius, height * .36, radius], [0, twist, 0]);
    if (typeof stage === "number" && stage > 0) {
      const top = radius * .70;
      a.part("crown", "leaf", stage === 4 ? "#8c9d4a" : bright, [x, y + height * .90, z], [top, height * .29, top], [0, twist + .64, 0]);
      if (stage >= 3) a.part("oval", "plastic", blossomColors[seed % 4], [x, y + height * .96, z], [.08 * scale, height * .16, .08 * scale]);
    }
    return;
  }
  const low = detail === "reduced";
  if (stage === "dead") {
    a.rod("wood", "#8d7957", [x, y, z], [x + .04, y + .26 * scale, z + .02], .012);
    for (let i = 0; i < 4; i++)
      a.part("fan", "leaf", "#9d845b", [x + .02, y + .15 + i * .015, z], [.11, .09, .13], [.8, i * 1.6, 0]);
    return;
  }
  if (stage === 0) {
    const rise = .12 * scale;
    a.rod("plastic", "#6c8d53", [x, y, z], [x, y + rise, z], .009 * scale);
    for (let i = 0; i < 2; i++)
      a.part("oval", "plastic", "#80a960", [x + (i ? 1 : -1) * .039 * scale, y + rise, z], [.102 * scale, .027 * scale, .064 * scale], [0, .55, i ? .46 : -.46]);
    return;
  }
  const height = [0, .28, .70, 1.02, 1.10][stage] * scale * (.93 + rand() * .13);
  const spread = (stage === 1 ? .14 : stage === 2 ? .27 : .30) * scale;
  const n = stage === 1 ? 3 : low ? 7 : stage === 2 ? 9 : 12, phase = rand() * 6.28;
  const leanX = (rand() - .5) * .13 * height, leanZ = (rand() - .5) * .13 * height;
  const stem = (t: number): Point3 => [x + leanX * t * t, y + height * t, z + leanZ * t * t];
  for (let k = 0; k < 3; k++)
    a.rod("wood", "#6e7951", stem(k / 3), stem((k + 1) / 3), (.013 - k * .002) * scale);
  const bud = (p: Point3, length: number, angle: number) => {
    a.part("cola", "flower", blossomColors[seed % 4], p, [length * .63, length, length * .63], [.09, angle, .13]);
    if (!low)
      a.part("fan", "leaf", bright, [p[0], p[1] + length * .22, p[2]], [length * .37, length * .36, length * .39], [-.69, angle + .6, .12]);
  };
  for (let level = 0; level < n; level++) {
    const t = level / n, base = stem(.19 + t * .69), angle = phase + level * 2.40;
    const R = spread * (1 - t * .65) * (.85 + rand() * .3), ax = Math.sin(angle), az = Math.cos(angle);
    const joint: Point3 = [base[0] + ax * R * .52, base[1] + height * (.04 + t * .015), base[2] + az * R * .52];
    const tip: Point3 = [base[0] + ax * R, base[1] + height * (.11 + t * .065), base[2] + az * R];
    a.rod("wood", "#78845a", base, joint, .009 * scale);
    a.rod("wood", "#80915d", joint, tip, .006 * scale);
    const length = (stage === 1 ? .13 : stage === 2 ? .27 : .31) * (1 - t * .32) * scale;
    a.part("fan", "leaf", level % 3 ? foliage : bright, joint, [length, length, length], [.13 + rand() * .3, angle - .71, rand() * .3 - .15]);
    a.part("fan", "leaf", stage === 4 && level % 4 === 0 ? "#99a259" : bright, tip, [length * 1.25, length, length * 1.25], [-.10 + rand() * .36, angle + .38, (rand() - .5) * .35]);
    if (stage >= 2) {
      const shoot: Point3 = [joint[0] + ax * R * .26, joint[1] + height * (.16 + t * .035), joint[2] + az * R * .26];
      a.rod("wood", "#73844d", joint, shoot, .007 * scale);
      a.part("fan", "leaf", foliage, shoot, [length * .93, length, length * .93], [-.3, angle - 1.1, .18]);
      if (stage >= 3)
        bud(shoot, (stage === 4 ? .19 : .11) * scale, angle);
    }
    if (stage >= 3 && (level % 2 === 0 || !low))
      bud(tip, (stage === 4 ? .17 : .11) * scale * (1 - t * .12), angle);
  }
  if (stage >= 3)
    bud(stem(.91), (stage === 4 ? .255 : .16) * scale, phase);
  else
    a.part("fan", "leaf", bright, stem(.93), [spread * .7, spread * .8, spread * .75], [-.8, phase, 0]);
}

const teal = "#0a969e", tealDark = "#125259", ochre = "#bf8b45";
const trayWood = "#c58d4c", potRim = "#403c36", soil = "#573a28";

function lightFixture(a: RoomBatch, y: number, code: string, powered: boolean, detailed: boolean) {
  const bars = code === "MH-TS1000" ? 5 : 4;
  // The visible back and underside share the extruded gold-edged diffuser rails.
  a.box("plastic", tealDark, 0, y - .018, 0, .59, .085, .36);
  a.box("steel", teal, 0, y + .007, 0, .57, .066, .346, "lighting");
  for (let i = 0; i < bars; i++) {
    const z = (i - (bars - 1) / 2) * .25 / (bars - 1);
    a.box("plastic", powered ? "#efb33f" : "#9b8354", 0, y + .040, z, .465, .022, .245 / bars);
    a.box(powered ? "light" : "plastic", powered ? "#fff1bd" : "#b5ad89", 0, y + .051, z, .446, .012, .192 / bars);
    if (detailed) a.box(powered ? "light" : "plastic", powered ? "#ffe2a0" : "#ada182", 0, y - .063, z, .454, .012, .218 / bars);
  }
  a.rod("steel", tealDark, [-.25, y + .05, -.13], [0, y + .24, -.13], .009);
  a.rod("steel", tealDark, [.25, y + .05, -.13], [0, y + .24, -.13], .009);
  a.rod("plastic", "#414e45", [0, y + .24, -.13], [0, y + .44, -.15], .011);
  a.rod("steel", "#688682", [-.292, .08, -.21], [-.292, y + .44, -.21], .014);
  a.rod("steel", "#688682", [-.292, y + .44, -.21], [0, y + .44, -.15], .014);
  if (detailed) for (const x of [-.256, .256]) for (const z of [-.143, .143])
    a.part("tube", "steel", "#dfaa48", [x, y + .046, z], [.023, .012, .023]);
}

function extractor(a: RoomBatch, y: number, detailed: boolean) {
  // The angled circular intake and its elbow can both be read from above and in three-quarter view.
  const tilt = .94, c = Math.cos(tilt), s = Math.sin(tilt), radius = .133;
  const plane = (x: number, z: number, height: number): Point3 => [x, y + c * height - s * z, s * height + c * z];
  a.rod("steel", "#557269", [0, .09, -.04], [0, y, -.04], .019);
  a.part("tube", "plastic", tealDark, plane(0, 0, -.009), [.275, .110, .275], [tilt, 0, 0]);
  a.part("tube", "plastic", teal, [0, y, 0], [radius * 2, .117, radius * 2], [tilt, 0, 0], "air");
  a.part("tube", "plastic", "#262e30", plane(0, 0, .061), [.197, .015, .197], [tilt, 0, 0]);
  for (let blade = 0; blade < 4; blade++) {
    const angle = blade * Math.PI / 2 + .32;
    a.part("oval", "plastic", "#596264", plane(Math.sin(angle) * .053, Math.cos(angle) * .053, .076),
      [.046, .021, .087], [tilt, angle + .48, 0]);
  }
  a.part("tube", "steel", "#dbac4c", plane(0, 0, .08), [.049, .019, .049], [tilt, 0, 0]);
  a.part("tube", "plastic", tealDark, plane(0, 0, .094), [.035, .011, .035], [tilt, 0, 0]);
  if (detailed) for (const x of [-.078, .078]) for (const z of [-.079, .079])
    a.part("tube", "steel", "#dba742", plane(x, z, .064), [.018, .012, .018], [tilt, 0, 0]);

  const duct: Point3[] = [[.064, y - .026, -.041], [.101, y - .024, -.046], [.127, y - .010, -.059],
    [.138, y + .017, -.082], [.138, y + .057, -.106], [.138, y + .106, -.112]];
  for (let i = 1; i < duct.length; i++) {
    const prev = duct[i - 1], next = duct[i];
    a.rod("plastic", "#837d70", prev, next, .041);
    const collar: Point3 = [prev[0] * .18 + next[0] * .82, prev[1] * .18 + next[1] * .82, prev[2] * .18 + next[2] * .82];
    a.rod("plastic", i === duct.length - 1 ? teal : "#424d4a", collar, next, .045);
  }
}

function options(a: RoomBatch, w: number, d: number, zone: KqGrowRoomZone, deck: number) {
  const modules = (zone.optionCodes ?? []).map(code => getKqWarehouseOption(code)).filter(option => option !== undefined);
  const columns = Math.max(1, Math.floor((w * 30 - 4) / 16));
  const visible = modules.slice(0, Math.min(8, columns * Math.max(1, Math.floor(d * 30 / 32))));
  visible.forEach(({ family, code }, i) => {
    const x = -w / 2 + (9 + i % columns * 16) / 30, z = d / 2 - (8 + Math.floor(i / columns) * 15) / 30;
    const y = deck + .17, tier = Number(code.slice(-2));
    a.at(x, z);
    if (family === "water" || family === "climate") {
      const tank = family === "water";
      a.box("steel", tealDark, 0, y + .035, 0, .34, .045, .23);
      if (tank) {
        a.part("drum", tier === 1 ? "wood" : "steel", tier === 1 ? ochre : teal, [0, y + .16, 0], [.23, .29, .23], [0, 0, Math.PI / 2]);
        for (const x of [-.093, .093]) a.part("ring", "steel", tealDark, [x, y + .16, 0], [.235, .40, .235], [0, 0, Math.PI / 2]);
      } else {
        a.box("plastic", "#dfc99c", 0, y + .17, 0, .26, .27, .22);
        a.box("plastic", teal, .14, y + .17, 0, .055, .27, .22);
        for (let i = 0; i < 4; i++) a.box("plastic", tealDark, -.02, y + .10 + i * .046, .114, .17, .018, .014);
      }
    } else if (family === "substrate" || family === "logistics") {
      a.box("wood", trayWood, 0, y + .075, 0, .36, .065, .27);
      for (const side of [-.135, .135]) a.box("steel", tealDark, side, y + .052, 0, .036, .103, .25);
      for (const side of [-.080, .080]) a.box("wood", family === "logistics" ? ochre : soil, side, y + .14, 0, .145, .09, .20);
    } else if (family === "nutrition") {
      a.box("wood", "#cfa66c", 0, y + .135, 0, .22, .26, .145);
      a.box("wood", "#8e643b", 0, y + .28, 0, .23, .035, .11);
      a.part("crown", "leaf", "#518348", [0, y + .135, .076], [.065, .011, .065], [Math.PI / 2, .5, 0]);
    } else if (family === "hygiene") {
      a.part("pot", "plastic", teal, [-.050, y + .094, .024], [.17, .18, .17]);
      a.rod("wood", ochre, [.093, y + .05, .055], [.034, y + .36, -.045], .011);
      a.box("wood", "#bc904c", .09, y + .035, .056, .13, .046, .055);
    } else {
      a.box("steel", teal, 0, y + .17, 0, .22, .32, .14);
      a.box("plastic", tealDark, 0, y + .21, .076, .15, .115, .012);
      a.box("plastic", family === "security" ? "#e5af4b" : "#eddb9c", 0, y + .21, .086, .11, .071, .009);
    }
  });
  a.at(0, 0);
}

export function cultivation(a: RoomBatch, w: number, d: number, zone: KqGrowRoomZone, low: boolean, budget: number) {
  const stage = plantStage(zone), seed = plantSeed(zone.variety || zone.id), rng = randomFrom(seed);
  const powered = zone.powered !== false && typeof stage === "number" && stage < 5;
  const deck = growRoomDeckHeight(zone), count = w * d * 4;
  const detail: PlantDetail = count > budget || low ? "distant" : count > 8 ? "reduced" : "full";
  const detailedFixtures = !low && w * d <= 24;
  for (let row = 0; row < d; row++) for (let col = 0; col < w; col++) {
    const cx = col + .5 - w / 2, cz = row + .5 - d / 2;
    if (deck > .075) for (const x of [-.405, .405]) for (const z of [-.405, .405])
      a.box("wood", "#816338", cx + x, deck / 2, cz + z, .065, deck, .065);
    a.box("wood", "#805a33", cx, deck - .015, cz, .948, .079, .948);
    a.box("wood", trayWood, cx, deck + .029, cz, .930, .046, .930);
    for (const side of [-.449, .449]) {
      a.box("wood", "#d39a56", cx + side, deck + .087, cz, .037, .121, .935);
      a.box("wood", "#c88c4a", cx, deck + .087, cz + side, .86, .121, .037);
    }
    for (let pot = 0; pot < 4; pot++) {
      const x = cx + (pot % 2 ? .215 : -.215), z = cz + (pot < 2 ? -.215 : .215);
      const variation = .70 + rng() * .09, potSeed = seed + ((row * w + col) * 4 + pot) * 743;
      a.box("plastic", potRim, x, deck + .087, z, .398, .128, .398);
      a.box("soil", soil, x, deck + .15, z, .348, .014, .348);
      if (detailedFixtures && (stage === "empty" || stage === 0 || stage === "complete" || stage === 5)) {
        const grain = randomFrom(potSeed + 87);
        for (let n = 0; n < 4; n++) {
          const offsetX = (grain() - .5) * .26, offsetZ = (grain() - .5) * .26;
          a.part("oval", "soil", n % 2 ? "#8b6940" : "#735437", [x + offsetX, deck + .161, z + offsetZ], [.022, .013, .027]);
        }
      }
      branchPlant(a, x, z, deck + .16, stage, potSeed, variation, detail);
    }
  }
  if (zone.lightingCode) for (const point of getKqWarehouseFixturePositions(w, d, "lighting", zone.lightingCode)) {
    a.at(point.x - w / 2, point.z - d / 2);
    lightFixture(a, 1.84, zone.lightingCode, powered, detailedFixtures);
  }
  if (zone.airCode) for (const point of getKqWarehouseFixturePositions(w, d, "air", zone.airCode)) {
    a.at(point.x - w / 2, point.z - d / 2);
    extractor(a, 1.13, detailedFixtures);
  }
  options(a, w, d, zone, deck);
}
