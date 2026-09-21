const CAMPAIGN_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

export const buildAgencyPlansUrl = (search = "") => {
  const incoming = new URLSearchParams(search);
  const outgoing = new URLSearchParams({ origen: "software-para-inmobiliarias" });
  for (const key of CAMPAIGN_KEYS) {
    const value = incoming.get(key)?.trim();
    if (value) outgoing.set(key, value);
  }
  return `/planes?${outgoing.toString()}`;
};
