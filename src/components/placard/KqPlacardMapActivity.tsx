import styles from "./KqPlacardMap.module.css";

/** Crops of one painted edit, registered to the unchanged 1536 × 1024 village. */
const ACTIVITY_PAINTINGS = [
  { activity: "culture", x: 224, y: 170, width: 284, height: 194 },
  { activity: "market", x: 424, y: 382, width: 198, height: 238 },
  { activity: "jury", x: 1168, y: 542, width: 246, height: 140 },
] as const;

export function KqPlacardMapActivity({ idPrefix, culture, market, jury }: {
  idPrefix: string;
  culture: boolean;
  market: boolean;
  jury: boolean;
}) {
  const enabled = { culture, market, jury };
  const paintings = ACTIVITY_PAINTINGS.filter(({ activity }) => enabled[activity]);
  if (paintings.length === 0) return null;

  return <svg className={styles.activityLayer} viewBox="0 0 1536 1024" aria-hidden="true" focusable="false" data-map-life>
    <defs>
      {/* Only the crop boundary fades; the painting itself stays fully opaque. */}
      <filter id={`${idPrefix}-paint-edge`} x="0" y="0" width="1536" height="1024" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation="1.75" />
      </filter>
      {paintings.map(({ activity, x, y, width, height }) => <mask key={activity} id={`${idPrefix}-${activity}-painting`} maskUnits="userSpaceOnUse" x={x} y={y} width={width} height={height}>
        <rect x={x + 3} y={y + 3} width={width - 6} height={height - 6} fill="white" filter={`url(#${idPrefix}-paint-edge)`} />
      </mask>)}
    </defs>
    {paintings.map(({ activity, x, y, width, height }) => <g key={activity} data-map-activity={activity}>
      <image href={`/placard/map/placard-activity-${activity}-v1.webp`} x={x} y={y} width={width} height={height} mask={`url(#${idPrefix}-${activity}-painting)`} />
    </g>)}
  </svg>;
}
