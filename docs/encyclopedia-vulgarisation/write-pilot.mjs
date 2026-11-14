import fs from 'node:fs';
const folder = 'docs/encyclopedia-vulgarisation';
const lot = JSON.parse(fs.readFileSync('docs/encyclopedia-revision/batches/terpenes-01.json', 'utf8'));
const article = structuredClone(lot.articles.find(entry => entry.id === 'ref-terpenes-terpenoides'));
const names = 'terpenes-lesson-terpenes';
const plant = 'terpenes-lesson-booth2017';
const linalol = 'rev-terpene-pubchem-linalool';
const mirror = 'revision-iupac-stereochemistry';
article.patch = {
  ...article.patch,
  lead: 'Le limonène, les pinènes et le linalol sont des molécules que l’on trouve dans le cannabis et dans d’autres plantes. Elles participent à leurs odeurs. Les mots « terpène » et « terpénoïde » servent à les classer selon leur composition. Pour comprendre ces noms, commençons par ce qui compose une molécule.',
  sections: [
    {
      id: 'ref-terpenes-terpenoides-familles',
      title: 'Pourquoi parle-t-on de 10 ou de 15 carbones ?',
      paragraphs: [
        'Une molécule est un assemblage de petites unités de matière : les atomes. Il en existe plusieurs sortes, comme le carbone, l’hydrogène et l’oxygène. Dans les terpènes, les atomes de carbone forment une sorte d’ossature à laquelle sont attachés des atomes d’hydrogène.',
        'On peut compter les carbones de cette ossature pour distinguer plusieurs familles. Le limonène et les pinènes en possèdent chacun 10 : ce sont des monoterpènes. L’humulène et le β-caryophyllène en possèdent chacun 15 : ce sont des sesquiterpènes. Ces noms classent des molécules ; ils ne disent pas quelle odeur elles auront ni quel effet elles produiront.',
        'Le nombre ne dit pas non plus comment les atomes sont disposés. Avec 10 carbones, la molécule peut former une chaîne ouverte, comme le myrcène, ou contenir des boucles, comme les pinènes.'
      ],
      sourceIds: [names, plant],
      details: {
        title: 'Pourquoi retrouve-t-on des groupes de cinq carbones ?',
        paragraphs: ['La plante fabrique ces molécules à partir de deux petites molécules qui possèdent chacune cinq carbones. Elles sont appelées IPP et DMAPP. Ce sont des précurseurs, c’est-à-dire des matières de départ transformées au cours de la fabrication. Deux unités à cinq carbones permettent d’obtenir le précurseur à dix carbones ; trois donnent celui à quinze. Quand un texte évoque la « règle de l’isoprène », il décrit cette organisation en groupes de cinq. Cela ne signifie pas que la plante assemble directement des molécules d’isoprène libre.'],
        sourceIds: [plant, names]
      }
    },
    {
      id: 'ref-terpenes-terpenoides-oxygenes',
      title: 'Terpène ou terpénoïde : quelle différence ?',
      paragraphs: [
        'Au sens chimique retenu ici, un terpène ne contient que du carbone et de l’hydrogène. C’est ce que signifie le mot « hydrocarbure ». Le limonène en est un exemple. Un terpénoïde appartient à la même grande famille de construction, mais contient aussi de l’oxygène. Son ossature peut également avoir été modifiée. Toute molécule contenant de l’oxygène n’est donc pas un terpénoïde.',
        'Le linalol permet de voir la différence. Sa formule, C₁₀H₁₈O, est un inventaire : C indique le carbone, H l’hydrogène et O l’oxygène. Une molécule de linalol possède ainsi 10 atomes de carbone, 18 d’hydrogène et un d’oxygène. Avec ses 10 carbones, c’est un monoterpénoïde.',
        'Dans le linalol, l’oxygène porte un hydrogène : ils forment un petit groupe –OH attaché à l’ossature carbonée. Cette disposition est appelée une « fonction alcool ». Le mot décrit ici une partie de la molécule ; il ne désigne pas une boisson.'
      ],
      sourceIds: [names, linalol]
    },
    {
      id: 'ref-terpenes-terpenoides-isomeres',
      title: 'Les mêmes atomes peuvent-ils donner des molécules différentes ?',
      paragraphs: [
        'Oui. Une formule donne l’inventaire des atomes, mais pas le plan de leur assemblage. Des molécules qui ont le même inventaire et une organisation différente sont appelées des isomères.',
        'Prenons l’α-pinène et le β-pinène, que l’on prononce « alpha-pinène » et « bêta-pinène ». Ils ont chacun 10 carbones et 16 hydrogènes. Pourtant, une de leurs liaisons n’est pas placée au même endroit. Il s’agit d’une liaison double, représentée par deux traits entre deux carbones sur un dessin chimique. Ce sont donc deux isomères de structure.',
        'Il existe aussi une différence de forme dans l’espace. Pensez à vos deux mains : elles se ressemblent comme un objet et son reflet, mais vous ne pouvez pas faire coïncider leurs pouces et leurs paumes en les orientant de la même façon. Deux molécules qui ont cette relation de miroir sont appelées des énantiomères. Le linalol peut exister sous deux formes de ce type.',
        'Ces différences d’assemblage comptent : elles peuvent changer la façon dont une molécule interagit avec d’autres molécules, notamment celles qui participent à la détection des odeurs. Retenir seulement sa formule ne suffit donc pas à connaître toutes ses propriétés.'
      ],
      sourceIds: [plant, mirror, linalol],
      details: {
        title: 'Alpha, bêta, + et − : des indications différentes',
        paragraphs: ['Les lettres α et β distinguent ici deux positions de la liaison double du pinène. Chacun de ces pinènes peut lui-même exister sous deux formes miroir. Les signes (+) et (−) renseignent sur la manière dont une forme fait tourner le plan d’une lumière spécialement préparée, appelée lumière polarisée. Ils ne remplacent donc pas les lettres α et β. Pour connaître la proportion des deux formes miroir dans un échantillon, il faut une analyse capable de les séparer : mesurer seulement la quantité totale de pinène ne suffit pas.'],
        sourceIds: [plant, mirror]
      }
    }
  ],
  sourceIds: [names, plant, linalol, mirror],
  diagram: {
    kind: 'comparison',
    title: 'Compter les carbones du limonène et du caryophyllène',
    afterSectionId: 'ref-terpenes-terpenoides-familles',
    nodes: [
      { label: 'Limonène : 10 carbones', detail: 'Il appartient aux monoterpènes, comme les pinènes.', carbonAtoms: 10 },
      { label: 'β-caryophyllène : 15 carbones', detail: 'Il appartient aux sesquiterpènes, comme l’humulène.', carbonAtoms: 15 }
    ],
    caption: 'Chaque cercle représente un atome de carbone. On les compte ici sans dessiner les liaisons ni la forme réelle des molécules.',
    sourceIds: [names, plant]
  }
};
article.visual = { status: 'verified', notes: 'Comparaison du nombre réel de carbones : dix et quinze symboles C. Le schéma distingue explicitement le comptage de la représentation des liaisons. Placé après l’explication des atomes et des familles.' };
article.pedagogicalReview = {
  entryQuestion: 'Pourquoi ces molécules portent-elles des noms de familles différents ?',
  termsExplained: ['molécule', 'atome', 'ossature carbonée', 'monoterpène', 'sesquiterpène', 'hydrocarbure', 'terpénoïde', 'formule', 'fonction alcool', 'isomère', 'liaison double', 'énantiomère'],
  examples: ['10 carbones du limonène et 15 du caryophyllène', 'décodage complet de C₁₀H₁₈O', 'inventaire et plan d’assemblage', 'main gauche et main droite'],
  movedDetails: ['précurseurs IPP et DMAPP et règle C5', 'mesure des formes miroir et signes optiques'],
  checks: ['Les cinq réponses du quiz sont enseignées.', 'Une seule idée dans le schéma, après le texte.', 'Quatre documents publics distincts, aucune source inaccessible requise.', 'Anciennes ancres préservées.'],
  quizIdsRead: article.quizIdsReviewed
};
const quizPatches = [
  { id: 'hemp-molecules-monoterpene', sourceIds: [names, plant], explanation: 'Un monoterpène possède 10 atomes de carbone. Le limonène et les pinènes appartiennent à cette famille. Ce nombre décrit leur composition, pas une odeur ou un effet.' },
  { id: 'hemp-molecules-sesquiterpene', sourceIds: [names, plant], explanation: 'Un sesquiterpène possède 15 atomes de carbone. C’est le cas de l’humulène et du β-caryophyllène ; les monoterpènes, comme le limonène, en possèdent 10.' },
  { id: 'hemp-molecules-linalol-fonction', sourceIds: [linalol], explanation: 'Le linalol porte un groupe –OH : un oxygène lié à un hydrogène, attaché à son ossature carbonée. Cette disposition est appelée une fonction alcool. Le mot « alcool » désigne ici un groupe chimique.' },
  { id: 'hemp-molecules-pinenes-isomeres', sourceIds: [plant], explanation: 'L’α-pinène et le β-pinène possèdent les mêmes nombres de carbones et d’hydrogènes, mais une liaison double n’est pas placée au même endroit. Ce sont deux isomères de structure, et non les deux formes miroir d’une même structure.' },
  { id: 'hemp-molecules-enantiomeres', sourceIds: [mirror, linalol], explanation: 'Deux énantiomères se ressemblent comme une main gauche et une main droite : l’un est le reflet de l’autre, mais leurs formes ne peuvent pas se superposer. Leurs atomes sont reliés de la même manière ; leur disposition dans l’espace diffère.' }
];
fs.writeFileSync(`${folder}/pilot.json`, JSON.stringify({ article, quizPatches }, null, 2) + '\n');
console.log('Pilote écrit : 1 fiche, 5 explications, 4 documents.');
