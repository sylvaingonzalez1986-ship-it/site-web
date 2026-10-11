"use client";

import Image from "next/image";
import { ArrowDownRight, ArrowUpRight, Bug, Check, ChevronDown, Clock3, FlaskConical, Flower2, Heart, Leaf, Minus, PackageOpen, RefreshCw, ShieldCheck, Sprout, Sun, TriangleAlert, Wheat } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { canPerformKqBasicCare, getKqCareProblem, getKqCareProduct, getKqCannabinoidReport, KQ_BASIC_CARE_PRICE_CENTS, KQ_CARE_SEVERITY_LABELS, KQ_CARE_TREND_LABELS } from "@/lib/kanab-quest-care";
import { applyKqRemoteCare, getKqRemoteCareShop } from "@/lib/kanab-quest-api";
import { applyKqLocalCare, loadKqLocalCare, type KqCareStorage } from "@/lib/kanab-quest-care-local";
import { createClientRequestKey } from "@/lib/client-request-key";
import { getKqCareProductArtwork } from "@/lib/kanab-quest-care-artwork";
import { getKqCarePresentation } from "@/lib/kanab-quest-care-presentation";
import { getKqStageDisplayName, hasKqFirstCultureRescue, KQ_STAGES, type KqGameState } from "@/lib/kanab-quest-game";
import { KqCareShop } from "./KqCareShop";
import { KqCannabinoidReport } from "./KqCannabinoidReport";
import styles from "./KqCultureCare.module.css";

const formatCash = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
type CareBalance = { cashCents: number; basicCarePriceCents: number | null };

export function KqCultureCarePanel({ state, request, storage, runId, disabled, compact = false, onStateChange, onBusyChange }: {
  state: KqGameState; request: typeof fetch; storage?: KqCareStorage; runId?: string | null; disabled?: boolean; compact?: boolean;
  onStateChange: (state: KqGameState) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [shopPending, setShopPending] = useState(false);
  const [balance, setBalance] = useState<CareBalance | null>(null);
  const [balanceError, setBalanceError] = useState("");
  const [reserveVersion, setReserveVersion] = useState(0);
  const balanceGeneration = useRef(0);
  const contentId = useId();
  const reserveId = useId();
  const basicCareDescriptionId = useId();
  const basicCareStage = state.stageIndex + Number(state.phase === "resolved");
  const basicCareStageLabel = KQ_STAGES[basicCareStage] ? getKqStageDisplayName(KQ_STAGES[basicCareStage]) : "Séchage";
  const busy = useRef({ care: false, shop: false });
  const lock = useRef(false);
  const receipt = useRef<{ action: string; key: string } | null>(null);
  const basicAction = `${state.seed}:${state.stageIndex}:${state.phase}:basic`;
  const refreshBalance = useCallback(async () => {
    const generation = ++balanceGeneration.current;
    try {
      const snapshot = storage ? { ...loadKqLocalCare(storage), basicCarePriceCents: KQ_BASIC_CARE_PRICE_CENTS } : await getKqRemoteCareShop(request);
      if (generation !== balanceGeneration.current) return;
      setBalance({ cashCents: snapshot.cashCents, basicCarePriceCents: snapshot.basicCarePriceCents ?? null });
      setBalanceError("");
    } catch (error) {
      if (generation === balanceGeneration.current) setBalanceError(error instanceof Error ? error.message : "Trésorerie indisponible. Actualise le suivi.");
    }
  }, [request, storage]);
  useEffect(() => {
    if (expanded) void refreshBalance();
    return () => { balanceGeneration.current += 1; };
  }, [refreshBalance, expanded, runId, state.seed, state.stageIndex, state.phase]);
  const updateCash = (cashCents: number) => {
    balanceGeneration.current += 1;
    setBalance(current => ({ cashCents, basicCarePriceCents: storage ? KQ_BASIC_CARE_PRICE_CENTS : current?.basicCarePriceCents ?? null }));
    setBalanceError("");
  };
  const setCareBusy = (value: boolean) => {
    busy.current.care = value;
    setPending(value);
    onBusyChange(busy.current.care || busy.current.shop);
  };
  const setShopBusy = (value: boolean) => {
    balanceGeneration.current += 1;
    busy.current.shop = value;
    setShopPending(value);
    onBusyChange(busy.current.care || busy.current.shop);
    if (!value) void refreshBalance();
  };
  const apply = async (productCode?: string) => {
    if (lock.current) return;
    lock.current = true; setCareBusy(true); setNotice("");
    try {
      const action = `${state.seed}:${state.stageIndex}:${state.phase}:${productCode ?? "basic"}`;
      const retry = receipt.current?.action === action;
      if (!productCode && !retry) {
        if (!balance || balanceError || balance.basicCarePriceCents !== KQ_BASIC_CARE_PRICE_CENTS) throw new Error("Tarif d’entretien indisponible. Actualise le suivi avant de payer.");
        if (balance.cashCents < KQ_BASIC_CARE_PRICE_CENTS) throw new Error(`Trésorerie insuffisante : il faut ${formatCash(KQ_BASIC_CARE_PRICE_CENTS)} pour cet entretien.`);
      }
      if (receipt.current?.action !== action) receipt.current = { action, key: createClientRequestKey() };
      balanceGeneration.current += 1;
      let next: KqGameState;
      let chargedCents = 0;
      let replayed = false;
      if (storage) {
        const previousCash = loadKqLocalCare(storage).cashCents;
        next = applyKqLocalCare(storage, state, productCode);
        const currentCash = loadKqLocalCare(storage).cashCents;
        chargedCents = Math.max(0, previousCash - currentCash);
        replayed = !productCode && chargedCents === 0;
        updateCash(currentCash);
      }
      else {
        if (!runId) throw new Error("Reprends une culture officielle pour intervenir.");
        const result = await applyKqRemoteCare(runId, { ...(productCode ? { productCode } : { action: "basic" as const, basicPriceCents: KQ_BASIC_CARE_PRICE_CENTS }), requestKey: receipt.current.key }, request);
        next = result.state;
        chargedCents = result.chargedCents ?? 0;
        replayed = result.replayed;
        if (Number.isSafeInteger(result.cashCents)) updateCash(result.cashCents);
        else void refreshBalance();
      }
      receipt.current = null; onStateChange(next);
      setReserveVersion(current => current + 1);
      const payment = chargedCents > 0 ? replayed ? `Paiement de ${formatCash(chargedCents)} déjà enregistré, aucun nouveau débit.` : `${formatCash(chargedCents)} débités de ta trésorerie.` : "Aucun nouveau débit.";
      setNotice(productCode ? "Intervention enregistrée. Le prochain bilan en suivra les effets." : `${payment} Entretien activé pour l’étape « ${basicCareStageLabel} ». Il agira à sa validation ; la santé ne change pas au clic.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Intervention indisponible."); void refreshBalance(); throw error; }
    finally { lock.current = false; setCareBusy(false); }
  };
  if (!state.care) return null;
  const care = state.care;
  const permission = canPerformKqBasicCare(state);
  const completed = state.phase === "complete";
  const problems = care.problems.slice().sort((left, right) => right.severity - left.severity || Number(right.trend === "worsening") - Number(left.trend === "worsening"));
  const primaryProblem = problems[0];
  const critical = care.vitality <= 30 || primaryProblem?.severity === 3;
  const busyNow = pending || shopPending;
  const presentation = getKqCarePresentation(state);
  const postHarvest = presentation.condition === "harvested";
  const dead = !!state.cultureDead;
  const result = presentation.latestResult;
  const basicCareWindow = state.rulesVersion === 3 && basicCareStage < 5 && !completed && !dead;
  const basicCareQueued = basicCareWindow && care.lastBasicCareStage === basicCareStage;
  const retryBasic = receipt.current?.action === basicAction;
  const quotedPriceReady = !!balance && !balanceError && balance.basicCarePriceCents === KQ_BASIC_CARE_PRICE_CENTS;
  const insufficientCash = !!balance && balance.cashCents < KQ_BASIC_CARE_PRICE_CENTS;
  return <section className={styles.panel} aria-label="Suivi vivant de la culture" data-culture-care data-compact={compact || undefined} data-expanded={expanded} data-critical={critical || undefined} data-condition={presentation.condition} aria-busy={busyNow}>
    <div className={styles.summary}>
      <div className={styles.portrait}>
        <Image src={presentation.artwork.src} alt={presentation.artwork.alt} width={240} height={240} sizes="(max-width: 600px) 80px, 120px" data-care-portrait />
        <span className={styles.portraitName}>Sylvain</span>
      </div>
      <div className={styles.summaryMain}>
        <div className={styles.summaryHeading}><div><small className={styles.eyebrow} data-care-stage><span>{String(presentation.stageIndex + 1).padStart(2, "0")} / 06</span> {presentation.stageLabel}</small><h2>{completed || postHarvest ? "Bilan de santé" : "Santé de la culture"}</h2></div></div>
        <div className={styles.healthLine}><span className={styles.condition} data-care-condition>{dead ? <TriangleAlert size={13} aria-hidden="true" /> : postHarvest ? <PackageOpen size={13} aria-hidden="true" /> : critical ? <TriangleAlert size={13} aria-hidden="true" /> : <Leaf size={13} aria-hidden="true" />}{presentation.conditionLabel}</span><strong className={styles.vitality} data-danger={care.vitality <= 30 || undefined}><Heart size={16} aria-hidden="true" />{care.vitality}<span>/100</span></strong></div>
        <div className={styles.meter} role="meter" aria-label={postHarvest ? "Santé conservée à la récolte" : "Vitalité de la culture"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={care.vitality} aria-valuetext={`${care.vitality} sur 100 · ${presentation.conditionLabel}`}><span style={{ width: `${care.vitality}%` }} data-danger={care.vitality <= 30 || undefined} /></div>
        <div className={styles.summaryStatus}>
          <span className={styles.healthStatus} data-alert={!!primaryProblem || care.vitality <= 30 || undefined} data-care-alert aria-live="polite">{primaryProblem || care.vitality <= 30 ? <TriangleAlert size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}<span>{dead ? "Culture arrêtée · aucun lot récolté" : postHarvest ? "Suivi de la plante terminé · bilan conservé" : <>{care.vitality <= 30 ? "Vitalité critique · " : ""}{primaryProblem ? `${problems.length} ${problems.length > 1 ? "problèmes" : "problème"} · ${getKqCareProblem(primaryProblem.code)?.name ?? primaryProblem.code}${primaryProblem.severity === 3 ? " · critique" : ""}` : "Aucun problème actif"}</>}</span></span>
          {!dead && !postHarvest && care.interventions.length ? <span className={styles.interventionCount}><Clock3 size={13} aria-hidden="true" />{care.interventions.length} {care.interventions.length > 1 ? "interventions en cours" : "intervention en cours"}</span> : null}
        </div>
      </div>
      <button className={styles.toggle} type="button" aria-expanded={expanded} aria-controls={contentId} disabled={busyNow} onClick={() => { if (!busy.current.care && !busy.current.shop) { setExpanded(!expanded); if (expanded) setShopOpen(false); } }} data-care-toggle><span>{expanded ? "Replier" : compact ? "Soins et suivi" : "Voir le suivi"}</span><ChevronDown size={18} aria-hidden="true" /></button>
    </div>
    <div id={contentId} hidden={!expanded} data-care-content>
      {expanded ? <div className={styles.content}>
        <div className={styles.stageContext}>
          <div className={styles.stageNote}>{dead ? <TriangleAlert size={20} aria-hidden="true" /> : postHarvest ? <PackageOpen size={20} aria-hidden="true" /> : <Sprout size={20} aria-hidden="true" />}<p>{presentation.stageCaption}</p></div>
          <ol className={styles.stageTrack} aria-label="Progression de la culture">{KQ_STAGES.map((stage, index) => <li key={stage} aria-current={index === presentation.stageIndex ? "step" : undefined} data-reached={index < presentation.stageIndex || undefined} title={getKqStageDisplayName(stage)}><span aria-hidden="true">{index < presentation.stageIndex ? <Check size={12} /> : index + 1}</span><span>{getKqStageDisplayName(stage)}</span></li>)}</ol>
          {result ? <div className={styles.lastResult} data-care-result data-outcome={result.outcome}><span><small>Dernière opération · {result.stageLabel}</small><b>{result.label}</b></span>{typeof result.vitalityDelta === "number" ? <strong data-negative={result.vitalityDelta < 0 || undefined}><Heart size={14} aria-hidden="true" />{result.vitalityDelta === 0 ? "Santé stable" : `${result.vitalityDelta > 0 ? "+" : ""}${result.vitalityDelta} santé`}</strong> : null}</div> : null}
        </div>
        <div className={styles.sectionHeading}><h3>{postHarvest ? "Observations à la récolte" : completed || dead ? "Dernières observations" : "À surveiller"}</h3><span>{completed || dead || postHarvest ? "Bilan conservé" : "Observation gratuite"}</span></div>
        <div className={styles.problems}>{problems.length ? problems.map(problem => {
          const definition = getKqCareProblem(problem.code);
          const ProblemIcon = definition?.family === "pest" ? Bug : definition?.family === "nutrition" ? Leaf : Sun;
          const TrendIcon = problem.trend === "worsening" ? ArrowUpRight : problem.trend === "recovering" ? ArrowDownRight : Minus;
          return <article key={problem.code} data-severity={problem.severity}>
            <div className={styles.problemType}>
              <ProblemIcon size={16} aria-hidden="true" />
              <span>{definition?.family === "pest" ? "Parasites" : definition?.family === "nutrition" ? "Nutrition" : "Stress"}</span>
              <span className={styles.severityPips} aria-label={`Gravité ${problem.severity} sur 3`}>{[1, 2, 3].map(level => <i key={level} data-filled={level <= problem.severity || undefined} />)}</span>
            </div>
            <div className={styles.problemHeading}><h4>{definition?.name ?? problem.code}</h4><span>{KQ_CARE_SEVERITY_LABELS[problem.severity]}</span></div>
            <p>{definition?.symptoms[problem.variant]}</p>
            <div className={styles.problemFoot}>
              <small>{problem.status === "suspected" ? "Hypothèse à suivre" : definition?.family === "pest" ? "Foyer observé" : "Trouble confirmé"}</small>
              <strong data-trend={problem.trend}><TrendIcon size={14} aria-hidden="true" />{KQ_CARE_TREND_LABELS[problem.trend]}</strong>
            </div>
          </article>;
        }) : <p className={styles.calm}><ShieldCheck size={22} aria-hidden="true" />{dead ? "Le suivi est clos. Retrouve les événements dans le journal." : postHarvest ? "Les observations sur la plante sont closes. Les événements restent dans le journal." : "Aucun problème actif observé. Le suivi reste disponible à chaque étape."}</p>}</div>
        <p className={styles.hint}>{dead ? "Cette culture est terminée. Le journal conserve les opérations et les problèmes rencontrés." : state.stageIndex >= 5 ? "La santé conserve le bilan à la récolte. Le séchage et l’affinage influencent encore la conservation des terpènes." : "Le suivi évolue quand tu valides une opération. Observer ou revenir plus tard ne coûte aucune santé. À 0, la culture s’arrête."}</p>
        {state.firstCultureRescue && !completed ? <p className={styles.rescue}>{!hasKqFirstCultureRescue(state) ? "Le secours de première culture a été utilisé." : "Première culture : un secours gratuit peut éviter une chute à 0."}</p> : null}
        {!dead && !postHarvest && care.interventions.length ? <div className={styles.ongoing}><h3>Interventions en cours</h3><ul className={styles.interventions}>{care.interventions.map(item => {
          const product = getKqCareProduct(item.productCode);
          const artwork = getKqCareProductArtwork(item.productCode);
          const firstCheck = product?.pbi?.reductions[0] ? "Prédation au prochain bilan" : "Installation en cours";
          return <li key={`${item.productCode}:${item.stageIndex}`}>{artwork ? <Image src={artwork.src} alt="" width={52} height={52} sizes="52px" /> : <ShieldCheck size={24} aria-hidden="true" />}<div><b>{product?.name ?? item.productCode}</b><span>{item.status === "installing" ? firstCheck : "Action suivie"}</span><small><Clock3 size={12} aria-hidden="true" />{item.remainingSteps} {item.remainingSteps > 1 ? "bilans restants" : "bilan restant"}</small></div></li>;
        })}</ul></div> : null}
        {!completed && !dead ? <div className={styles.careActions}>
          <div className={styles.basicCareSection} data-care-basic-section>
            <div className={styles.actions}>
              <button className={styles.basicCare} type="button" data-care-basic data-queued={basicCareQueued || undefined} disabled={disabled || busyNow || !permission.allowed || (!retryBasic && (!quotedPriceReady || insufficientCash))} aria-describedby={basicCareDescriptionId} onClick={() => void apply().catch(() => undefined)}>
                {basicCareQueued ? <Check size={15} aria-hidden="true" /> : <Heart size={15} aria-hidden="true" />}
                {pending ? "Enregistrement…" : basicCareQueued ? "Entretien activé" : retryBasic ? "Vérifier l’entretien" : "Payer l’entretien"}{!basicCareQueued ? <span>{retryBasic ? "Sans double débit" : formatCash(KQ_BASIC_CARE_PRICE_CENTS)}</span> : null}
              </button>
              {basicCareWindow ? <small><b>{basicCareStageLabel}</b> · {basicCareQueued ? "Prévu pour ce bilan" : "Une fois pour ce bilan"}</small> : null}
            </div>
            {basicCareWindow ? <div className={styles.careBalance}><span data-care-cash data-cash-cents={balance?.cashCents}>{storage ? "Budget de simulation" : "Trésorerie"} : <b>{balance ? formatCash(balance.cashCents) : "Chargement…"}</b></span><button type="button" onClick={() => void refreshBalance()} disabled={busyNow} aria-label="Actualiser la trésorerie"><RefreshCw size={14} aria-hidden="true" /></button></div> : null}
            {basicCareWindow && !basicCareQueued ? <p className={styles.paymentHint} role="status">{retryBasic ? "Une demande a déjà été envoyée. Vérifie son résultat : elle ne sera pas facturée deux fois." : balanceError || (balance && !quotedPriceReady ? "L’entretien payant est momentanément indisponible. Actualise le suivi pour consulter le tarif." : insufficientCash ? `Trésorerie insuffisante : il manque ${formatCash(KQ_BASIC_CARE_PRICE_CENTS - balance!.cashCents)}.` : "Chaque entretien est payé séparément. Aucun renouvellement automatique.")}</p> : null}
            <p id={basicCareDescriptionId} className={styles.basicCareEffect}>{basicCareWindow ? <>Au prochain bilan : <strong>+3 santé dans le calcul</strong> et <strong>jusqu’à 2 dégâts en moins par problème persistant</strong>. L’effet arrive quand tu valides l’opération.</> : permission.reason}</p>
            {basicCareWindow ? <details className={styles.basicCareDetails}>
              <summary>Comprendre l’entretien</summary>
              <p>Ce bouton représente les gestes courants de surveillance et d’entretien de Sylvain. Chaque activation coûte {formatCash(KQ_BASIC_CARE_PRICE_CENTS)} de jeu, prélevés une seule fois. Elle ne consomme aucune charge de produit et ne lance aucun dé.</p>
              <ul>
                <li>La santé reste plafonnée à 100. Les dégâts peuvent encore la faire baisser : le bonus ne garantit pas une hausse de la jauge.</li>
                <li>Si l’opération de culture échoue, les problèmes ne gagnent pas de gravité à cause de cet échec.</li>
                <li>Si elle réussit, l’entretien aide les problèmes à reculer d’un niveau. Ce recul ne se cumule pas avec le même effet d’une opération adaptée.</li>
                <li>Il ne répare pas les pertes de récolte déjà subies et ne donne aucun bonus direct de terpènes ou de cannabinoïdes.</li>
              </ul>
              <p><strong>Exemple de jeu :</strong> avec 50 de santé et un foyer de pucerons de gravité 2, un échec de culture sans autre aide laisse 28 de santé et aggrave le foyer. Avec l’entretien, il reste 33 de santé et le foyer garde sa gravité 2.</p>
            </details> : null}
          </div>
          <button className={styles.reserveToggle} type="button" aria-expanded={shopOpen} aria-controls={reserveId} onClick={() => { if (!busy.current.care && !busy.current.shop) setShopOpen(!shopOpen); }} disabled={busyNow} data-care-reserve-toggle><PackageOpen size={24} aria-hidden="true" /><span><b>Intrants & PBI</b><small>{shopOpen ? "Replier la réserve" : "Ouvrir la réserve et choisir une intervention"}</small></span><ChevronDown size={18} aria-hidden="true" /></button>
          <div id={reserveId} hidden={!shopOpen}>{shopOpen ? <div className={styles.reserve}><KqCareShop request={request} storage={storage} state={state} refreshKey={reserveVersion} disabled={disabled || pending} onApply={apply} onPurchased={updateCash} onBusyChange={setShopBusy} /></div> : null}</div>
        </div> : null}
        {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
        {!dead ? <div className={styles.quality}><h3>{completed ? "Qualité obtenue" : "Qualité en développement"}</h3><div className={styles.metrics}><div><Flower2 size={18} aria-hidden="true" /><span>Arômes · terpènes</span><b>{care.terpenes}<small>/99</small></b><span className={styles.statTrack} aria-hidden="true"><i style={{ width: `${care.terpenes / 99 * 100}%` }} /></span></div><div><FlaskConical size={18} aria-hidden="true" /><span>Potentiel cannabinoïde</span><b>{care.cannabinoidExpression}<small>/99</small></b><span className={styles.statTrack} aria-hidden="true"><i style={{ width: `${care.cannabinoidExpression / 99 * 100}%` }} /></span></div><div><Wheat size={18} aria-hidden="true" /><span>Soutien de production</span><b>+{care.yieldBonusPercent}<small>%</small></b><small>Bonus accumulé</small></div><div data-loss={care.yieldLossPercent > 0 || undefined}><PackageOpen size={18} aria-hidden="true" /><span>Pertes enregistrées</span><b>−{care.yieldLossPercent}<small>%</small></b><small>Déjà subies</small></div></div><p className={styles.hint}>Le potentiel cannabinoïde est un indice de jeu : il suit ce que ta variété a développé puis conservé. Les taux de CBD, CBG et THC sont affichés séparément en %.</p><KqCannabinoidReport report={getKqCannabinoidReport(state)} provisional={!completed} /></div> : null}
        {care.history.length ? <details className={styles.journal}><summary>Journal du suivi <span>· {care.history.length} observations et bilans</span></summary><ol>{care.history.slice().reverse().map((event, index) => <li key={`${care.history.length - index}`}><b>Étape {event.stageIndex + 1}</b> · {event.message}{event.vitalityDelta ? <span> Santé {event.vitalityDelta > 0 ? "+" : ""}{event.vitalityDelta}.</span> : null}{event.terpenesDelta ? <span> Terpènes {event.terpenesDelta > 0 ? "+" : ""}{event.terpenesDelta}.</span> : null}</li>)}</ol></details> : null}
      </div> : null}
    </div>
  </section>;
}
