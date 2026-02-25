import type { SectionStyle } from "@/types/store";

export const CMS_PAGE_STATUS_VALUES = ["draft", "published", "archived"] as const;
export type CmsPageStatus = (typeof CMS_PAGE_STATUS_VALUES)[number];

export type CmsPageSection = {
  id: string;
  title: string;
  body: string;
  style: SectionStyle;
};

export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: CmsPageStatus;
  sections: CmsPageSection[];
  seoTitle?: string;
  seoDescription?: string;
  showInNav: boolean;
  showInFooter: boolean;
  navLabel: string;
  footerLabel: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type CmsPageCreateInput = {
  slug: string;
  title: string;
  description?: string;
  status?: CmsPageStatus;
  sections?: CmsPageSection[];
  seoTitle?: string;
  seoDescription?: string;
  showInNav?: boolean;
  showInFooter?: boolean;
  navLabel?: string;
  footerLabel?: string;
  position?: number;
};

export type CmsPageUpdateInput = Partial<CmsPageCreateInput>;
