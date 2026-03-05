export type AdminAnalyticsOverview = {
  pageViews7d: number;
  pageViews30d: number;
  tutorialEvents7d: number;
  tutorialEvents30d: number;
  topPages7d: Array<{ pathname: string; views: number }>;
  topPages30d: Array<{ pathname: string; views: number }>;
  eventsByName30d: Array<{ eventName: string; count: number }>;
  topLocations30d: Array<{ countryCode: string; regionCode: string; city: string; count: number }>;
  latestConnection: {
    countryCode: string;
    regionCode: string;
    city: string;
    createdAt: string;
  } | null;
  lastEventAt: string | null;
};
