export type AdminAnalyticsOverview = {
  pageViews7d: number;
  pageViews30d: number;
  tutorialEvents7d: number;
  tutorialEvents30d: number;
  topPages7d: Array<{ pathname: string; views: number }>;
  topPages30d: Array<{ pathname: string; views: number }>;
  eventsByName30d: Array<{ eventName: string; count: number }>;
  lastEventAt: string | null;
};
