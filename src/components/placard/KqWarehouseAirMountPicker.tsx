import { getKqWarehouseAirMounts, type KqWarehouseAirFace, type KqWarehouseAirMount } from "@/lib/kanab-quest-warehouse-air";
import type { KqWarehouseDimensions, KqWarehousePartition } from "@/lib/kanab-quest-warehouse";
import { describeKqWarehouseAirMount } from "@/lib/kanab-quest-warehouse-plan-review";
import styles from "./KqWarehouse.module.css";

type Point = { x: number; y: number };
const mountKey = (mount?: KqWarehouseAirMount) => !mount ? "floor"
  : mount.partitionId ? `partition:${mount.partitionId}:${mount.face}` : `wall:${mount.face}`;

export function KqWarehouseAirMountPicker({ dimensions, partitions = [], mount, disabled, onChange }: {
  dimensions: KqWarehouseDimensions;
  partitions?: KqWarehousePartition[];
  mount?: KqWarehouseAirMount;
  disabled: boolean;
  onChange: (mount: KqWarehouseAirMount | undefined, initialCell: Point | undefined) => void;
}) {
  const { columns, rows } = dimensions;
  const anchor = (face: KqWarehouseAirFace, start: Point, axis: "x" | "y", length: number, partitionId?: string) => {
    const mount: KqWarehouseAirMount = { kind: "wall", face, ...(partitionId ? { partitionId } : {}) };
    // Start near the centre, then try nearby anchors if a junction blocks it.
    const middle = Math.floor(length / 2);
    const offsets = Array.from({ length }, (_, offset) => offset).sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));
    const initialCell = offsets.map(offset => ({ ...start, [axis]: start[axis] + offset })).find(point =>
      getKqWarehouseAirMounts(point, dimensions, partitions).some(support => mountKey(support) === mountKey(mount)));
    return { mount, initialCell };
  };
  const outer = [anchor("south", { x: 0, y: 0 }, "x", columns), anchor("west", { x: columns - 1, y: 0 }, "y", rows),
    anchor("north", { x: 0, y: rows - 1 }, "x", columns), anchor("east", { x: 0, y: 0 }, "y", rows)];
  const inner = partitions.flatMap(wall => {
    const faces = wall.axis === "x" ? ["north", "south"] as const : ["west", "east"] as const;
    return faces.map(face => anchor(face, { x: wall.x, y: wall.y }, wall.axis, wall.length, wall.id));
  });
  const options = (values: typeof outer) => values.map(item => <option key={mountKey(item.mount)} value={mountKey(item.mount)} disabled={!item.initialCell}>
    {describeKqWarehouseAirMount(item.mount, partitions)}</option>);
  return <label className={styles.field}>Fixation et côté d’aspiration
    <select data-air-mount value={mountKey(mount)} disabled={disabled} onChange={event => {
      const choice = [...outer, ...inner].find(item => mountKey(item.mount) === event.target.value);
      onChange(choice?.mount, choice?.initialCell);
    }}>
      <option value="floor">Au sol · dans toutes les directions</option>
      <optgroup label="Murs de l’entrepôt">{options(outer)}</optgroup>
      {inner.length > 0 && <optgroup label="Parois intérieures">{options(inner)}</optgroup>}
    </select>
  </label>;
}
