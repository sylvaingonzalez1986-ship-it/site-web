"use client";
import {PRODUCTS_CHAPTERS,PRODUCTS_SOURCES,PRODUCTS_TERMS,PRODUCTS_QUESTIONS,PRODUCTS_VERSION,PRODUCTS_LESSON_ALIASES} from '@/lib/kanab-quest-school-products';
import type {KqSchoolCurriculumData} from '@/lib/kanab-quest-school-curriculum';
import {KqSchoolCurriculum,type KqCurriculumProps} from './KqSchoolCurriculum';
import {useKqProductsProgress} from './useKqProductsProgress';
import {KqProductsOverview,KqProductsPlate,KqProductsProcesses,KqProductsFibreChain,KqProductsLabels,KqProductsIdentity} from './KqProductsVisuals';
import {KqProductsAtlas,KqProductsRegulations,KqProductsCertificate,KqProductsTrace} from './KqProductsTools';
import styles from './KqSchoolProducts.module.css';
const data:KqSchoolCurriculumData={id:'products',label:'Produits, transformations et qualité',version:PRODUCTS_VERSION,chapters:PRODUCTS_CHAPTERS,sources:PRODUCTS_SOURCES,terms:PRODUCTS_TERMS,questions:PRODUCTS_QUESTIONS,aliases:PRODUCTS_LESSON_ALIASES,
 hero:{src:'/placard/school/products/plate-v1.webp',alt:'Planche illustrée des graines, fractions de tige et produits du chanvre, avec échantillons et dossier.',title:'De la plante au produit',introduction:'Suis les matières, distingue les transformations et enquête sur les preuves de qualité. Quatre ensembles reliés, de la graine au dossier de traçabilité.',caption:'Illustration de synthèse. Les étiquettes, certificats et lots des exercices sont fictifs.'},
 searchPlaceholder:'Chènevotte, rosin, certificat, stéréoisomère…',quizExplanation:'Dix questions, une par chapitre, parmi quarante questions de synthèse.',contextTitle:'Le contexte du produit',contextLabels:{who:'Acteurs',where:'Filière et territoire',uses:'Produit et destination',transformations:'Ce qui est séparé ou transformé',evidence:'Preuves et contrôles',labourAndTrade:'Travail et débouchés'}};
export function KqSchoolProducts(props:KqCurriculumProps) {
 const progress=useKqProductsProgress(props.ownerId);
 return <KqSchoolCurriculum {...props} data={data} progress={progress} extraTabs={[
  {id:'overview',label:'Du végétal au produit',title:'Quatre ensembles reliés',render:open=><KqProductsOverview onOpen={open}/>},
  {id:'atlas',label:'Atlas',title:'Matières, produits et limites',accepts:id=>id.startsWith('products-atlas-'),render:()=> <KqProductsAtlas passageId={props.focusSectionId} onPassage={props.onPassageChange}/>},
  {id:'fibres',label:'Fibres',title:'Comprendre le parcours textile',render:()=> <KqProductsFibreChain/>},
  {id:'processes',label:'Procédés',title:'Distinguer les opérations',render:()=> <KqProductsProcesses/>},
  {id:'labels',label:'Étiquettes',title:'Examiner les affirmations',render:()=> <KqProductsLabels/>},
  {id:'certificate',label:'Certificat',title:'Lire la portée d’une analyse',render:()=> <KqProductsCertificate/>},
  {id:'traceability',label:'Enquête',title:'Retrouver les preuves du lot B',render:()=> <KqProductsTrace key={props.ownerId||'guest'} storageKey={`products-trace:${props.ownerId||'guest'}:${PRODUCTS_VERSION}`}/>},
  {id:'regulations',label:'Règles datées',title:'Vérifier le cadre applicable',render:()=> <KqProductsRegulations/>},
 ]} replaceLessonVisual renderVisual={lesson=>lesson.id.startsWith('products-seeds-')||lesson.id.startsWith('products-materials-')?<KqProductsPlate onOpen={props.onPassageChange}/>:lesson.id.startsWith('products-fibres-')?<KqProductsFibreChain/>:lesson.id.startsWith('products-resins-')?<KqProductsProcesses/>:lesson.id.startsWith('products-labels-')||lesson.id.startsWith('products-exposure-')?<KqProductsLabels/>:lesson.id.startsWith('products-quality-')||lesson.id==='products-traceability-1'?<KqProductsCertificate/>:lesson.id.startsWith('products-origins-')?<KqProductsIdentity/>:null}
 renderActivity={(lesson,activityProps)=>lesson.id==='products-traceability-2'?<KqProductsTrace key={activityProps.storageKey} {...activityProps}/>:undefined}
 renderLessonTail={lesson=><div className={styles.links}><button type="button" onClick={()=>props.onPassageChange('products-atlas')}>Consulter l’atlas</button><button type="button" onClick={()=>props.onPassageChange('products-regulations')}>Vérifier les règles datées</button>{lesson.id.startsWith('products-origins-')||lesson.id.startsWith('products-resins-')?<button type="button" onClick={()=>props.onOtherCourse('evidence','cannabinoids-origins-1')}>Revoir les cannabinoïdes</button>:null}{lesson.id.startsWith('products-fibres-')?<button type="button" onClick={()=>props.onOtherCourse('history','history-brittany-1')}>Fibres et histoire bretonne</button>:null}<button type="button" onClick={()=>props.onOtherCourse('plant','botany-anatomy-1')}>Revoir les organes de la plante</button></div>}/>;
}
