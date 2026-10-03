export type MailingKind = "marketing" | "information";

export type MailingContact = {
  email: string;
  firstName: string;
  lastName: string;
  customer: boolean;
  subscribed: boolean;
  unsubscribed: boolean;
};

export type MailingDraftInput = {
  id: string;
  name: string;
  subject: string;
  body: string;
  kind: MailingKind;
  recipientEmails: string[];
};

export type MailingRecipientStatus = "pending" | "processing" | "sent" | "failed" | "skipped" | "uncertain";
export type MailingCounts = Record<MailingRecipientStatus | "total", number>;

export type MailingCampaign = MailingDraftInput & {
  status: "draft" | "sending" | "completed";
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  counts: MailingCounts;
};

export type MailingRecipient = {
  id: string;
  email: string;
  firstName: string;
  status: MailingRecipientStatus;
  error: string | null;
  sentAt: string | null;
};

export type MailingCampaignDetail = {
  campaign: MailingCampaign;
  recipients: MailingRecipient[];
};

export type MailingSettings = {
  configured: boolean;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  error: string | null;
};
