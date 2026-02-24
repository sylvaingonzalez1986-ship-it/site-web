export type NewsletterSubscriberStatus = "active" | "unsubscribed";

export type NewsletterSubscriber = {
  id: string;
  email: string;
  status: NewsletterSubscriberStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
  lastContactedAt?: string;
};


