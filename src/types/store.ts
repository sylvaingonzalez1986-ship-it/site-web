import type { Product, VatRate } from "@/data/products";

export type OrderStatus =
  | "new"
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "cancelled";

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "new",
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "cancelled",
];

export type OrderItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  vatRate: VatRate;
  unitPriceHt: number;
  lineTotalHt: number;
  lineVatAmount: number;
  bonusPoints?: number;
  parentPackId?: string;
  parentPackName?: string;
};

export type OrderVatBreakdown = {
  rate: VatRate;
  baseHt: number;
  vatAmount: number;
};

export type CmsOrder = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  paymentProvider: "viva";
  paymentState: "pending" | "paid" | "failed" | "not_configured";
  vivaOrderCode?: number;
  vivaTransactionId?: string;
  source: "web";
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  shippingPhone?: string;
  deliveryMethod?: "home" | "relay";
  deliveryFee?: number;
  relayId?: string;
  relayName?: string;
  relayAddress?: string;
  relayPostalCode?: string;
  relayCity?: string;
  relayCountry?: string;
  promoCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  itemsCount: number;
  totalHt: number;
  totalVat: number;
  vatBreakdown: OrderVatBreakdown[];
  totalAmount: number;
  items: OrderItem[];
};

export const BLOG_CATEGORY_OPTIONS = [
  "guide",
  "actualite",
  "bien-etre",
  "legislation",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORY_OPTIONS)[number];

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: BlogCategory;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export const PRODUCER_CULTURE_TYPES = [
  "indoor",
  "greenhouse",
  "outdoor",
] as const;

export type ProducerCultureType = (typeof PRODUCER_CULTURE_TYPES)[number];

export const PRODUCER_CULTURE_LABELS: Record<ProducerCultureType, string> = {
  indoor: "Indoor",
  greenhouse: "Greenhouse",
  outdoor: "Outdoor",
};

export type Producer = {
  id: string;
  name: string;
  description: string;
  image: string;
  location: string;
  department: string;
  region: string;
  website: string;
  socialLinks: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
  cultureType: ProducerCultureType[];
  climate: string;
  soil: string;
  altitude: string;
  certifications: string[];
  speciality: string;
  philosophy: string;
  experience: string;
  founded: string;
};

export const SECTION_STYLE_OPTIONS = ["mint", "yellow", "cream"] as const;
export type SectionStyle = (typeof SECTION_STYLE_OPTIONS)[number];

export const HOME_NATIVE_SECTION_TYPES = [
  "hero",
  "legal",
  "products",
  "app",
  "story",
  "contact",
] as const;
export type HomeNativeSectionType = (typeof HOME_NATIVE_SECTION_TYPES)[number];
export type HomeSectionType = HomeNativeSectionType | "custom";

export const BOUTIQUE_NATIVE_SECTION_TYPES = [
  "header",
  "products",
  "copains",
] as const;
export type BoutiqueNativeSectionType = (typeof BOUTIQUE_NATIVE_SECTION_TYPES)[number];
export type BoutiqueSectionType = BoutiqueNativeSectionType | "custom";

export const APPLICATION_NATIVE_SECTION_TYPES = [
  "hero",
  "features",
  "newsletter",
] as const;
export type ApplicationNativeSectionType = (typeof APPLICATION_NATIVE_SECTION_TYPES)[number];
export type ApplicationSectionType = ApplicationNativeSectionType | "custom";

export const BLOG_PAGE_NATIVE_SECTION_TYPES = ["header", "posts"] as const;
export type BlogPageNativeSectionType = (typeof BLOG_PAGE_NATIVE_SECTION_TYPES)[number];
export type BlogPageSectionType = BlogPageNativeSectionType | "custom";

export type CustomSectionContent = {
  title: string;
  body: string;
  style: SectionStyle;
};

type NativeSection<T extends string> = {
  id: string;
  type: T;
  visible: boolean;
  custom?: undefined;
};

type CustomSection = {
  id: string;
  type: "custom";
  visible: boolean;
  custom: CustomSectionContent;
};

export type HomeSection = NativeSection<HomeNativeSectionType> | CustomSection;
export type BoutiqueSection = NativeSection<BoutiqueNativeSectionType> | CustomSection;
export type ApplicationSection = NativeSection<ApplicationNativeSectionType> | CustomSection;
export type BlogPageSection = NativeSection<BlogPageNativeSectionType> | CustomSection;

export type PageSections = {
  home: HomeSection[];
  boutique: BoutiqueSection[];
  application: ApplicationSection[];
  blog: BlogPageSection[];
};

export type SectionPageKey = keyof PageSections;

export type SiteContent = {
  home: {
    heroEyebrow: string;
    heroLine1: string;
    heroLine2: string;
    heroLine3: string;
    heroDescription: string;
    heroPrimaryCtaLabel: string;
    heroSecondaryCtaLabel: string;
    seasonGalleryTitle: string;
    seasonGalleryDescription: string;
    seasonGalleryImages: string[];
    legalLine1: string;
    legalLine2: string;
    legalDescription: string;
    legalPillThc: string;
    legalPillLab: string;
    legalPillDelivery: string;
    productsTitleLine1: string;
    productsTitleLine2: string;
    productsPricePrefix: string;
    productsAddButtonLabel: string;
    productsCtaLabel: string;
    appTitleLine1: string;
    appTitleLine2: string;
    appTitleLine3: string;
    appDescription: string;
    appStoreLabel: string;
    playStoreLabel: string;
    appProducerTitle: string;
    appProducerDescription: string;
    storyTitle: string;
    storyDescription: string;
    contactTitle: string;
    contactDescription: string;
    contactNamePlaceholder: string;
    contactEmailPlaceholder: string;
    contactSubmitLabel: string;
  };
  boutique: {
    eyebrow: string;
    title: string;
    description: string;
    emptyMessage: string;
    addButtonLabel: string;
    copainsSectionTitle: string;
    copainsSectionDescription: string;
    producerPartnerLabel: string;
    producerWebsiteLabel: string;
  };
  application: {
    eyebrow: string;
    title: string;
    description: string;
    heroPrimaryButtonLabel: string;
    heroSecondaryButtonLabel: string;
    feature1Title: string;
    feature1Description: string;
    feature2Title: string;
    feature2Description: string;
    feature3Title: string;
    feature3Description: string;
    feature4Title: string;
    feature4Description: string;
    newsletterTitle: string;
    newsletterDescription: string;
    newsletterEmailPlaceholder: string;
    newsletterSubmitLabel: string;
  };
  blog: {
    eyebrow: string;
    title: string;
    description: string;
    postsEmptyMessage: string;
    postsReadMoreLabel: string;
    breadcrumbHomeLabel: string;
    breadcrumbBlogLabel: string;
    postPublishedPrefix: string;
    postBackLabel: string;
  };
  logistics: {
    mondialRelay: {
      collectionType: "R" | "D";
      collectionRelayId: string;
      collectionCountry: string;
    };
  };
  profile: {
    badgeBenefitsModalTitle: string;
    badgeBenefitsModalHint: string;
    badgeBenefitsCloseLabel: string;
    decouverteDiscountPercent: number;
    explorateurDiscountPercent: number;
    connaisseurDiscountPercent: number;
    ambassadeurDiscountPercent: number;
    legendeDiscountPercent: number;
    decouverteBenefits: string;
    explorateurBenefits: string;
    connaisseurBenefits: string;
    ambassadeurBenefits: string;
    legendeBenefits: string;
  };
  footer: {
    copyright: string;
    legalLabel: string;
    privacyLabel: string;
  };
};

export type CmsStore = {
  content: SiteContent;
  sections: PageSections;
  products: Product[];
  blog: BlogPost[];
  producers: Producer[];
  orders: CmsOrder[];
  updatedAt: string;
};

export type PublicStoreResponse = {
  content: SiteContent;
  sections: PageSections;
  products: Product[];
  blog: BlogPost[];
  producers: Producer[];
  updatedAt: string;
};
