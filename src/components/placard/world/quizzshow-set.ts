import * as THREE from "three";
import { Assembly, type CharacterPoint } from "./village-character-art";

export type QuizzShowMode = "hall" | "tournament" | "library" | "ranking";
type Point = CharacterPoint;
const yaw = .24;
function world(x: number, y: number, z: number): Point {
  return [Math.cos(yaw) * x + Math.sin(yaw) * z, y, -Math.sin(yaw) * x + Math.cos(yaw) * z];
}

const stations = [
  { x: -5.12, z: .16, yaw: .34 }, { x: -3.54, z: .43, yaw: .19 },
  { x: -1.96, z: .43, yaw: .07 }, { x: -.38, z: .16, yaw: -.07 },
];
const deck = .38;
export const QUIZZSHOW_SEATS = stations.map(station => ({
  position: world(station.x - Math.sin(station.yaw) * .57, deck + .005, station.z - Math.cos(station.yaw) * .57),
  yaw: yaw + station.yaw,
}));

type View = { target: Point; direction: Point; width: number; height: number };
function view(target: Point, direction: Point, width: number, height: number): View {
  return { target: world(...target), direction, width, height };
}
export const QUIZZSHOW_VIEWS: Record<QuizzShowMode, View> = {
  hall: view([.05, 1.02, -.26], [1, 1, 1], 15, 9.4),
  tournament: view([-2.80, 1.25, -.12], [.72, .75, 1.20], 9, 6.23),
  library: view([4.32, 1.50, -.70], [.90, .83, 1.22], 6.70, 6.74),
  ranking: view([1.37, 1.12, -1.18], [.90, .83, 1.22], 3.34, 3.85),
};
export const QUIZZSHOW_ANCHORS: Record<"tournament" | "learn" | "ranking", Point> = {
  tournament: world(-3.6, .43, 1.33),
  learn: world(4.35, 1.33, -.77),
  ranking: world(1.24, 1.93, -1.43),
};

const p = {
  ink: "#233b3d", deep: "#17494b", teal: "#197d7a", mint: "#80bcb0", chalk: "#f8efd5",
  brass: "#dca74d", gold: "#f5c966", paleGold: "#ffe7a4", wood: "#955f3d", darkWood: "#583c32",
  copper: "#c8794a", apricot: "#df975a", tile: "#cfc3a5", ruby: "#bd5145", darkRed: "#813a37",
};
const zero: Point = [0, 0, 0];

/** An extruded silhouette in the XY plane, with its face towards the open side of the set. */
function relief(a: Assembly, points: number[][], depth: number, at: Point, color: string) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  a.add(geometry, color, at);
}
function disc(a: Assembly, at: Point, radius: number, depth: number, color: string) {
  a.add(new THREE.CylinderGeometry(radius, radius, depth, 28).rotateX(Math.PI / 2), color, at);
}
function ring(a: Assembly, at: Point, radius: number, width: number, color: string) {
  a.add(new THREE.TorusGeometry(radius, width, 6, 40), color, at);
}
function pedestal(a: Assembly, at: Point, w: number, d: number, h: number, bevel: number, color: string) {
  const x = w / 2, z = d / 2, s = bevel;
  const path = [[-x+s,-z],[x-s,-z],[x,-z+s],[x,z-s],[x-s,z],[-x+s,z],[-x,z-s],[-x,-z+s]];
  const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(path.map(([u, v]) => new THREE.Vector2(u, v))), {
    depth: h, bevelEnabled: false,
  }).rotateX(-Math.PI / 2);
  a.add(geometry, color, at);
}
function turned(a: Assembly, at: Point, profile: [number, number][], color: string) {
  a.add(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 18), color, at);
}
function paint(name: string, parent: THREE.Group, material: THREE.Material, at: Point, build: (a: Assembly) => void, angle = 0) {
  const a = new Assembly();
  build(a);
  const mesh = a.finish(name, parent, material);
  mesh.position.set(...at);
  mesh.rotation.y = angle;
  return mesh;
}

function floor(a: Assembly, x: number, z: number, w: number, d: number) {
  pedestal(a, [x, -.43, z], w - .14, d - .14, .18, .30, p.ink);
  pedestal(a, [x, -.27, z], w, d, .16, .32, p.teal);
  pedestal(a, [x, -.13, z], w + .03, d + .03, .055, .32, p.brass);
  pedestal(a, [x, -.08, z], w, d, .08, .31, p.tile);
  const timber = ["#cda77b", "#d6b58e", "#e2c6a4", "#dab992", "#d1ab80"];
  const rows = Math.round((d - .3) / .37), step = (d - .3) / rows;
  for (let j = 0; j < rows; j++) {
    const end = w / 2 - .17;
    let left = -end, i = 0;
    while (left < end - .015) {
      const next = Math.min(end, left + (i === 0 && j % 2 ? 1.15 : 2.35));
      // Colour along the length of the stave, with a slight darkening at each butt joint.
      const length = next - left - .018, depth = step - .014;
      const plank = new THREE.PlaneGeometry(length, depth, 6, 4).rotateX(-Math.PI / 2);
      const positions = plank.getAttribute("position"), colors = new Float32Array(positions.count * 3);
      const dye = new THREE.Color(timber[(i * 2 + j * 3) % timber.length]);
      for (let k = 0; k < positions.count; k++) {
        const u = positions.getX(k) / length, v = positions.getZ(k) / depth;
        const grain = Math.cos(v * 17 + .8 * Math.cos(u * 5 + j) + i * 2.1);
        const tone = .97 + grain * .048 - .08 * Math.abs(2 * u) ** 5;
        colors[k * 3] = dye.r * tone; colors[k * 3 + 1] = dye.g * tone; colors[k * 3 + 2] = dye.b * tone;
      }
      plank.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      a.add(plank, null, [x + (left + next) / 2, .013, z - d / 2 + .15 + (j + .5) * step]);
      left = next; i++;
    }
  }
}

const numberStrokes = [
  [[-.055,.06],[0,.13],[0,-.13]], [[-.085,.075],[-.045,.13],[.045,.13],[.082,.085],[.075,.025],[-.085,-.13],[.09,-.13]],
  [[-.085,.105],[-.035,.13],[.06,.13],[.085,.07],[.032,.008],[-.023,0],[.055,-.004],[.085,-.064],[.05,-.13],[-.07,-.13]],
  [[.043,-.14],[.043,.13],[-.105,-.04],[.096,-.04]],
];
function lectern(a: Assembly, index: number) {
  const color = [p.teal, "#a04a3b", "#537981", "#a86530"][index];
  pedestal(a, [0, 0, 0], 1.07, .69, .075, .10, p.ink);
  pedestal(a, [0, .075, 0], 1, .64, .09, .10, p.brass);
  pedestal(a, [0, .15, 0], .93, .56, .69, .10, color);
  for (const sign of [-1, 1]) {
    a.rod([sign * .35, .21, .284], [sign * .35, .76, .284], .016, p.gold);
    a.rod([sign * .31, .23, .286], [sign * .22, .37, .286], .012, p.brass);
  }
  pedestal(a, [0, .80, 0], 1.14, .73, .075, .12, p.ink);
  pedestal(a, [0, .875, 0], 1.16, .74, .045, .12, p.brass);
  pedestal(a, [0, .92, 0], 1.1, .7, .045, .10, color);
  disc(a, [0, .49, .288], .224, .029, p.darkWood);
  disc(a, [0, .49, .308], .198, .028, p.chalk);
  ring(a, [0, .49, .323], .184, .009, p.brass);
  const line = numberStrokes[index];
  for (let i = 1; i < line.length; i++) {
    const from: Point = [line[i-1][0], .49 + line[i-1][1], .332], to: Point = [line[i][0], .49 + line[i][1], .332];
    a.rod(from, to, .018, p.ink);
    a.ball(to, .018, p.ink);
  }
  turned(a, [0,.965,-.035], [[.16,0],[.17,.028],[.152,.052],[0,.052]], p.ink);
  turned(a, [0,1.016,-.035], [[.142,0],[.135,.041],[.095,.075],[.04,.083],[0,.084]], p.ruby);
  a.ball([-.044,1.087,-.003], .020, "#ffb5a1", [1,.22,.50]);
  a.rod([.39,.962,-.16], [.37,1.17,-.19], .015, p.ink);
  a.rod([.37,1.17,-.19], [.31,1.21,-.21], .025, p.ink);
}

function spotlight(a: Assembly, x: number, y: number, z: number) {
  a.rod([x,y,z],[x,y-.17,z],.025,p.brass);
  a.add(new THREE.CylinderGeometry(.155,.10,.24,12).rotateX(Math.PI * .73),p.ink,[x,y-.25,z]);
  a.add(new THREE.CylinderGeometry(.137,.137,.018,12).rotateX(Math.PI * .73),p.paleGold,[x,y-.326,z+.092]);
}

/** Continuous velvet folds gather around the cord and open out into the weighted hem. */
function sideCurtain(a: Assembly, edge: number, sign: number) {
  const segments = 28, rows = 16;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const shadow = new THREE.Color("#702f40"), light = new THREE.Color("#bf6251"), tone = new THREE.Color();
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    const pinch = Math.exp(-((v - .4) ** 2) / .019);
    const width = .68 + .25 * v + .14 * (1 - v) ** 3 - .47 * pinch;
    for (let k = 0; k <= segments; k++) {
      const u = k / segments, fold = Math.cos(u * Math.PI * 8 + .6 * v);
      const hem = .15 + .105 * u + .055 * fold;
      positions.push(edge - sign * u * width, hem + v * (3.08 - hem), -1.27 + .16 * fold * (1 - .50 * pinch) + .10 * u);
      tone.copy(shadow).lerp(light, .47 + .34 * fold + .12 * u).toArray(colors, colors.length);
      if (!row || !k) continue;
      const n = row * (segments + 1) + k, bottom = n - segments - 1;
      if (sign < 0) indices.push(bottom-1,bottom,n,n,n-1,bottom-1);
      else indices.push(n,bottom,bottom-1,bottom-1,n-1,n);
    }
  }
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  cloth.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  cloth.setIndex(indices); cloth.computeVertexNormals(); a.add(cloth,null);
  const tie: Point[] = [[edge + sign * .03,1.46,-1.09],[edge - sign * .105,1.36,-1.065],[edge - sign * .255,1.29,-1.06],[edge - sign * .365,1.28,-1.105]];
  a.sweep(tie,[.018,.024,.024,.018],p.brass,6);
  const fringe = edge - sign * .36;
  a.rod([fringe,1.28,-1.105],[fringe-sign*.046,1.10,-1.08],.016,p.gold);
  turned(a,[fringe-sign*.046,1.0,-1.08],[[.039,0],[.041,.018],[.021,.08],[.024,.10]],p.brass);
}

function stage(a: Assembly) {
  const x = -2.75;
  pedestal(a, [x,.014,.22], 7.28,3.20,.15,.34,p.deep);
  pedestal(a, [x,.164,.17], 7.18,3.13,.045,.32,p.gold);
  pedestal(a, [x,.209,.15], 7.06,3.04,.13,.30,p.ink);
  pedestal(a, [x,.339,.13], 6.99,2.98,deck-.339,.27,p.teal);
  for (let i=0;i<21;i++)
    disc(a,[x-3.18+i*.318,.094,1.821],.031,.014,i%2 ? p.brass : p.paleGold);
  // The rear wall is built like a travelling theatre with timber wings and painted concertina curtains.
  a.box([x,1.52,-1.57],[7.05,3.02,.18],p.deep);
  a.box([x,1.54,-1.456],[6.75,2.88,.055],"#346d6c");
  for (let i=0;i<16;i++) {
    const bx = x - 3.2 + i*.425;
    a.box([bx,1.52,-1.417],[.023,2.82,.026],"#3e7773");
  }
  for (const sign of [-1,1]) {
    sideCurtain(a,x + sign * 3.44,sign);
    a.box([x+sign*3.51,1.54,-1.54],[.15,3.07,.35],p.darkWood);
    a.box([x+sign*3.51,1.55,-1.33],[.082,3.07,.08],p.copper);
  }
  // A shallow scalloped pelmet leaves the emblem and the spotlights in view.
  for (let bay=0;bay<3;bay++) {
    const left=x-3.42+bay*2.28, points=[[0,3.022],[2.28,3.022]];
    const hem: Point[]=[];
    for(let k=12;k>=0;k--) {
      const u=k/12, y=2.923-.235*Math.sin(Math.PI*u);
      points.push([u*2.28,y]); hem.push([left+u*2.28,y,-1.215]);
    }
    relief(a,points,.09,[left,0,-1.31],p.darkRed);
    a.sweep(hem,hem.map(()=>.016),p.brass,6);
  }
  const emblem: Point = [x,1.83,-1.37];
  for (let i=0;i<28;i++) {
    const angle = i*Math.PI/14, r = i%2 ? .83 : 1.0;
    a.rod([x+.55*Math.sin(angle),emblem[1]+.55*Math.cos(angle),-1.362],[x+r*Math.sin(angle),emblem[1]+r*Math.cos(angle),-1.362],.012,i%2 ? p.mint : p.brass);
  }
  disc(a,emblem,.57,.082,p.darkWood);
  disc(a,[x,1.83,-1.304],.52,.055,p.brass);
  disc(a,[x,1.83,-1.267],.447,.044,p.chalk);
  relief(a,[[.14,.34],[-.23,-.02],[-.046,-.02],[-.13,-.31],[.25,.09],[.04,.09]],.027,[x,1.83,-1.234],p.teal);
  pedestal(a,[x,3.02,-1.56],7.36,.45,.10,.10,p.ink);
  pedestal(a,[x,3.12,-1.56],7.31,.43,.060,.10,p.brass);
  for (let i=0;i<19;i++) disc(a,[x-3.3+i*6.6/18,2.916,-1.438],.039,.028,p.paleGold);
  for (const dx of [-2.68,-1.37,1.37,2.68]) spotlight(a,x+dx,3.10,-1.34);
}

const spines = ["#a84b3d", "#88998b", "#326f6a", "#cda04e", "#56687d", "#a86c48", "#718d66", "#89546a", "#dbb980"];

function bookcase(a: Assembly, x: number, section: number) {
  const z = -1.79, w = 1.36;
  const arch: number[][] = [[-w/2,.19],[w/2,.19],[w/2,2.87]];
  for (let i=0;i<=18;i++) {
    const t = Math.PI*i/18;
    arch.push([Math.cos(t)*w/2,2.86+Math.sin(t)*.61]);
  }
  relief(a,arch,.32,[x,0,z-.47],p.darkWood);
  const curve: Point[] = [];
  for (let i=0;i<=18;i++) {
    const t = Math.PI*i/18;
    curve.push([x+Math.cos(t)*.635,2.86+Math.sin(t)*.535,z+.035]);
  }
  for (let i=1;i<curve.length;i++) a.rod(curve[i-1],curve[i],.045,p.brass);
  for (const dx of [-.665,.665]) {
    a.box([x+dx,1.53,z-.16],[.102,2.79,.62],p.wood);
    a.box([x+dx,1.53,z+.157],[.042,2.78,.04],p.apricot);
    a.box([x+dx,2.85,z-.13],[.149,.13,.63],p.copper);
  }
  for (let shelf=0;shelf<5;shelf++) {
    const y = .24+shelf*.516;
    a.box([x,y,z-.14],[1.34,.093,.65],p.wood);
    a.box([x,y-.028,z+.196],[1.34,.035,.035],p.brass);
    let left = -.59;
    for (let j=0;j<9;j++) {
      const n = section*31 + shelf*19 + j*7;
      const width = .066 + (n%6)*.012, height = .259 + (n%11)*.012, thickness = .23 + (n%4)*.023;
      const bx = x+left+width/2, bz = z+.10-thickness/2 - (n%3)*.018;
      a.box([bx,y+.047+height/2,bz],[width,height,thickness],spines[(n + j * section) % spines.length]);
      if (j%3 !== 1) {
        a.box([bx,y+.115,bz+thickness/2+.002],[width*.70,.014,.006],p.brass);
        a.box([bx,y+height-.020,bz+thickness/2+.002],[width*.75,.019,.006],j%2 ? p.chalk : p.brass);
      }
      left += width+.011;
      if (left+.11 > .59) break;
    }
  }
  a.box([x,.135,z-.14],[1.44,.15,.76],p.wood);
  // The upper sunburst is cut into the arched timber above the highest shelf.
  disc(a,[x,2.97,z-.106],.096,.03,p.brass);
  for (let i=1;i<8;i++) {
    const t = i*Math.PI/8;
    a.rod([x+.132*Math.cos(t),2.92+.132*Math.sin(t),z-.10],
      [x+.415*Math.cos(t),2.92+.35*Math.sin(t),z-.10],.014,p.brass);
  }
}
function leaf(a: Assembly, x: number, y: number, z: number, width: number, length: number, tilt: number, color: string) {
  const shape = new THREE.Shape();
  shape.moveTo(0,0);
  shape.quadraticCurveTo(-width,length*.39,0,length);
  shape.quadraticCurveTo(width,length*.39,0,0);
  const geo = new THREE.ExtrudeGeometry(shape,{depth:.009,bevelEnabled:false}).rotateZ(tilt);
  a.add(geo,color,[x,y,z]);
}
function library(a: Assembly) {
  const center = 4.47;
  const backside = -2.34;
  a.box([center,1.80,backside],[4.59,3.60,.16],p.deep);
  for (const dx of [-2.24,2.24]) {
    a.box([center+dx,1.82,backside+.12],[.19,3.60,.25],p.darkWood);
    a.box([center+dx,1.85,backside+.26],[.072,3.57,.04],p.copper);
  }
  for (let i=0;i<3;i++) bookcase(a,center+(i-1)*1.43,i);
  pedestal(a,[center,3.58,backside+.04],4.76,.40,.1,.10,p.darkWood);
  pedestal(a,[center,3.68,backside+.04],4.84,.42,.064,.105,p.brass);
  // Rolling ladder on a long brass rail.
  a.rod([center-2.16,2.86,-1.47],[center+2.16,2.86,-1.47],.032,p.brass);
  const ladder = center-1.30;
  for (const dx of [-.198,.198]) {
    a.rod([ladder+dx,.048,-.84],[ladder+dx,2.88,-1.45],.044,p.copper);
    ring(a,[ladder+dx,2.86,-1.455],.075,.019,p.ink);
    disc(a,[ladder+dx,.068,-.844],.057,.042,p.ink);
  }
  for (let i=0;i<9;i++) {
    const t = .09+i*.101;
    a.rod([ladder-.19,.048+t*2.832,-.84-t*.61],[ladder+.19,.048+t*2.832,-.84-t*.61],.031,p.brass);
  }
  // A linen-bound folio is open on the reading desk.
  const tx = 4.39, tz = .42;
  pedestal(a,[tx-.03,.018,tz],2.60,1.58,.018,.14,p.deep);
  pedestal(a,[tx-.03,.037,tz],2.51,1.49,.012,.12,p.brass);
  pedestal(a,[tx-.03,.049,tz],2.44,1.42,.012,.12,"#548987");
  for (const dx of [-.66,.66]) for (const dz of [-.23,.23]) {
    turned(a,[tx+dx,.065,tz+dz],[[.085,0],[.084,.055],[.050,.13],[.071,.49],[.10,.54],[.093,.65]],p.wood);
  }
  pedestal(a,[tx,.68,tz],1.75,.81,.087,.094,p.darkWood);
  pedestal(a,[tx,.767,tz],1.82,.88,.050,.10,p.copper);
  const bx = tx-.04;
  for (const side of [-1,1]) {
    const tilt=side*.143, px=bx+side*.189;
    a.add(new THREE.BoxGeometry(.4,.044,.48).rotateZ(tilt),p.darkRed,[px,.852,tz+.063]);
    a.add(new THREE.BoxGeometry(.374,.052,.447).rotateZ(tilt),p.chalk,[px,.895,tz+.063]);
    for(let i=0;i<5;i++)
      a.add(new THREE.BoxGeometry(i===4?.19:.255,.005,.009).rotateZ(tilt),"#afac92",[px,.924,tz-.075+i*.06]);
  }
  const lampX = tx+.64, lampZ = tz-.15;
  turned(a,[lampX,.817,lampZ],[[.125,0],[.13,.036],[.052,.09],[.028,.105],[.028,.38],[.057,.40]],p.brass);
  a.add(new THREE.SphereGeometry(.175,16,7,0,Math.PI*2,0,Math.PI/2).scale(1,.68,.76),p.deep,[lampX,1.215,lampZ]);
  a.add(new THREE.CylinderGeometry(.175,.175,.018,16).scale(1,1,.76),p.paleGold,[lampX,1.211,lampZ]);
  const gx = 6.04, gz = -.55;
  turned(a,[gx,.018,gz],[[.29,0],[.31,.05],[.24,.102],[.086,.16],[.065,.63],[.12,.69]],p.wood);
  a.ball([gx,.995,gz],.305,"#79a7a1");
  for(const [dx,dy,dz,w,h,r] of [[-.12,.07,.234,.117,.087,-.3],[.105,.115,.236,.087,.095,.28],[-.042,-.084,.282,.048,.096,-.26],[.222,.024,.17,.062,.11,-.35]]) {
    a.add(new THREE.SphereGeometry(1,9,6).scale(w,h,.027).rotateZ(r).rotateY(Math.atan2(dx,dz)),p.brass,[gx+dx,.995+dy,gz+dz]);
  }
  a.add(new THREE.TorusGeometry(.329,.017,6,36).rotateY(.6).rotateZ(.28),p.gold,[gx,.995,gz]);
  a.rod([gx-.10,.68,gz],[gx+.10,1.32,gz],.021,p.brass);
}

function ranking(a: Assembly) {
  const x = 1.24, z = -1.65;
  for (const dx of [-.69,.69]) {
    a.box([x+dx,.57,z-.05],[.156,1.09,.19],p.wood);
    pedestal(a,[x+dx,.016,z],.41,.57,.085,.063,p.darkWood);
    turned(a,[x+dx,.10,z-.05],[[.133,0],[.118,.10],[.088,.15]],p.brass);
  }
  relief(a,[[-.91,.56],[.91,.56],[.91,2.52],[.78,2.69],[.25,2.69],[0,2.86],[-.25,2.69],[-.78,2.69],[-.91,2.52]],.13,[x,0,z-.10],p.darkWood);
  relief(a,[[-.83,.66],[.83,.66],[.83,2.49],[.70,2.59],[.19,2.59],[0,2.72],[-.19,2.59],[-.70,2.59],[-.83,2.49]],.05,[x,0,z+.035],p.gold);
  relief(a,[[-.75,.73],[.75,.73],[.75,2.44],[.65,2.51],[.145,2.51],[0,2.61],[-.145,2.51],[-.65,2.51],[-.75,2.44]],.04,[x,0,z+.087],p.deep);
  // A trophy in low relief identifies the register without writing fictional results on it.
  for(const sign of [-1,1]) {
    ring(a,[x+sign*.227,1.97,z+.154],.104,.026,p.brass);
    for(let i=0;i<6;i++) {
      const angle = .35+i*.191, sx=x+Math.sin(angle)*.57*sign, sy=1.40+(1-Math.cos(angle))*.85;
      leaf(a,sx,sy,z+.145,.037,.148,-sign*(.69-i*.17),p.mint);
    }
  }
  relief(a,[[-.238,.225],[.238,.225],[.191,.030],[.11,-.088],[.036,-.115],[.036,-.221],[.143,-.262],[.143,-.303],[-.143,-.303],[-.143,-.262],[-.036,-.221],[-.036,-.115],[-.11,-.088],[-.191,.030]],.038,[x,1.897,z+.149],p.gold);
  a.box([x,2.129,z+.177],[.513,.042,.07],p.paleGold);
  for(let i=0;i<3;i++) {
    const h = [.169,.295,.105][i];
    a.box([x+(i-1)*.23,1.013+h/2,z+.14],[.208,h,.039],i===1?p.gold:p.mint);
  }
  a.box([x,.976,z+.15],[.97,.042,.072],p.brass);
  a.box([x,.596,z+.086],[1.93,.105,.30],p.copper);
}

/** All furniture is batched by object so the stage, board and shelves can be picked independently. */
export function makeQuizzShowSet(mode: QuizzShowMode): THREE.Group {
  const set = new THREE.Group();
  set.name = `quizzshow-${mode}`;
  set.rotation.y = yaw;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .89 });
  paint("socle",set,material,zero,a => {
    if (mode === "hall") floor(a,.12,-.15,13.86,4.97);
    if (mode === "tournament") floor(a,-2.75,.03,7.78,4.06);
    if (mode === "library") floor(a,4.42,-.46,5.23,4.36);
    if (mode === "ranking") floor(a,1.24,-1.49,2.75,2.07);
  });
  function destination(mesh: THREE.Mesh, id: keyof typeof QUIZZSHOW_ANCHORS) {
    mesh.userData.destination = id;
    mesh.raycast = THREE.Mesh.prototype.raycast;
  }
  if (mode === "hall" || mode === "tournament") {
    destination(paint("plateau",set,material,zero,stage),"tournament");
    stations.forEach((station,i) => {
      const desk = paint(`pupitre-${i+1}`,set,material,[station.x,deck,station.z],a => lectern(a,i),station.yaw);
      destination(desk,"tournament");
      if (mode === "tournament") {
        const light = new THREE.Mesh(new THREE.RingGeometry(.16,.215,36), new THREE.MeshBasicMaterial({color:p.paleGold}));
        light.name = `reponse-${i+1}`;
        light.rotation.x = -Math.PI / 2;
        light.position.set(0,.969,-.035);
        light.visible = false;
        desk.add(light);
      }
    });
  }
  if (mode === "hall" || mode === "library") destination(paint("grande-bibliotheque",set,material,zero,library),"learn");
  if (mode === "hall" || mode === "ranking") destination(paint("tableau-du-classement",set,material,zero,ranking),"ranking");
  return set;
}
