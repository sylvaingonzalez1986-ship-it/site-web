export type ArenaMapPlaceId = "carnet" | "jouer" | "classement" | "profil";
type Point = readonly [number, number];

export type ArenaMapPlaceShape = {
  /** Visible object outline, in pixels of the original illustration. */
  outline: readonly Point[];
  /** Interior point for centering and pointer checks. */
  focusPoint: Point;
  /** The HTML label stays readable independently of the object silhouette. */
  labelPoint: Point;
  /** Inside the bounding box, outside this object and the other targets. */
  groundPoint: Point;
};

export const ARENA_MAP_SCENE = {
  width: 1536,
  height: 1024,
  image: "/contest/map/arena-roman-sylvain-v7.webp",
  alt: "Vu de dos, Sylvain se tient en hauteur dans les gradins de l’arène romaine. À sa droite, son téléphone affiche le carnet de dégustation ; à sa gauche se trouve le panneau des classements. En contrebas, au centre de l’arène, une estrade porte une table où le plan du village est posé à plat sous une bulle de verre.",
} as const;

export const ARENA_MAP_PLACE_IDS = ["carnet", "jouer", "classement", "profil"] as const satisfies readonly ArenaMapPlaceId[];

/** One outline drives both the illuminated image and its clipped pointer target. */
export const ARENA_MAP_SHAPES: Record<ArenaMapPlaceId, ArenaMapPlaceShape> = {
  carnet: {
    // Visible smartphone bezel and Carnet screen, without the hand holding it.
    outline: [
      [786,814],[834,637],[839,625],[848,618],[859,617],
      [951,636],[961,642],[968,652],[967,662],[947,735],
      [936,738],[927,745],[922,755],[923,768],[927,778],
      [918,799],[914,817],[912,839],[902,846],[879,853],
      [800,836],[791,829],
    ],
    focusPoint: [877,720], labelPoint: [1090,940], groundPoint: [965,705],
  },
  jouer: {
    // Central platform, horizontal village board and glass dome, behind the phone.
    outline: [
      [739,533],[734,508],[734,484],[740,464],[737,445],
      [738,425],[744,402],[760,382],[765,354],[775,326],
      [789,300],[811,275],[837,255],[869,236],[905,220],
      [942,209],[982,201],[1024,198],[1067,199],[1109,204],
      [1152,214],[1190,230],[1224,249],[1253,273],[1275,300],
      [1291,328],[1303,359],[1307,384],[1320,407],[1327,435],
      [1326,461],[1319,484],[1336,506],[1348,530],[1351,549],
      [1346,575],[1329,600],[1317,615],[1317,626],[1282,647],
      [1243,665],[1196,680],[1146,690],[1092,695],[1039,694],
      [968,686],[975,653],[967,639],[953,631],[860,612],
      [845,616],[836,626],[827,653],[797,641],[774,626],
      [755,605],[753,576],[745,553],
    ],
    focusPoint: [1080,425], labelPoint: [1200,645], groundPoint: [750,220],
  },
  classement: {
    // Slate-roofed ranking noticeboard, trophy, three slips and visible wooden posts.
    outline: [
      [8,352],[48,311],[91,278],[105,276],[234,300],
      [236,286],[248,273],[259,269],[303,278],[309,285],
      [308,298],[301,300],[301,314],[348,322],[371,343],
      [408,374],[412,386],[410,397],[396,403],[384,399],
      [382,793],[357,814],[338,832],[304,822],[304,745],
      [88,739],[88,763],[38,750],[37,370],[18,379],[9,374],
    ],
    focusPoint: [220,550], labelPoint: [250,695], groundPoint: [20,285],
  },
  profil: {
    // Sylvain seen from behind, including his right hand around the separate phone.
    outline: [
      [251,1024],[264,976],[282,926],[306,878],[336,838],
      [370,808],[407,785],[450,767],[497,756],[499,741],
      [473,726],[455,710],[440,705],[429,696],[423,680],
      [422,659],[427,645],[440,632],[448,626],[442,603],
      [445,576],[454,548],[470,522],[492,500],[519,483],
      [550,471],[584,465],[615,467],[646,476],[673,490],
      [696,510],[713,536],[725,563],[732,580],
      [745,584],[748,594],[743,605],[729,615],
      [728,639],[739,651],[745,667],[741,683],[733,698],
      [718,710],[699,712],[685,729],[667,742],[651,748],
      [653,754],[697,765],[734,785],[769,815],[795,844],
      [819,876],[854,860],[880,858],[910,849],[916,822],
      [920,803],[930,780],[926,767],[926,756],[931,749],
      [938,746],[947,752],[955,766],[956,742],[952,731],
      [958,728],[969,740],[975,759],[979,784],[979,811],
      [975,835],[965,860],[959,869],[969,894],[972,916],
      [968,941],[958,967],[941,992],[920,1013],[904,1024],
    ],
    focusPoint: [570,857], labelPoint: [525,946], groundPoint: [975,1000],
  },
};

export function getArenaMapPlaceGeometry(id: ArenaMapPlaceId) {
  const shape = ARENA_MAP_SHAPES[id];
  const left = Math.min(...shape.outline.map(([x]) => x));
  const top = Math.min(...shape.outline.map(([, y]) => y));
  const width = Math.max(...shape.outline.map(([x]) => x)) - left;
  const height = Math.max(...shape.outline.map(([, y]) => y)) - top;
  const normalized = ([x, y]: Point) => `${x / ARENA_MAP_SCENE.width * 100},${y / ARENA_MAP_SCENE.height * 100}`;
  return {
    ...shape,
    points: shape.outline.map(point => point.join(",")).join(" "),
    clipPath: `polygon(${shape.outline.map(([x, y]) => `${(x - left) / width * 100}% ${(y - top) / height * 100}%`).join(",")})`,
    left: `${left / ARENA_MAP_SCENE.width * 100}%`, top: `${top / ARENA_MAP_SCENE.height * 100}%`,
    width: `${width / ARENA_MAP_SCENE.width * 100}%`, height: `${height / ARENA_MAP_SCENE.height * 100}%`,
    labelLeft: `${(shape.labelPoint[0] - left) / width * 100}%`, labelTop: `${(shape.labelPoint[1] - top) / height * 100}%`,
    hitPoint: normalized(shape.focusPoint), groundPoint: normalized(shape.groundPoint),
  };
}
