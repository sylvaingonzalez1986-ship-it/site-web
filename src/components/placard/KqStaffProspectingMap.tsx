"use client";

import { KqHelpDashboard, KqHelpGrid, KqHelpNote } from "./KqHelpDashboard";
import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { Check, MapPin } from "lucide-react";
import { KQ_BRITTANY_CITY_POINTS, KQ_BRITTANY_DEPARTMENTS, KQ_BRITTANY_MAP_SOURCE, KQ_BRITTANY_MAP_VIEWBOX } from "@/data/kq-brittany-map";
import { KQ_FLAVORS, type KqFlavorCode } from "@/lib/kanab-quest-buddie-flavors";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_PROSPECTING_DEPARTMENTS, KQ_PROSPECTING_INTEREST_LABELS, KQ_STAFF_CITIES, type KqProspectingProduct } from "@/lib/kanab-quest-prospecting";
import styles from "./KqStaffProspectingMap.module.css";

export type KqStaffProspectingMapProps = {
  cityId: string;
  onCityChange: (id: string) => void;
  disabled?: boolean;
  prospecting: Record<string, number>;
  networkPartners: number;
};

function Flavors({ flavors, city = false }: { flavors: readonly KqFlavorCode[]; city?: boolean }) {
  return <ul className={styles.flavors} aria-label="Goûts recherchés" data-prospecting-flavors={city || undefined}>{flavors.map(code => <li key={code}><Image src={KQ_FLAVORS[code].image} alt="" width={36} height={36} sizes="36px" /><span>{KQ_FLAVORS[code].label}</span></li>)}</ul>;
}

function Products({ products, city = false }: { products: readonly KqProspectingProduct[]; city?: boolean }) {
  return <ul className={styles.products} aria-label="Intérêt par famille de produits" data-prospecting-products={city || undefined}>{products.map(product => <li key={product.family} data-product-family={product.family} data-product-interest={product.interest}><div><strong>{product.label}</strong><span>{KQ_PROSPECTING_INTEREST_LABELS[product.interest]}</span></div><small>{product.examples.join(" · ")}</small></li>)}</ul>;
}

/** Controlled city selection. Costs and the prospecting command are confirmed by the parent form. */
export function KqStaffProspectingMap({ cityId, onCityChange, disabled = false, prospecting, networkPartners }: KqStaffProspectingMapProps) {
  const titleId = useId(), mapId = useId(), mapHelpId = useId();
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const mapBoardRef = useRef<HTMLDivElement>(null);
  const city = KQ_STAFF_CITIES.find(item => item.id === cityId);
  const department = city ? KQ_PROSPECTING_DEPARTMENTS.find(item => item.code === city.department) : undefined;
  const { width, height } = KQ_BRITTANY_MAP_VIEWBOX;
  useEffect(() => {
    const viewport = mapViewportRef.current, board = mapBoardRef.current;
    const point = KQ_BRITTANY_CITY_POINTS[cityId];
    if (!viewport || !board || !point) return;
    function revealCity() {
      if (!viewport || !board || !point) return;
      const x = point.x / width * board.clientWidth;
      const edge = 32;
      if (x - edge < viewport.scrollLeft || x + edge > viewport.scrollLeft + viewport.clientWidth) {
        viewport.scrollLeft = Math.max(0, x - viewport.clientWidth / 2);
      }
    }
    revealCity();
    const observer = new ResizeObserver(revealCity);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [cityId, width]);
  function selectCity(id: string) { if (!disabled && id !== cityId) onCityChange(id); }
  return <section className={styles.prospecting} data-staff-prospecting-map aria-labelledby={titleId}>
    <header className={styles.heading}><h4 id={titleId}>Choisir une ville en Bretagne</h4></header>
    <div className={styles.content} data-prospecting-city-details={city?.id ?? "none"}>
      {city && department ? <>
        <div className={styles.selection}><header className={styles.cityHeading}><MapPin size={22} aria-hidden="true" /><div><h5>{city.name}</h5><p>{city.department} · {department.name}</p></div></header><dl className={styles.numbers}><div><dt>Frais de déplacement</dt><dd>{formatKqCash(city.travelCents)}</dd></div></dl></div>
        <dl className={styles.network}><div><dt>Partenariats signés ici</dt><dd>{(prospecting[city.id] ?? 0).toLocaleString("fr-FR")}</dd></div><div><dt>Réseau actuel de la ferme</dt><dd>{networkPartners.toLocaleString("fr-FR")} boutique{networkPartners > 1 ? "s" : ""}</dd></div></dl>
      </> : <p>Choisis une ville pour connaître le coût du trajet.</p>}
      <div className={styles.geography}>
        <figure className={styles.mapSheet}>
          <div ref={mapViewportRef} className={styles.mapViewport} data-prospecting-map-viewport tabIndex={0} role="region" aria-label="Carte interactive de Bretagne" aria-describedby={mapHelpId} onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            const viewport = event.currentTarget;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); viewport.scrollLeft += event.key === "ArrowLeft" ? -160 : 160; }
            if (event.key === "Home" || event.key === "End") { event.preventDefault(); viewport.scrollLeft = event.key === "Home" ? 0 : viewport.scrollWidth; }
          }}>
          <div ref={mapBoardRef} className={styles.mapBoard}>
            <svg viewBox={"0 0 " + width + " " + height} role="img" aria-labelledby={mapId} className={styles.map}>
              <title id={mapId}>Bretagne : Côtes-d’Armor, Finistère, Ille-et-Vilaine et Morbihan. Huit villes de prospection.</title>
              <text x="85" y="52" className={styles.sea}>Manche</text>
              <text x="120" y="378" className={styles.sea}>Océan Atlantique</text>
              {KQ_BRITTANY_DEPARTMENTS.map(shape => <g key={shape.code}><path d={shape.path} className={styles.department} data-prospecting-department={shape.code} data-selected={city?.department === shape.code} /><text x={shape.labelX} y={shape.labelY} className={styles.departmentCode} textAnchor="middle">{shape.code}</text></g>)}
              {KQ_STAFF_CITIES.map(item => {
                const point = KQ_BRITTANY_CITY_POINTS[item.id];
                return <g key={item.id} data-selected={item.id === cityId}><circle cx={point.x} cy={point.y} r={8} className={styles.cityDot} /><text x={point.x} y={point.y + 42} textAnchor="middle" className={styles.cityLabel}>{item.name}</text></g>;
              })}
              <g className={styles.north} transform="translate(706 38)"><path d="M0 35V5M-5 13L0 5L5 13" /><text x="0" y="0" textAnchor="middle">N</text></g>
            </svg>
            {KQ_STAFF_CITIES.map((item, index) => {
              const point = KQ_BRITTANY_CITY_POINTS[item.id];
              return <button key={item.id} type="button" className={styles.mapPin} data-prospecting-map-pin={item.id} style={{ left: point.x / width * 100 + "%", top: point.y / height * 100 + "%" }} aria-label={item.name + " · " + item.departmentName} aria-pressed={item.id === cityId} disabled={disabled} onClick={() => selectCity(item.id)}>{item.id === cityId ? <Check size={18} aria-hidden="true" /> : <span aria-hidden="true">{index + 1}</span>}</button>;
            })}
          </div>
          </div>
          <figcaption id={mapHelpId}>Fais glisser la carte de côté si nécessaire ; au clavier, utilise les flèches gauche et droite. La liste « Toutes les villes » offre les mêmes choix.</figcaption>
        </figure>
        <details className={styles.cityList} data-prospecting-city-list><summary>Toutes les villes</summary><div className={styles.cities} role="group" aria-label="Villes de prospection">{KQ_STAFF_CITIES.map((item, index) => <button type="button" key={item.id} data-prospecting-city={item.id} aria-pressed={item.id === cityId} disabled={disabled} onClick={() => selectCity(item.id)}><span className={styles.cityName}><span className={styles.cityNumber} aria-hidden="true">{index + 1}</span>{item.name}{item.id === cityId ? <Check size={16} aria-hidden="true" /> : null}</span><small>{item.department} · trajet {formatKqCash(item.travelCents)}</small></button>)}</div></details>
      </div>
      {city && department ? <details className={styles.marketProfile} data-prospecting-profile><summary>Goûts et produits recherchés</summary><div className={styles.profileContent}>
          <p className={styles.description}>{city.description}</p>
          <Flavors flavors={city.flavors} city />
          <Products products={city.products} city />
          <details className={styles.departmentDetails}><summary>Tendance départementale · {department.name}</summary><p>{department.description}</p><Flavors flavors={department.flavors} /><Products products={department.products} /></details>
        </div></details> : null}
    </div>
    <details className={styles.about}><summary>À propos des marchés et de la carte</summary><KqHelpDashboard>
      <KqHelpGrid art="help-travel" items={[
        { label: "Villes", value: "Prospection renouvelable", detail: "Villes inépuisables, boutiques sans plafond.", art: "help-travel" },
        { label: "Chances de réussite", value: "Aucun résultat garanti", detail: "Compétence, réputation et abonnés Instagram comptent.", art: "help-social" },
        { label: "Goûts et produits", value: "Profils fictifs du jeu", detail: "Sans bonus automatique ni prix garanti.", art: "help-quality" },
        { label: "Partenariats signés", value: "Total historique", detail: "Le réseau actuel évolue séparément.", art: "commerce" },
        { label: "Contours", value: <a href={KQ_BRITTANY_MAP_SOURCE.url} target="_blank" rel="noreferrer">{KQ_BRITTANY_MAP_SOURCE.label}</a>, detail: <a href={KQ_BRITTANY_MAP_SOURCE.licenceUrl} target="_blank" rel="noreferrer">{KQ_BRITTANY_MAP_SOURCE.licence}</a>, art: "help-travel" },
        { label: "Positions des villes", value: <a href={KQ_BRITTANY_MAP_SOURCE.centresUrl} target="_blank" rel="noreferrer">API Découpage administratif</a>, art: "quarter" },
      ]} />
      <KqHelpNote>Géométrie simplifiée pour l’affichage.</KqHelpNote>
    </KqHelpDashboard></details>
    <p className={styles.srOnly} role="status" aria-live="polite">{city ? city.name + " sélectionnée, " + city.departmentName + ". Trajet : " + formatKqCash(city.travelCents) + "." : "Aucune ville sélectionnée."}</p>
  </section>;
}
