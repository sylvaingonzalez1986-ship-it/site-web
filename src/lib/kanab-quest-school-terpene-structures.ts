// PubChem PUG REST identities and original 2D depictions, checked 2026-11-13.
// Missing entries intentionally have no verified depiction; never infer one from family.
// Provenance: docs/bete-de-concours/terpene-structure-provenance.json
export type TerpeneMolecularStructure = Readonly<{
  formula: string;
  pubchemCid: number;
  structureImage: string;
  sourceUrl: string;
  depictionScope: "connectivity" | "specified-isomer";
  isomerNote: string;
}>;

export const TERPENE_MOLECULAR_STRUCTURES: Readonly<Partial<Record<string, TerpeneMolecularStructure>>> = {
  "alphapinene": {
    "formula": "C10H16",
    "pubchemCid": 6654,
    "structureImage": "/placard/school/terpenes/alphapinene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/6654",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "betapinene": {
    "formula": "C10H16",
    "pubchemCid": 14896,
    "structureImage": "/placard/school/terpenes/betapinene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/14896",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "myrcene": {
    "formula": "C10H16",
    "pubchemCid": 31253,
    "structureImage": "/placard/school/terpenes/myrcene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/31253",
    "depictionScope": "connectivity",
    "isomerNote": "Structure 2D du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "limonene": {
    "formula": "C10H16",
    "pubchemCid": 22311,
    "structureImage": "/placard/school/terpenes/limonene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/22311",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "camphene": {
    "formula": "C10H16",
    "pubchemCid": 6616,
    "structureImage": "/placard/school/terpenes/camphene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/6616",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "alpha-phellandrene": {
    "formula": "C10H16",
    "pubchemCid": 7460,
    "structureImage": "/placard/school/terpenes/alpha-phellandrene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/7460",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "delta3-carene": {
    "formula": "C10H16",
    "pubchemCid": 26049,
    "structureImage": "/placard/school/terpenes/delta3-carene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/26049",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "alpha-terpinene": {
    "formula": "C10H16",
    "pubchemCid": 7462,
    "structureImage": "/placard/school/terpenes/alpha-terpinene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/7462",
    "depictionScope": "connectivity",
    "isomerNote": "Structure 2D du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "gamma-terpinene": {
    "formula": "C10H16",
    "pubchemCid": 7461,
    "structureImage": "/placard/school/terpenes/gamma-terpinene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/7461",
    "depictionScope": "connectivity",
    "isomerNote": "Structure 2D du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "terpinolene": {
    "formula": "C10H16",
    "pubchemCid": 11463,
    "structureImage": "/placard/school/terpenes/terpinolene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/11463",
    "depictionScope": "connectivity",
    "isomerNote": "Structure 2D du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "e-beta-ocimene": {
    "formula": "C10H16",
    "pubchemCid": 5281553,
    "structureImage": "/placard/school/terpenes/e-beta-ocimene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/5281553",
    "depictionScope": "specified-isomer",
    "isomerNote": "Géométrie (3E) du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "z-beta-ocimene": {
    "formula": "C10H16",
    "pubchemCid": 5320250,
    "structureImage": "/placard/school/terpenes/z-beta-ocimene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/5320250",
    "depictionScope": "specified-isomer",
    "isomerNote": "Géométrie (3Z) du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "linalool": {
    "formula": "C10H18O",
    "pubchemCid": 6549,
    "structureImage": "/placard/school/terpenes/linalool-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/6549",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "fenchol": {
    "formula": "C10H18O",
    "pubchemCid": 439711,
    "structureImage": "/placard/school/terpenes/fenchol-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/439711",
    "depictionScope": "specified-isomer",
    "isomerNote": "Stéréoisomère (1S,2S,4R) de la notice PubChem. Cette configuration illustre une forme du composé ; elle n’est pas attribuée aux échantillons du corpus."
  },
  "alpha-terpineol": {
    "formula": "C10H18O",
    "pubchemCid": 17100,
    "structureImage": "/placard/school/terpenes/alpha-terpineol-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/17100",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "terpinen4-ol": {
    "formula": "C10H18O",
    "pubchemCid": 11230,
    "structureImage": "/placard/school/terpenes/terpinen4-ol-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/11230",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "eucalyptol": {
    "formula": "C10H18O",
    "pubchemCid": 2758,
    "structureImage": "/placard/school/terpenes/eucalyptol-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/2758",
    "depictionScope": "connectivity",
    "isomerNote": "Structure 2D du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "p-cymene": {
    "formula": "C10H14",
    "pubchemCid": 7463,
    "structureImage": "/placard/school/terpenes/p-cymene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/7463",
    "depictionScope": "connectivity",
    "isomerNote": "Structure 2D du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "beta-caryophyllene": {
    "formula": "C15H24",
    "pubchemCid": 5281515,
    "structureImage": "/placard/school/terpenes/beta-caryophyllene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/5281515",
    "depictionScope": "specified-isomer",
    "isomerNote": "Stéréoisomère (1R,4E,9S) de la notice PubChem. Cette configuration illustre une forme du composé ; elle n’est pas attribuée aux échantillons du corpus."
  },
  "alpha-humulene": {
    "formula": "C15H24",
    "pubchemCid": 5281520,
    "structureImage": "/placard/school/terpenes/alpha-humulene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/5281520",
    "depictionScope": "specified-isomer",
    "isomerNote": "Géométrie (1E,4E,8E) du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "e-beta-farnesene": {
    "formula": "C15H24",
    "pubchemCid": 5281517,
    "structureImage": "/placard/school/terpenes/e-beta-farnesene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/5281517",
    "depictionScope": "specified-isomer",
    "isomerNote": "Géométrie (6E) du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "alpha-selinene": {
    "formula": "C15H24",
    "pubchemCid": 10856614,
    "structureImage": "/placard/school/terpenes/alpha-selinene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/10856614",
    "depictionScope": "specified-isomer",
    "isomerNote": "Stéréoisomère (3R,4aR,8aR) de la notice PubChem. Cette configuration illustre une forme du composé ; elle n’est pas attribuée aux échantillons du corpus."
  },
  "guaiol": {
    "formula": "C15H26O",
    "pubchemCid": 227829,
    "structureImage": "/placard/school/terpenes/guaiol-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/227829",
    "depictionScope": "specified-isomer",
    "isomerNote": "Stéréoisomère (3S,5R,8S) de la notice PubChem. Cette configuration illustre une forme du composé ; elle n’est pas attribuée aux échantillons du corpus."
  },
  "alpha-bisabolol": {
    "formula": "C15H26O",
    "pubchemCid": 10586,
    "structureImage": "/placard/school/terpenes/alpha-bisabolol-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/10586",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "gamma-eudesmol": {
    "formula": "C15H26O",
    "pubchemCid": 6432005,
    "structureImage": "/placard/school/terpenes/gamma-eudesmol-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/6432005",
    "depictionScope": "specified-isomer",
    "isomerNote": "Stéréoisomère (2R,4aR) de la notice PubChem. Cette configuration illustre une forme du composé ; elle n’est pas attribuée aux échantillons du corpus."
  },
  "caryophyllene-oxide": {
    "formula": "C15H24O",
    "pubchemCid": 1742210,
    "structureImage": "/placard/school/terpenes/caryophyllene-oxide-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/1742210",
    "depictionScope": "specified-isomer",
    "isomerNote": "Stéréoisomère (1R,4R,6R,10S) de la notice PubChem. Cette configuration illustre une forme du composé ; elle n’est pas attribuée aux échantillons du corpus."
  },
  "geranyl-acetate": {
    "formula": "C12H20O2",
    "pubchemCid": 1549026,
    "structureImage": "/placard/school/terpenes/geranyl-acetate-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/1549026",
    "depictionScope": "specified-isomer",
    "isomerNote": "Géométrie (2E) du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "beta-phellandrene": {
    "formula": "C10H16",
    "pubchemCid": 11142,
    "structureImage": "/placard/school/terpenes/beta-phellandrene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/11142",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "beta-selinene": {
    "formula": "C15H24",
    "pubchemCid": 442393,
    "structureImage": "/placard/school/terpenes/beta-selinene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/442393",
    "depictionScope": "specified-isomer",
    "isomerNote": "Stéréoisomère (3R,4aS,8aR) de la notice PubChem. Cette configuration illustre une forme du composé ; elle n’est pas attribuée aux échantillons du corpus."
  },
  "germacrene-b": {
    "formula": "C15H24",
    "pubchemCid": 5281519,
    "structureImage": "/placard/school/terpenes/germacrene-b-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/5281519",
    "depictionScope": "specified-isomer",
    "isomerNote": "Géométrie (1E,5E) du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "valencene": {
    "formula": "C15H24",
    "pubchemCid": 9855795,
    "structureImage": "/placard/school/terpenes/valencene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/9855795",
    "depictionScope": "specified-isomer",
    "isomerNote": "Stéréoisomère (3R,4aS,5R) de la notice PubChem. Cette configuration illustre une forme du composé ; elle n’est pas attribuée aux échantillons du corpus."
  },
  "isoborneol": {
    "formula": "C10H18O",
    "pubchemCid": 6321405,
    "structureImage": "/placard/school/terpenes/isoborneol-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/6321405",
    "depictionScope": "specified-isomer",
    "isomerNote": "Stéréoisomère (1R,2R,4R) de la notice PubChem. Cette configuration illustre une forme du composé ; elle n’est pas attribuée aux échantillons du corpus."
  },
  "o-cymene": {
    "formula": "C10H14",
    "pubchemCid": 10703,
    "structureImage": "/placard/school/terpenes/o-cymene-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/10703",
    "depictionScope": "connectivity",
    "isomerNote": "Structure 2D du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "fenchone": {
    "formula": "C10H16O",
    "pubchemCid": 14525,
    "structureImage": "/placard/school/terpenes/fenchone-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/14525",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "citronellol": {
    "formula": "C10H20O",
    "pubchemCid": 8842,
    "structureImage": "/placard/school/terpenes/citronellol-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/8842",
    "depictionScope": "connectivity",
    "isomerNote": "Schéma de connectivité : la configuration des centres chiraux n’est pas précisée. Il ne fixe ni un énantiomère ni leur proportion."
  },
  "nerol": {
    "formula": "C10H18O",
    "pubchemCid": 643820,
    "structureImage": "/placard/school/terpenes/nerol-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/643820",
    "depictionScope": "specified-isomer",
    "isomerNote": "Géométrie (2Z) du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  },
  "neral": {
    "formula": "C10H16O",
    "pubchemCid": 643779,
    "structureImage": "/placard/school/terpenes/neral-structure.png",
    "sourceUrl": "https://pubchem.ncbi.nlm.nih.gov/compound/643779",
    "depictionScope": "specified-isomer",
    "isomerNote": "Géométrie (2Z) du composé nommé, selon PubChem. Le dessin n’est pas une preuve de présence dans un échantillon."
  }
};
