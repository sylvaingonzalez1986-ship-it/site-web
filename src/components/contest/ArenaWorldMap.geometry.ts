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
  image: "/contest/map/arena-desk-sylvain-v6.webp",
  alt: "Sylvain dans son bureau du village, entre son carnet de dégustation et ses bocaux de fleurs. À droite, un ordinateur et le tableau des classements ; à gauche, un miroir.",
} as const;

export const ARENA_MAP_PLACE_IDS = ["carnet", "jouer", "classement", "profil"] as const satisfies readonly ArenaMapPlaceId[];

/** One outline drives both the illuminated image and its clipped pointer target. */
export const ARENA_MAP_SHAPES: Record<ArenaMapPlaceId, ArenaMapPlaceShape> = {
  carnet: {
    // The top edge follows the pages under Sylvain's hand and pencil.
    outline: [
      [439,707],[456,699],[491,692],[529,685],[557,681],
      [570,681],[580,685],[592,689],[607,690],[616,685],
      [624,687],[635,685],[644,679],[655,680],[666,674],
      [675,679],[680,688],[685,681],[694,679],[690,672],
      [712,666],[746,662],[787,658],[831,656],[896,656],
      [908,659],[914,665],[1049,886],[1053,894],[1051,902],
      [1045,906],[791,923],[777,928],[765,932],[751,933],
      [738,930],[727,927],[712,928],[479,953],[470,952],
      [465,945],[434,726],[434,716],
    ],
    focusPoint: [824,794], labelPoint: [737,935], groundPoint: [450,670],
  },
  jouer: {
    // Monitor casing and the visible stand; the keyboard and mouse stay outside.
    outline: [
      [993,425],[1022,421],[1069,415],[1089,417],[1318,440],
      [1338,445],[1350,453],[1358,465],[1361,480],[1363,502],
      [1362,702],[1358,732],[1353,741],[1345,747],[1313,763],
      [1298,769],[1287,769],[1238,756],[1230,766],[1214,773],
      [1207,762],[1183,753],[1146,741],[1110,731],[1074,720],
      [1047,718],[1035,716],[1031,712],[1039,706],[981,688],
      [971,683],[965,676],[963,666],[974,452],[977,439],
      [984,430],
    ],
    focusPoint: [1190,580], labelPoint: [1175,725], groundPoint: [980,744],
  },
  classement: {
    // Follow foreground leaves and the lamp instead of drawing over them.
    outline: [
      [1011,54],[1299,34],[1300,37],[1314,32],[1325,29],
      [1336,27],[1345,23],[1348,29],[1353,25],[1352,40],
      [1367,32],[1380,29],[1397,27],[1394,48],[1385,77],
      [1380,96],[1378,110],[1393,100],[1404,84],[1411,72],
      [1415,91],[1411,104],[1412,115],[1420,110],[1413,127],
      [1408,141],[1418,134],[1415,150],[1423,169],[1436,188],
      [1439,196],[1439,298],[1427,301],[1418,311],[1408,325],
      [1400,342],[1381,347],[1366,354],[1350,365],[1337,377],
      [1020,377],[1012,374],[1009,366],[1009,63],
    ],
    focusPoint: [1213,219], labelPoint: [1229,365], groundPoint: [1017,38],
  },
  profil: {
    // Arched mirror frame, with the plant in front of the lower left corner cut out.
    outline: [
      [104,67],[113,51],[125,38],[142,27],[159,20],
      [177,15],[194,15],[211,18],[230,25],[246,36],
      [260,51],[271,69],[280,91],[283,100],[291,102],
      [298,108],[303,118],[305,132],[305,483],[303,494],
      [298,501],[289,505],[107,524],[115,518],[109,516],
      [95,516],[87,518],[87,509],[103,491],[119,469],
      [123,463],[109,459],[91,458],[69,462],[62,466],
      [63,437],[63,415],[61,406],[59,396],[59,103],
      [61,87],[66,77],[75,69],[84,66],[94,66],
    ],
    focusPoint: [182,300], labelPoint: [200,520], groundPoint: [76,30],
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
