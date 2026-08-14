// Preset newspaper sources with sender data verified via live DNS (SPF/DMARC)
// and archived emails — see docs/NEWSPAPERS.md for the research and signup URLs.
export interface NewspaperPreset {
  name: string;
  dkimDomain: string;
  fromRegex: string;
  verified: boolean; // sender address verified vs inferred from the sending domain
  note: string;
}

export const NEWSPAPERS: NewspaperPreset[] = [
  {
    name: "The New York Times",
    dkimDomain: "nytimes.com",
    fromRegex: "^nytdirect@nytimes\\.com$",
    verified: true,
    note: "Breaking News Alerts from nytdirect@nytimes.com (verified sender; DMARC p=reject aligns DKIM to nytimes.com)",
  },
  {
    name: "The Washington Post",
    dkimDomain: "email.washingtonpost.com",
    fromRegex: "@email\\.washingtonpost\\.com$",
    verified: false,
    note: "Breaking News Alerts newsletter; sends via Amazon SES from email.washingtonpost.com (DNS-verified domain)",
  },
  {
    name: "Reuters",
    dkimDomain: "email.reuters.com",
    fromRegex: "@email\\.reuters\\.com$",
    verified: false,
    note: "Newsletters via Sailthru from email.reuters.com (DNS-verified domain)",
  },
  {
    name: "CNN",
    dkimDomain: "mail.cnn.com",
    fromRegex: "@mail\\.cnn\\.com$",
    verified: false,
    note: "CNN Breaking News alerts; sends via Zeta Global from mail.cnn.com (DNS-verified domain)",
  },
  {
    name: "Bloomberg",
    dkimDomain: "mail.bloomberg.com",
    fromRegex: "@mail\\.bloomberg\\.com$",
    verified: false,
    note: "Newsletters via Amazon SES from mail.bloomberg.com (DNS-verified domain)",
  },
  {
    name: "The Guardian",
    dkimDomain: "mail.theguardian.com",
    fromRegex: "@mail\\.theguardian\\.com$",
    verified: false,
    note: "Newsletters via Salesforce Marketing Cloud from mail.theguardian.com (DNS-verified domain)",
  },
  {
    name: "The Wall Street Journal",
    dkimDomain: "wsj.com",
    fromRegex: "@wsj\\.com$",
    verified: false,
    note: "Newsletters + alerts; Proofpoint infra, DMARC p=quarantine (weakest alignment guarantee of the set)",
  },
  {
    name: "Associated Press",
    dkimDomain: "apnews.com",
    fromRegex: "@apnews\\.com$",
    verified: false,
    note: "AP newsletters; Validity infra on apnews.com (DNS-verified domain)",
  },
];
