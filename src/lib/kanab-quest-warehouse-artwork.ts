/** The renovated room is shared by the live warehouse and La relève. */
export const KQ_WAREHOUSE_ROOM_ARTWORK = '/placard/warehouse-v4/overhead-room-renovated-v1.webp';

/** The square drawing is stretched into each plan's SVG viewBox before picking a cell. */
export const KQ_WAREHOUSE_ART_FRAMES = {
  compact: { width: 400, height: 400, grid: { x: 50, y: 50, cell: 30, columns: 10, rows: 10 } },
  legacy: { width: 1536, height: 1024, grid: { x: 168, y: 120, cell: 30, columns: 40, rows: 25 } },
} as const;
