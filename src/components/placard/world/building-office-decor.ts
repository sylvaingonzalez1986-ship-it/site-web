import type { Art } from "./interior-art";

type Finish = Parameters<Art["box"]>[6];

function desk(a: Art, x: number, z: number, w: number, d: number, rounded = false) {
  const thickness = rounded ? 0.14 : 0.18;
  a.bevelBox(w, thickness, d, 0.051, x, 0.88, z, "honey");
  a.bevelBox(w - 0.14, 0.075, d - 0.1, 0.023, x, 0.78, z, rounded ? "teal" : "wood");
  for (const side of [-1, 1]) {
    const leg = x + side * w * 0.36;
    if (rounded) {
      for (const foot of [-1, 1]) a.cylinder(0.058, 0.72, leg, 0.37, z + foot * d * 0.28, "wood", 0.1, [foot * 0.09, 0, side * -0.09]);
    } else {
      a.box(w * 0.24, 0.61, d * 0.78, leg, 0.38, z, "wood");
      for (const y of [0.29, 0.56]) {
        a.frame(w * 0.19, 0.15, leg, y, z + d * 0.4, "honey", 0.026);
        a.box(0.12, 0.038, 0.055, leg, y, z + d * 0.426, "gold");
      }
    }
  }
  a.box(w * 0.66, 0.015, d * 0.64, x, 0.979, z, "darkTeal");
}

function bankDesk(a: Art, x: number, z: number, w: number, d: number) {
  a.bevelBox(w, 0.16, d, 0.055, x, 0.91, z, "honey");
  a.bevelBox(w - 0.038, 0.071, d - 0.047, 0.022, x, 0.824, z, "walnut");
  a.box(w * 0.82, 0.13, d * 0.79, x, 0.74, z, "wood");
  a.box(w * 0.59, 0.017, d * 0.67, x, 0.999, z, "bronze");
  a.bevelBox(w * 0.58, 0.026, d * 0.64, 0.012, x, 1.005, z, "velvet");
  for (const side of [-1, 1]) {
    const baseX = x + side * w * 0.347;
    a.bevelBox(w * 0.29, 0.097, d * 0.83, 0.023, baseX, 0.066, z, "walnut");
    a.box(w * 0.25, 0.68, d * 0.78, baseX, 0.418, z, "walnut");
    for (const y of [0.244, 0.43, 0.615]) {
      a.bevelBox(w * 0.227, 0.155, 0.049, 0.013, baseX, y, z + d * 0.394, "wood");
      a.frame(w * 0.197, 0.118, baseX, y, z + d * 0.416, "honey", 0.015);
      a.box(0.075, 0.03, 0.022, baseX, y, z + d * 0.441, "bronze");
      a.torus(0.031, 0.009, baseX, y - 0.014, z + d * 0.451, "brass", [0.31, 0, 0]);
    }
    a.box(0.036, 0.49, d * 0.61, baseX + side * w * 0.13, 0.427, z, "wood");
    for (const dy of [-0.21, 0.21]) a.box(0.045, 0.035, d * 0.68, baseX + side * w * 0.135, 0.427 + dy, z, "honey");
  }
}

function lamp(a: Art, x: number, y: number, z: number, shade: Finish) {
  a.cylinder(0.165, 0.055, x, y + 0.028, z, "gold");
  a.rod([x, y + 0.03, z], [x - 0.1, y + 0.42, z], 0.045, "gold");
  a.rod([x - 0.1, y + 0.42, z], [x + 0.18, y + 0.63, z], 0.04, "gold");
  a.sphere(0.047, x - 0.1, y + 0.42, z, "gold");
  a.sphere(0.23, x + 0.2, y + 0.6, z + 0.05, shade, [1.25, 0.48, 0.85]);
  a.cylinder(0.21, 0.025, x + 0.2, y + 0.55, z + 0.05, "cream");
}

function ledger(a: Art, x: number, y: number, z: number, w = 0.58) {
  for (const side of [-1, 1]) {
    const cx = x + side * w * 0.24;
    a.box(w * 0.5, 0.037, w * 0.64, cx, y, z, "honey", [0, 0, side * -0.13]);
    a.box(w * 0.48, 0.027, w * 0.61, cx, y + 0.028, z, "paper", [0, 0, side * -0.13]);
    for (let line = 0; line < 5; line++) a.box(w * 0.34, 0.004, 0.007, cx, y + 0.049, z + (line - 2) * w * 0.074, "stone");
  }
}

function chair(a: Art, x: number, z: number, leather: Finish, facingFront = true) {
  const sign = facingFront ? -1 : 1;
  a.box(0.76, 0.13, 0.66, x, 0.48, z, "wood");
  a.box(0.69, 0.13, 0.59, x, 0.59, z, leather);
  a.box(0.82, 0.85, 0.15, x, 0.91, z + sign * 0.31, "wood", [sign * 0.09, 0, 0]);
  a.box(0.69, 0.71, 0.14, x, 0.93, z + sign * 0.24, leather, [sign * 0.09, 0, 0]);
  for (const dx of [-0.31, 0.31]) {
    a.box(0.09, 0.49, 0.1, x + dx, 0.25, z - 0.22, "wood");
    a.box(0.09, 0.49, 0.1, x + dx, 0.25, z + 0.22, "wood");
    a.box(0.095, 0.1, 0.58, x + dx * 1.23, 0.76, z, "honey");
    for (let n = 0; n < 5; n++) a.sphere(0.021, x + dx, 0.67 + n * 0.13, z + sign * 0.14, "gold");
  }
}

function clerk(a: Art, x: number, z: number, shirt: Finish, hair: Finish, animated = false) {
  a.sphere(0.26, x, 0.91, z, shirt, [1.2, 1.28, 0.72]);
  a.box(0.35, 0.31, 0.055, x, 0.87, z + 0.18, "teal");
  for (const dx of [-0.135, 0.135]) {
    a.rod([x + dx, 1.16, z + 0.04], [x + dx, 0.95, z + 0.205], 0.073, "teal");
    a.sphere(0.037, x + dx, 0.98, z + 0.217, "gold");
  }
  const head = animated ? a.pivot("office-clerk-head", [x, 1.28, z]) : a;
  const hx = animated ? 0 : x, hy = animated ? -1.28 : 0, hz = animated ? 0 : z;
  head.sphere(0.245, hx, hy + 1.37, hz + 0.018, "skin", [1, 0.99, 0.91]);
  for (const side of [-1, 1]) {
    head.sphere(0.06, hx + side * 0.233, hy + 1.365, hz, "skin");
    head.sphere(0.025, hx + side * 0.086, hy + 1.391, hz + 0.224, "ink", [0.72, 1.35, 0.37]);
    a.rod([x + side * 0.23, 1.09, z], [x + side * 0.33, 0.98, z + 0.22], 0.13, shirt);
    if (animated && side > 0) {
      const hand = a.pivot("office-clerk-hand", [x + 0.33, 0.98, z + 0.22]);
      hand.rod([0, 0, 0], [-0.12, 0.085, 0.22], 0.11, shirt);
      hand.sphere(0.072, -0.125, 0.086, 0.25, "skin");
      hand.rod([-0.1, 0.21, 0.187], [-0.14, 0.04, 0.308], 0.022, "brass");
    } else {
      a.rod([x + side * 0.33, 0.98, z + 0.22], [x + side * 0.21, 1.02, z + 0.38], 0.11, shirt);
      a.sphere(0.072, x + side * 0.205, 1.04, z + 0.4, "skin");
    }
  }
  head.sphere(0.043, hx, hy + 1.345, hz + 0.25, "skin");
  head.sphere(0.07, hx, hy + 1.282, hz + 0.218, "red", [1.15, 0.43, 0.36]);
  head.sphere(0.247, hx, hy + 1.515, hz - 0.054, hair, [0.99, 0.67, 0.87]);
  if (hair === "hair") {
    head.sphere(0.244, hx, hy + 1.555, hz - 0.035, "teal", [1.04, 0.62, 1]);
    head.box(0.375, 0.032, 0.195, hx + 0.018, hy + 1.519, hz + 0.14, "ink", [0.025, 0.06, -0.07]);
  } else {
    for (let n = 0; n < 7; n++) {
      const t = n * Math.PI / 3.3;
      head.sphere(0.108, hx + Math.sin(t) * 0.17, hy + 1.48 + (n % 2) * 0.05, hz + Math.cos(t) * 0.125, hair);
    }
  }
}

function banker(a: Art, x: number, z: number) {
  a.sphere(0.37, x, 1.05, z, "suit", [1.08, 1.2, 0.74]);
  a.box(0.19, 0.41, 0.055, x, 1.21, z + 0.24, "cream", [-0.28, 0, 0]);
  a.box(0.071, 0.29, 0.054, x, 1.19, z + 0.29, "leather", [-0.25, 0, -0.1]);
  for (const side of [-1, 1]) {
    a.rod([x + side * 0.25, 1.36, z + 0.152], [x + side * 0.09, 1, z + 0.29], 0.066, "darkTeal");
    a.sphere(0.03, x + side * 0.09, 0.98, z + 0.294, "brass");
    a.rod([x + side * 0.135, 0.89, z + 0.12], [x + side * 0.25, 1.15, z + 0.72], 0.24, "suit");
    a.rod([x + side * 0.25, 1.15, z + 0.72], [x + side * 0.25, 1.18, z + 1.02], 0.19, "suit");
    a.bevelBox(0.19, 0.31, 0.26, 0.063, x + side * 0.25, 1.26, z + 1.02, "ink", [0.27, 0, side * -0.12]);
    a.bevelBox(0.172, 0.24, 0.035, 0.015, x + side * 0.25, 1.276, z + 1.145, "forgedIron", [0.27, 0, side * -0.12]);
  }
  a.rod([x - 0.32, 1.26, z], [x - 0.43, 1.32, z + 0.22], 0.2, "suit");
  const hand = a.pivot("bank-banker-hand", [x - 0.43, 1.32, z + 0.22]);
  hand.rod([0, 0, 0], [-0.01, 0.16, 0.19], 0.16, "suit");
  hand.rod([-0.01, 0.16, 0.19], [-0.01, 0.184, 0.224], 0.13, "cream");
  hand.sphere(0.093, -0.01, 0.195, 0.26, "skin", [0.78, 0.83, 1]);
  hand.box(0.44, 0.31, 0.018, -0.18, 0.11, 0.28, "paper", [-0.37, 0, -0.23]);
  for (let n = 0; n < 3; n++) {
    hand.box(0.22, 0.01, 0.01, -0.177, 0.146 - n * 0.046, 0.314 - n * 0.017, "limestone", [0, 0, -0.23]);
  }
  a.rod([x + 0.31, 1.25, z], [x + 0.44, 1.06, z + 0.22], 0.19, "suit");
  a.rod([x + 0.44, 1.06, z + 0.22], [x + 0.59, 1.11, z + 0.37], 0.15, "suit");
  a.sphere(0.085, x + 0.645, 1.12, z + 0.42, "skin");
  const head = a.pivot("bank-banker-head", [x, 1.45, z + 0.02]);
  head.sphere(0.146, 0, 0, 0, "skin");
  head.sphere(0.287, 0, 0.22, 0.024, "skin", [1, 0.98, 0.9]);
  head.sphere(0.287, -0.032, 0.383, -0.042, "silverHair", [1.03, 0.63, 0.93]);
  for (const side of [-1, 1]) {
    head.sphere(0.061, side * 0.265, 0.198, 0.038, "skin");
    head.sphere(0.095, side * 0.217, 0.265, 0.042, "silverHair", [0.63, 1.3, 1.1]);
    head.sphere(0.025, side * 0.093, 0.26, 0.263, "ink", [0.75, 1.15, 0.35]);
    head.torus(0.069, 0.012, side * 0.092, 0.245, 0.287, "brass");
    head.sphere(0.085, side * 0.06, 0.15, 0.252, "forgedIron", [1, 0.37, 0.39]);
    head.rod([side * 0.051, 0.312, 0.27], [side * 0.15, 0.337, 0.234], 0.028, "silverHair");
  }
  head.rod([-0.026, 0.247, 0.292], [0.026, 0.247, 0.292], 0.018, "brass");
  head.sphere(0.058, 0, 0.197, 0.298, "skin", [0.85, 0.77, 1]);
  head.sphere(0.069, 0.005, 0.104, 0.25, "leather", [1, 0.44, 0.24]);
}

function shelves(a: Art, x: number, z: number, w: number, files = false) {
  a.box(w, 2.22, 0.2, x, 1.11, z - 0.16, "darkTeal");
  for (const side of [-1, 1]) a.box(0.11, 2.22, 0.48, x + side * (w / 2 - 0.05), 1.11, z, files ? "wood" : "teal");
  for (let row = 0; row < 4; row++) {
    const y = 0.21 + row * 0.56;
    a.box(w, 0.076, 0.51, x, y, z, files ? "honey" : "teal");
    const count = files ? 4 : 9;
    for (let n = 0; n < count; n++) {
      const bx = x + (n - (count - 1) / 2) * (w - 0.17) / count;
      const h = files ? 0.22 : 0.25 + (n * 3 + row) % 5 * 0.035;
      const width = (w - 0.19) * 0.85 / count;
      const color: Finish = (["teal", "apricot", "darkTeal", "gold", "cream"] as const)[(n * 3 + row) % 5];
      a.box(width, h, 0.34, bx, y + h / 2 + 0.046, z + 0.017, files ? "paper" : color);
      a.box(width * 0.68, 0.059, 0.009, bx, y + (files ? 0.21 : h - 0.03), z + 0.194, files ? color : "paper");
      if (files) {
        a.box(width * 0.5, 0.06, 0.06, bx - width * 0.17, y + h + 0.07, z - 0.02, color);
        a.box(width * 0.93, 0.022, 0.018, bx, y + 0.105, z + 0.197, "limestone");
      } else a.sphere(0.016, bx, y + 0.12, z + 0.198, "ink", [1, 1, 0.25]);
    }
  }
  a.box(w + 0.13, 0.09, 0.56, x, 2.21, z, files ? "honey" : "teal");
}

function foliage(a: Art, x: number, y: number, z: number, size: number, hanging = false) {
  a.cylinder(size * 0.18, size * 0.25, x, y + size * 0.126, z, "wood", size * 0.23);
  a.cylinder(size * 0.23, size * 0.06, x, y + size * 0.24, z, "apricot");
  for (let n = 0; n < 13; n++) {
    const angle = n * 2.399, r = (0.29 + n % 3 * 0.065) * size;
    const tx = x + Math.cos(angle) * r, tz = z + Math.sin(angle) * r * 0.66;
    const ty = y + (hanging ? 0.28 - n * 0.046 : 0.4 + n % 4 * 0.088) * size;
    a.rod([x, y + size * 0.25, z], [tx, ty, tz], 0.014 * size, "green");
    a.sphere(0.155 * size, tx, ty, tz, n % 2 === 0 ? "leaf" : "green", [1, 0.65, 0.76]);
  }
}

function windowScene(a: Art, x: number, w: number, detailed = false) {
  const z = -4.37;
  a.box(w, 1.67, 0.06, x, 1.72, z, "darkTeal");
  a.box(w - 0.16, 1.46, 0.061, x, 1.72, z + 0.034, detailed ? "windowGlass" : "glass");
  a.cylinder(0.12, 0.019, x + w * 0.21, 2.24, z + 0.069, "gold", 0.12, [Math.PI / 2, 0, 0]);
  for (let n = 0; n < 7; n++) {
    const tx = x + (n - 3) * w * 0.12, h = 0.11 + (n * 3 % 5) * 0.065;
    a.sphere(0.14, tx, 1.32 + h, z + 0.07, n % 2 ? "leaf" : "green", [1.3, 0.82, 0.25]);
    a.box(0.17, h, 0.026, tx, 1.157 + h / 2, z + 0.098, "cream");
    a.box(0.19, 0.054, 0.025, tx, 1.16 + h, z + 0.111, "red", [0, 0, n % 2 ? 0.16 : -0.15]);
  }
  a.frame(w - 0.05, 1.61, x, 1.72, z + 0.15, "teal", 0.08);
  a.box(0.064, 1.56, 0.07, x, 1.72, z + 0.165, "teal");
  a.box(w, 0.056, 0.075, x, 1.79, z + 0.165, "teal");
  a.box(w + 0.18, 0.11, 0.32, x, 0.9, z + 0.15, "honey");
  if (detailed) {
    for (const side of [-1, 1]) {
      for (let n = 0; n < 4; n++) {
        const cx = x + side * (w * 0.49 - n * 0.072);
        a.rod([cx, 2.51, z + 0.194], [x + side * (w * 0.477 + n * 0.018), 1.34 + n * 0.045, z + 0.23], 0.105, n % 2 ? "velvet" : "darkTeal");
      }
      a.sphere(0.05, x + side * w * 0.5, 1.45, z + 0.27, "brass");
    }
  }
}

function vault(a: Art, w: number, d: number) {
  const h = 2.29, y = 1.17, z = d * 0.485, r = w * 0.38;
  a.bevelBox(w, 0.13, d, 0.035, 0, 0.072, 0, "forgedIron");
  a.bevelBox(w * 0.96, h, d * 0.91, 0.085, 0, h / 2 + 0.09, 0, "forgedIron");
  a.bevelBox(w * 0.88, h * 0.91, 0.16, 0.076, 0, y, z - 0.025, "iron");
  a.bevelBox(0.075, h * 0.86, d * 0.75, 0.026, w * 0.482, y, -0.035, "iron");
  a.rod([w * 0.489, 0.3, z - 0.05], [w * 0.489, h * 0.94, z - 0.05], 0.027, "steel");
  a.frame(w * 0.831, h * 0.875, 0, y, z + 0.058, "bronze", 0.035);
  a.cylinder(r, 0.12, 0, y + 0.03, z + 0.025, "bronze", r, [Math.PI / 2, 0, 0]);
  a.torus(r * 0.92, 0.053, 0, y + 0.03, z + 0.086, "brass");
  a.cylinder(r * 0.83, 0.12, 0, y + 0.03, z + 0.074, "iron", r * 0.83, [Math.PI / 2, 0, 0]);
  a.torus(r * 0.75, 0.024, 0, y + 0.03, z + 0.137, "forgedIron");
  const wheel = a.pivot("bank-vault-wheel", [0, y + 0.03, z + 0.263]);
  wheel.torus(r * 0.42, 0.039, 0, 0, 0, "brass");
  wheel.cylinder(0.106, 0.09, 0, 0, -0.022, "bronze", 0.106, [Math.PI / 2, 0, 0]);
  wheel.sphere(0.072, 0, 0, 0.024, "brass", [1, 1, 0.58]);
  for (let n = 0; n < 16; n++) {
    const t = n * Math.PI / 8;
    a.sphere(0.028, Math.sin(t) * r * 0.93, y + 0.03 + Math.cos(t) * r * 0.93, z + 0.136, "bronze", [1, 1, 0.6]);
    if (n % 4 === 0) wheel.rod([0, 0, 0], [Math.sin(t) * r * 0.43, Math.cos(t) * r * 0.43, 0], 0.048, "brass");
  }
  for (const h of [0.7, 1.68]) {
    a.bevelBox(w * 0.18, 0.16, 0.146, 0.026, w * 0.35, h, z + 0.087, "brass");
    a.cylinder(0.063, 0.225, w * 0.42, h, z + 0.12, "bronze");
  }
}

function piggyBank(a: Art) {
  for (const x of [-.25, .2]) for (const z of [-.17, .17]) {
    a.cylinder(.075, .16, x, .08, z, "roseGlaze", .095);
  }
  a.sphere(.32, -.06, .32, 0, "roseGlaze", [1.35, .94, .94]);
  a.sphere(.24, .22, .36, .035, "roseGlaze", [1.03, 1.03, .99]);
  a.sphere(.145, .407, .335, .113, "roseGlaze", [.95, .75, 1.12]);
  for (const side of [-1, 1]) {
    const z = .04 + side * .144;
    a.cylinder(.105, .2, .237, .569, z, "roseGlaze", .012, [side * .28, 0, -.12]);
    a.sphere(.032, .365, .442, .03 + side * .183, "ink");
    a.sphere(.024, .524, .348, .103 + side * .062, "leather");
  }
  a.box(.21, .018, .035, -.1, .615, .005, "ink");
  a.torus(.071, .022, -.474, .379, .039, "roseGlaze");
  a.rod([-.484, .327, .039], [-.422, .284, 0], .039, "roseGlaze");
}

// Raised dot lettering, like the amber pixels of a stock-exchange display.
const TICKER_LETTERS = {
  C: ["0111", "1000", "1000", "1000", "1000", "1000", "0111"],
  A: ["0110", "1001", "1001", "1111", "1001", "1001", "1001"],
  "4": ["1001", "1001", "1001", "1111", "0001", "0001", "0001"],
  "0": ["0110", "1001", "1001", "1001", "1001", "1001", "0110"],
};

function stockBoard(a: Art, w: number) {
  const h = 1.24;
  a.bevelBox(w, h, .16, .067, 0, h / 2, 0, "walnut");
  a.frame(w - .1, h - .1, 0, h / 2, .09, "brass", .05);
  a.bevelBox(w - .18, h - .18, .052, .04, 0, h / 2, .105, "ink");
  const pitch = w / 31;
  const letters = ["C", "A", "C", "4", "0"] as const;
  for (const [index, letter] of letters.entries()) {
    const start = index * 5.1 + (index >= 3 ? 1.8 : 0) - 13.1;
    for (const [row, pixels] of TICKER_LETTERS[letter].entries()) {
      for (let col = 0; col < pixels.length; col++) {
        if (pixels[col] === "1") a.box(pitch * .92, .107, .014, (start + col) * pitch, h / 2 + (3 - row) * .119, .14, "paper");
      }
    }
  }
  for (const x of [-w * .473, w * .473]) {
    for (const y of [.12, h - .12]) a.sphere(.036, x, y, .119, "brass", [1, 1, .4]);
  }
}

function cryptoDesk(a: Art, w: number, d: number) {
  desk(a, 0, 0, w, d, true);
  const z = -.1;
  a.bevelBox(.69, .07, .32, .024, 0, 1.015, z, "slate");
  a.box(.16, .26, .12, 0, 1.14, z, "iron");
  a.bevelBox(1.67, 1.08, .16, .064, 0, 1.76, z, "forgedIron");
  a.bevelBox(1.52, .9, .047, .035, 0, 1.77, z + .085, "ink");
  a.cylinder(.366, .027, 0, 1.77, z + .121, "apricot", .366, [Math.PI / 2, 0, 0]);
  const symbol = a.pivot("bank-bitcoin-sign", [0, 1.77, z + .144]);
  symbol.box(.08, .4, .02, -.084, 0, 0, "paper");
  for (const y of [-.163, .012, .172]) symbol.box(.21, .066, .021, -.011, y, 0, "paper");
  for (const y of [-.081, .093]) {
    symbol.rod([.058, y - .067, 0], [.135, y - .031, 0], .067, "paper");
    symbol.rod([.135, y - .031, 0], [.135, y + .034, 0], .067, "paper");
    symbol.rod([.135, y + .034, 0], [.058, y + .066, 0], .067, "paper");
  }
  for (const x of [-.072, .005]) for (const y of [-.214, .219]) {
    symbol.box(.033, .088, .023, x, y, 0, "paper");
  }
  a.bevelBox(1.05, .065, .32, .03, -.07, 1.027, d * .29, "forgedIron");
  for (let row = 0; row < 3; row++) for (let key = 0; key < 9; key++) {
    a.box(.077, .018, .053, -.48 + key * .102, 1.067, d * .29 + (row - 1) * .08, "steel");
  }
  a.sphere(.103, .66, 1.045, d * .29, "slate", [.7, .49, 1.18]);
}

export function furnishOfficeStation(a: Art, id: string, w: number, d: number): boolean {
  if (id === "bank") {
    bankDesk(a, 0, .46, w, 1.43);
    chair(a, -.52, -.49, "leather");
    banker(a, -.52, -.33);
    lamp(a, -w * .38, .99, .43, "green");
    a.box(.38, .057, .4, .3, 1.05, .74, "paper", [0, -.14, 0]);
    return true;
  }
  if (id === "savings") {
    piggyBank(a);
    return true;
  }
  if (id === "stocks") {
    stockBoard(a, w);
    return true;
  }
  if (id === "crypto") {
    cryptoDesk(a, w, d);
    return true;
  }
  if (id === "accounts") {
    bankDesk(a, 0, .27, w, 1.15);
    chair(a, -.1, -.56, "teal");
    clerk(a, -.1, -.46, "apricot", "hair");
    lamp(a, -w * 0.34, 0.99, -.06, "brass");
    ledger(a, -0.09, 1.037, .27, w * .36);
    const x = w * 0.29;
    a.box(w * 0.25, 0.17, d * 0.48, x, 1.08, 0, "darkTeal", [-0.13, 0, 0]);
    a.cylinder(0.1, 0.15, x, 1.2, -d * 0.15, "paper", 0.1, [0, 0, Math.PI / 2]);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) a.cylinder(0.028, 0.017, x + (col - 1.5) * 0.075, 1.173 - row * 0.01, row * d * 0.065, row % 2 ? "cream" : "gold");
    return true;
  }
  if (id === "team-register") {
    shelves(a, 0, 0, w, true);
    return true;
  }
  if (id === "team") {
    desk(a, 0, 0, w, d, true);
    lamp(a, w * 0.28, 0.96, -0.15, "green");
    ledger(a, 0.1, 1.015, 0);
    foliage(a, -w * 0.33, 0.96, -0.13, 0.5);
    a.cylinder(0.07, 0.15, -w * 0.2, 1.036, d * 0.2, "teal");
    a.torus(0.055, 0.012, -w * 0.2 + 0.07, 1.035, d * 0.2, "teal");
    for (const x of [-w * 0.21, w * 0.24]) a.box(0.35, 0.029, 0.25, x, 0.992, 0, "apricot", [0, x * 0.3, 0]);
    return true;
  }
  return false;
}

export function furnishOffice(a: Art, room: "bank" | "office") {
  const bank = room === "bank";
  windowScene(a, -3.58, 2.55, bank);
  if (!bank) shelves(a, -0.75, -4.17, 1.85, true);
  shelves(a, 4.43, -4.16, 1.58);
  for (const [x, z, s] of [[-5, -2.35, 1.05], [-4.85, 2.25, 1.3], [4.9, -2.65, 0.9]]) foliage(a, x, 0, z, s);
  foliage(a, 4.45, 2.26, -4.09, 0.87, true);
  if (!bank) foliage(a, -0.9, 2.26, -4.11, 0.7, true);
  for (const side of [-1, 1]) {
    a.box(2.7, 0.024, bank ? 4.7 : 3.5, side * 2.35, 0.029, 0.9, bank ? "bronze" : "wood");
    a.box(2.55, 0.024, bank ? 4.56 : 3.36, side * 2.35, 0.043, 0.9, bank ? "velvet" : "apricot");
  }
  if (bank) {
    a.bevelBox(0.06, 0.23, 0.15, 0.027, -5.36, 1.58, -2.18, "bronze");
    a.rod([-5.35, 1.54, -2.18], [-5.18, 1.62, -2.18], 0.051, "brass");
    a.cylinder(0.113, 0.05, -5.18, 1.647, -2.18, "brass");
    a.sphere(0.107, -5.18, 1.755, -2.18, "paper", [0.87, 1.19, 0.87]);
    vault(a.pivot("bank-vault", [2.75, .016, -2.96]), 1.87, 1.49);
    chair(a, -3.4, .86, "teal", false);
    chair(a, 1.0, 2.36, "teal", false);
  } else {
    windowScene(a, 2.0, 2.42);
    chair(a, 1.65, -2.54, "teal");
    clerk(a, 1.65, -2.46, "cream", "wood", true);
    chair(a, 0.9, 0.14, "teal", false);
    chair(a, 2.48, 0.14, "red", false);

    // The waiting bench carries the wood and apron palette of the staff scenes.
    a.box(0.62, 0.14, 2.8, -4.91, 0.54, -0.98, "honey");
    a.box(0.12, 0.43, 2.8, -5.23, 0.79, -0.98, "teal");
    for (const z of [-2.16, 0.23]) a.box(0.63, 0.53, 0.1, -4.92, 0.28, z, "wood");
  }
}
