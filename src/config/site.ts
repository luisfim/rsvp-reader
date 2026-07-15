const DEFAULT_LEGAL_EFFECTIVE_DATE = "July 15, 2026";

function readEnvironmentValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const configuredOperatorName = readEnvironmentValue(
  import.meta.env.VITE_OPERATOR_NAME,
);
const configuredSupportEmail = readEnvironmentValue(
  import.meta.env.VITE_SUPPORT_EMAIL,
);
const configuredEffectiveDate = readEnvironmentValue(
  import.meta.env.VITE_LEGAL_EFFECTIVE_DATE,
);

export const siteConfig = {
  name: "RSVP Reader",
  operatorName:
    configuredOperatorName || "the RSVP Reader operator",
  supportEmail: isValidEmail(configuredSupportEmail)
    ? configuredSupportEmail
    : "",
  legalEffectiveDate:
    configuredEffectiveDate || DEFAULT_LEGAL_EFFECTIVE_DATE,
  hasConfiguredOperatorName: Boolean(configuredOperatorName),
  hasConfiguredSupportEmail: isValidEmail(configuredSupportEmail),
};

export function getSupportMailto(subject = "RSVP Reader support"): string {
  if (!siteConfig.supportEmail) {
    return "";
  }

  return `mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent(subject)}`;
}
