import type { KqWarehouseAirPlacement } from "@/lib/kanab-quest-warehouse-air";
import type { KqWarehouseStationPlacement } from "@/lib/kanab-quest-warehouse-stations";

type Point = { x: number; y: number };
type Project = (x: number, elevation: number, y: number) => Point;
type Vertex = [x: number, elevation: number, y: number];

const direction = {
  north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0],
} as const;

export function airAnchor(item: Pick<KqWarehouseAirPlacement, "x" | "y" | "mount">): Vertex {
  if (!item.mount) return [item.x + .5, .25, item.y + .5];
  const [dx, dy] = direction[item.mount.face];
  // Exterior anchors are on the outer edge of the cell. Interior walls
  // pass through its centre, so the face sits just inside the chosen room.
  const inset = item.mount.partitionId ? -.11 : .43;
  return [item.x + .5 - dx * inset, 2.16, item.y + .5 - dy * inset];
}

const points = (project: Project, vertices: Vertex[]) =>
  vertices.map(vertex => { const p = project(...vertex); return `${p.x},${p.y}`; }).join(" ");

function Cabinet({ project, x, y, base, height, width, depth, color }: {
  project: Project; x: number; y: number; base: number; height: number; width: number; depth: number; color: string;
}) {
  const l = x - width / 2, r = x + width / 2, b = y - depth / 2, f = y + depth / 2, top = base + height;
  return <g stroke="#23382f" strokeWidth="1" strokeLinejoin="round">
    <polygon points={points(project, [[r, top, b], [r, base, b], [r, base, f], [r, top, f]])} fill="#315c56" />
    <polygon points={points(project, [[l, top, f], [r, top, f], [r, base, f], [l, base, f]])} fill={color} />
    <polygon points={points(project, [[l, top, b], [r, top, b], [r, top, f], [l, top, f]])} fill="#a9c5ae" />
  </g>;
}

export function RoomAirModel({ item, project, flat, running, animate }: {
  item: KqWarehouseAirPlacement; project: Project; flat: boolean; running: boolean; animate: boolean;
}) {
  const anchor = airAnchor(item), point = project(...anchor);
  const [dx, dy] = item.mount ? direction[item.mount.face] : [0, 1];
  const front = project(anchor[0] + dx * .4, anchor[1], anchor[2] + dy * .4);
  const angle = Math.atan2(front.y - point.y, front.x - point.x) * 180 / Math.PI;
  const cutaway = item.mount && (flat || item.mount.partitionId || item.mount.face === "north" || item.mount.face === "west");
  return <g>
    {!item.mount && <Cabinet project={project} x={anchor[0]} y={anchor[2]} base={0} height={.24} width={.52} depth={.55} color="#6d9a8d" />}
    {cutaway && <Cabinet project={project} x={anchor[0] - dx * .08} y={anchor[2] - dy * .08}
      base={flat ? 0 : .28} height={flat ? 2.2 : 1.92} width={.11} depth={.11} color="#668c7f" />}
    {item.mount && <Cabinet project={project} x={anchor[0]} y={anchor[2]} base={2} height={.4} width={dx ? .18 : .58} depth={dx ? .58 : .18} color="#79a697" />}
    <g transform={`translate(${point.x} ${point.y}) rotate(${angle})`}>
      <rect x={-9} y={-7} width={18} height={14} rx={3} fill="#d5dbc2" stroke="#17382f" strokeWidth="1.5" />
      <circle cx={-1} r={4.6} fill={running ? "#176453" : "#204a42"} />
      <g transform="translate(-1 0)"><path data-air-rotor={running ? "running" : "still"} data-air-moving={running && animate || undefined}
        d="M0-4v8m-4-4h8m-7-3 6 6m-6 0 6-6" stroke={running ? "#f9ecc4" : "#b2c5ab"} fill="none" strokeWidth=".85" /></g>
      {item.mount && <path d="M10-3 6 0 10 3" stroke="#1f6459" strokeWidth="1.7" fill="none" />}
    </g>
  </g>;
}

export function RoomAirFlow({ item, cells, project, moving }: {
  item: KqWarehouseAirPlacement; cells: Point[]; project: Project; moving: boolean;
}) {
  const [dx, dy] = item.mount ? direction[item.mount.face] : [0, 0];
  const [x, height, y] = airAnchor(item);
  const rays = item.mount ? [[dx, dy]] : [[0, -1], [1, 0], [0, 1], [-1, 0]];
  return <g data-air-flow={item.mount?.face ?? "radial"} data-flow-motion={moving || undefined}>
    {rays.map(([vx, vy]) => {
      const distance = cells.reduce((max, cell) => {
        const x = cell.x - item.x, y = cell.y - item.y;
        return x * vy === y * vx ? Math.max(max, x * vx + y * vy) : max;
      }, 0);
      if (distance === 0) return null;
      const start = project(x + vx * .26, .045, y + vy * .26);
      const length = Math.min(2.3, distance);
      const end = project(x + vx * length, .045, y + vy * length);
      const mouth = project(x + vx * .21, height, y + vy * .21);
      const bend = project(x + vx * .74, height * .65, y + vy * .74);
      const tail = item.mount ? `M${mouth.x} ${mouth.y}Q${bend.x} ${bend.y} ${start.x} ${start.y}L${end.x} ${end.y}`
        : `M${start.x} ${start.y}L${end.x} ${end.y}`;
      const arrow = "M-7-4 0 0-7 4";
      const tip = { x: (2 * start.x + end.x) / 3, y: (2 * start.y + end.y) / 3 };
      const angle = Math.atan2(start.y - end.y, start.x - end.x) * 180 / Math.PI;
      const turn = `translate(${tip.x} ${tip.y}) rotate(${angle})`;
      return <g key={vx + "," + vy}>
        <path data-flow-halo d={tail} />
        <path data-flow-halo d={arrow} transform={turn} />
        <path data-flow-track d={tail} />
        <path d={arrow} transform={turn} />
      </g>;
    })}
  </g>;
}

export function stationAnchor(item: KqWarehouseStationPlacement): Vertex {
  return [item.x + .5, item.code === "SIM-HYGIENE-03" ? 1.42 : .6, item.y + .5];
}

export function RoomStationModel({ item, project, preparing, animate }: {
  item: KqWarehouseStationPlacement; project: Project; preparing: boolean; animate: boolean;
}) {
  const [x, , y] = stationAnchor(item);
  if (item.code === "SIM-HYGIENE-03") return <g>
    <polygon fill="#e7d39a" stroke="#4b4932" strokeWidth="1.3"
      points={points(project, [[x - .44, .022, y - .49], [x + .44, .022, y - .49], [x + .44, .022, y + .49], [x - .44, .022, y + .49]])} />
    {[-.32, .32].flatMap(offset => [-.32, .32].map(depth =>
      <Cabinet key={`${offset},${depth}`} project={project} x={x + offset} y={y + depth} base={0} height={1.52} width={.1} depth={.1} color="#729582" />))}
    <Cabinet project={project} x={x} y={y + .29} base={1.42} height={.2} width={.8} depth={.14} color="#d8a85d" />
    <polygon fill="#e8f2d055" stroke="#729582" strokeWidth="1"
      points={points(project, [[x - .34, 1.44, y - .33], [x + .34, 1.44, y - .33], [x + .34, 1.44, y + .33], [x - .34, 1.44, y + .33]])} />
  </g>;
  return <g data-irrigation-preparing={preparing || undefined}>
    <Cabinet project={project} x={x} y={y} base={0} height={.14} width={.83} depth={.78} color="#769485" />
    <Cabinet project={project} x={x - .15} y={y - .06} base={.14} height={.77} width={.47} depth={.55} color="#377c76" />
    <Cabinet project={project} x={x + .22} y={y + .09} base={.14} height={.53} width={.23} depth={.5} color="#e6c489" />
    <polyline fill="none" stroke="#224c43" strokeWidth="3.5" strokeLinecap="round"
      points={points(project, [[x - .11, .91, y], [x - .11, 1.02, y], [x + .23, 1.02, y], [x + .23, .67, y]])} />
    <polyline fill="none" stroke={preparing ? "#ffe7a3" : "#86bdba"} strokeWidth="1.6" strokeLinecap="round" data-irrigation-flow={preparing && animate || undefined}
      points={points(project, [[x - .11, .91, y], [x - .11, 1.02, y], [x + .23, 1.02, y], [x + .23, .67, y]])} />
  </g>;
}
