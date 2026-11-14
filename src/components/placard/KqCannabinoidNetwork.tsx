"use client";
import { useState } from "react";
import { CANNABINOID_NETWORK_NODES, CANNABINOID_NETWORK_EDGES } from "@/lib/kanab-quest-school-cannabinoids-network";
import type { CannabinoidNetworkEdge } from "@/lib/kanab-quest-school-cannabinoids-types";
import { KqHistorySources } from "./KqHistorySources";
import styles from "./KqSchoolCannabinoids.module.css";
export const CAN_PROCESS_LABELS = { biosynthesis:"Dans la plante", decarboxylation:"Décarboxylation", oxidation:"Vieillissement", metabolism:"Métabolisme humain", "commercial-conversion":"Fabrication" };
export function KqCannabinoidNetwork({ onPassage, initialProcess="biosynthesis" }: { onPassage:(id:string)=>void; initialProcess?: CannabinoidNetworkEdge["kind"] }) {
  const [kind,setKind] = useState(initialProcess),[edgeId,setEdgeId] = useState("");
  const edges = CANNABINOID_NETWORK_EDGES.filter(edge=>edge.kind===kind);
  const edge = edges.find(item=>item.id===edgeId) ?? edges[0];
  const sources = [...new Set(edges.map(item=>item.from))];
  const node = (id:string)=>CANNABINOID_NETWORK_NODES.find(item=>item.id===id);
  return <section className={styles.network} data-cannabinoid-network>
    <div className={styles.choices} role="group" aria-label="Contexte de transformation">{Object.entries(CAN_PROCESS_LABELS).map(([id,label])=><button key={id} type="button" aria-pressed={kind===id} onClick={()=>{setKind(id as CannabinoidNetworkEdge["kind"]);setEdgeId("");}}>{label}</button>)}</div>
    <p>Choisis une flèche pour voir sa preuve. Trait continu : relation étayée dans le modèle cité. Pointillés et mention « proposée » : relation moins établie dans ce corpus.</p>
    <ul className={styles.branchList}>{sources.map(id=><li className={styles.branch} key={id}><h5>À partir de {node(id)?.label ?? id}</h5><div className={styles.arrows}>{edges.filter(item=>item.from===id).map(item=><div className={styles.arrow} data-status={item.evidenceStatus} key={item.id}><span className={styles.arrowSource}>{node(item.from)?.label ?? item.from}</span><span className={styles.arrowLine} aria-hidden="true"/><button type="button" data-network-edge={item.id} aria-label={`${node(item.from)?.label ?? item.from} vers ${node(item.to)?.label ?? item.to} : ${item.label}${item.evidenceStatus==="proposed" ? " · proposée" : ""}`} aria-pressed={edge?.id===item.id} onClick={()=>setEdgeId(item.id)}><small>{item.label}{item.evidenceStatus==="proposed" ? " · proposée" : ""}</small><strong>{node(item.to)?.label ?? item.to}</strong></button></div>)}</div></li>)}</ul>
    {edge ? <div className={styles.edgeDetail} role="status" data-network-detail={edge.id}><h5>{node(edge.from)?.label} → {node(edge.to)?.label}</h5><p>{edge.explanation}</p><p className={styles.limits}>{edge.limitation}</p><KqHistorySources ids={edge.sourceIds}/><div className={styles.choices}>{[node(edge.from),node(edge.to)].filter(item=>item?.compoundId).map(item=><button type="button" key={item!.id} onClick={()=>onPassage(`compound-${item!.compoundId}`)}>Fiche {item!.label}</button>)}</div></div>:null}
    <p>Schéma conceptuel : les flèches ne donnent ni rendement, ni vitesse, ni mode opératoire. Le CBGA acide est un carrefour ; le CBG neutre n’est pas « le père de toutes les molécules ».</p>
  </section>;
}
