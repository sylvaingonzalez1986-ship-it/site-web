export type ProducerOption = {
  value: string;
  label: string;
};

export const PRODUCER_CLIMATE_OPTIONS: ProducerOption[] = [
  { value: "oceanique", label: "Climat océanique" },
  { value: "oceanique-altere", label: "Climat océanique altéré / dégradé" },
  { value: "semi-continental", label: "Climat semi-continental" },
  { value: "mediterraneen", label: "Climat méditerranéen" },
  { value: "montagnard", label: "Climat montagnard" },
];

export const PRODUCER_CLIMATE_DETAILS: Record<string, string[]> = {
  oceanique: [
    "Ouest (Bretagne, Normandie, Nouvelle-Aquitaine)",
    "Hivers doux, étés frais",
  ],
  "oceanique-altere": [
    "Nord, Centre, Bassin parisien",
    "Hivers plus froids, étés plus chauds",
  ],
  "semi-continental": [
    "Est, Centre-Est (Alsace, Bourgogne)",
    "Hivers froids, étés chauds et secs",
  ],
  mediterraneen: [
    "Sud-Est (Provence, Côte d'Azur, Languedoc)",
    "Étés chauds et très secs, hivers doux",
  ],
  montagnard: [
    "Alpes, Pyrénées, Massif central, Vosges, Jura",
    "Hivers longs et froids, étés courts et frais",
  ],
};

export const PRODUCER_SOIL_OPTIONS: ProducerOption[] = [
  { value: "sol-sableux", label: "Sol sableux" },
  { value: "sol-limoneux", label: "Sol limoneux" },
  { value: "sol-argileux", label: "Sol argileux" },
  { value: "sol-limono-sableux", label: "Sol limono-sableux / sablo-limoneux (loam)" },
  { value: "sol-argilo-limoneux", label: "Sol argilo-limoneux / limono-argileux" },
  { value: "sol-humifere-tourbeux", label: "Sol humifère / tourbeux" },
  { value: "sol-calcaire", label: "Sol calcaire" },
  { value: "sol-hydromorphe", label: "Sol hydromorphe" },
];

export const PRODUCER_SOIL_DETAILS: Record<string, string[]> = {
  "sol-sableux": [
    "Dominé par le sable",
    "Très drainant, se réchauffe vite",
    "Pauvre en nutriments, se dessèche facilement",
  ],
  "sol-limoneux": [
    "Dominé par le limon",
    "Très fertile, bonne rétention d'eau",
    "Sensible à la battance et au tassement",
  ],
  "sol-argileux": [
    "Dominé par l'argile",
    "Retient fortement l'eau et les nutriments",
    "Lourd, se travaille difficilement, se fissure à sec",
  ],
  "sol-limono-sableux": [
    "Mélange équilibré sable + limon (+ un peu d'argile)",
    "Très bon compromis agronomique pour de nombreuses cultures",
  ],
  "sol-argilo-limoneux": [
    "Intermédiaire entre argileux et limoneux",
    "Très intéressant agronomiquement si la structure est bonne (matière organique)",
  ],
  "sol-humifere-tourbeux": [
    "Très riche en matière organique",
    "Très noir, souvent acide",
    "Fort pouvoir de rétention d'eau",
  ],
  "sol-calcaire": [
    "Forte teneur en carbonate de calcium",
    "pH élevé, risque de chlorose (carences)",
    "Structure variable selon la part d'argile et de limon",
  ],
  "sol-hydromorphe": [
    "Soumis à l'excès d'eau (nappe proche, stagnation)",
    "Manque d'oxygène pour les racines",
    "Couleurs grisâtres ou tachetées fréquentes",
  ],
};
