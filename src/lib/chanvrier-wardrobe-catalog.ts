export const CHANVRIER_WARDROBE_OPTIONS = {
  top: [
    { code: "overalls", name: "Salopette" },
    { code: "tee", name: "T-shirt" },
    { code: "hoodie", name: "Sweat à capuche" },
    { code: "jacket", name: "Veste de travail" },
    { code: "shirt", name: "Chemise" },
    { code: "apron", name: "Tablier" },
    { code: "mariniere", name: "Marinière" },
    { code: "vareuse", name: "Vareuse" },
    { code: "fisher-knit", name: "Pull de pêche" },
    { code: "embroidered-vest", name: "Gilet brodé" },
    { code: "sailor-blouse", name: "Blouse à col marin" },
    { code: "linen-shirt", name: "Chemise de lin" },
  ],
  bottom: [
    { code: "jeans", name: "Jean" },
    { code: "cargo", name: "Cargo" },
    { code: "shorts", name: "Short" },
    { code: "skirt", name: "Jupe" },
    { code: "sailor-trousers", name: "Pantalon à pont" },
    { code: "bragou-braz", name: "Bragou braz" },
    { code: "pleated-skirt", name: "Jupe plissée" },
    { code: "work-trousers", name: "Pantalon de travail" },
  ],
  shoes: [
    { code: "boots", name: "Bottes" },
    { code: "sneakers", name: "Baskets" },
    { code: "high-tops", name: "Montantes" },
    { code: "work", name: "Chaussures de travail" },
    { code: "clogs", name: "Sabots" },
    { code: "deck-shoes", name: "Chaussures de pont" },
  ],
  headwear: [
    { code: "none", name: "Tête nue" },
    { code: "watch-cap", name: "Bonnet de quart" },
    { code: "sailor-cap", name: "Casquette de marin" },
    { code: "bachi", name: "Bâchi à pompon" },
    { code: "souwester", name: "Chapeau de pluie" },
    { code: "round-hat", name: "Chapeau rond à guides" },
    { code: "bigouden-coif", name: "Coiffe haute bigoudène" },
    { code: "lace-coif", name: "Coiffe de dentelle" },
    { code: "headscarf", name: "Fichu" },
  ],
  jacket: [
    { code: "none", name: "Sans veste" },
    { code: "pea-coat", name: "Caban" },
    { code: "raincoat", name: "Ciré" },
    { code: "chupenn", name: "Chupenn brodé" },
    { code: "kabig", name: "Kabig" },
    { code: "wool-vest", name: "Gilet de laine" },
  ],
  accessory: [
    { code: "none", name: "Aucun" },
    { code: "glasses", name: "Lunettes" },
    { code: "round-glasses", name: "Lunettes rondes" },
    { code: "earrings", name: "Boucles d’oreilles" },
    { code: "scarf", name: "Foulard" },
    { code: "neckerchief", name: "Foulard de marin" },
    { code: "sash", name: "Ceinture de tissu" },
    { code: "brooch", name: "Broche de cuivre" },
    { code: "satchel", name: "Besace" },
  ],
} as const;

export const CHANVRIER_BRETON_OUTFITS = [
  {
    code: "quart-au-port", name: "Quart au port", family: "Maritime", clothing: "blue",
    appearance: {
      top: "mariniere", bottom: "sailor-trousers", shoes: "deck-shoes",
      headwear: "sailor-cap", jacket: "none", accessory: "neckerchief",
      dyes: { top: "#f3dfb5", bottom: "#244656", shoes: "#855544", headwear: "#244656", accent: "#a84237" },
    },
  },
  {
    code: "retour-de-peche", name: "Retour de pêche", family: "Maritime", clothing: "teal",
    appearance: {
      top: "fisher-knit", bottom: "work-trousers", shoes: "boots",
      headwear: "watch-cap", jacket: "wool-vest", accessory: "none",
      dyes: { top: "#d6ba87", bottom: "#344d47", shoes: "#61483c", headwear: "#9c513d", jacket: "#4f756a" },
    },
  },
  {
    code: "grain-au-large", name: "Grain au large", family: "Maritime", clothing: "ochre",
    appearance: {
      top: "vareuse", bottom: "work-trousers", shoes: "boots",
      headwear: "souwester", jacket: "raincoat", accessory: "none",
      dyes: { top: "#1d6974", bottom: "#3b574f", shoes: "#36473d", headwear: "#d79b38", jacket: "#d79b38" },
    },
  },
  {
    code: "dimanche-glazik", name: "Dimanche glazik", family: "Tradition", clothing: "blue",
    appearance: {
      top: "embroidered-vest", bottom: "bragou-braz", shoes: "clogs",
      headwear: "round-hat", jacket: "chupenn", accessory: "sash",
      dyes: { top: "#2d607d", bottom: "#d7c39d", shoes: "#96613a", headwear: "#2f303b", jacket: "#31537e", accent: "#c99a4b" },
    },
  },
  {
    code: "fete-en-pays-bigouden", name: "Fête en pays bigouden", family: "Tradition", clothing: "berry",
    appearance: {
      top: "embroidered-vest", bottom: "pleated-skirt", shoes: "work",
      headwear: "bigouden-coif", jacket: "none", accessory: "brooch",
      dyes: { top: "#493c52", bottom: "#383342", shoes: "#443736", headwear: "#f9ebd2", accent: "#d98050" },
    },
  },
  {
    code: "matin-au-marche", name: "Matin au marché", family: "Tradition", clothing: "sage",
    appearance: {
      top: "apron", bottom: "skirt", shoes: "clogs",
      headwear: "lace-coif", jacket: "none", accessory: "none",
      dyes: { top: "#5f735a", bottom: "#6b4b56", shoes: "#a87243", headwear: "#f4e8cf", accent: "#c5a778" },
    },
  },
] as const;

export const CHANVRIER_FEATURED_OUTFITS = ["quart-au-port", "grain-au-large", "fete-en-pays-bigouden", "matin-au-marche"] as const;
