// Shared vocabulary for classifying OAuth app setup friction.
// Used by the UI, the curated library, and the live investigator's prompts,
// so every guide speaks the same language. See docs/research.md for the evidence behind it.

export const ARCHETYPES = [
  "instant_self_serve",
  "self_serve_review_to_scale",
  "scope_verification",
  "tenant_scoped",
  "partner_gated",
  "no_public_oauth",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const ARCHETYPE_INFO: Record<
  Archetype,
  { label: string; short: string; description: string; examples: string }
> = {
  instant_self_serve: {
    label: "Instant self-serve",
    short: "Register and ship",
    description:
      "Anyone with an account can register an app and get credentials immediately. No provider review stands between you and production users.",
    examples: "GitHub OAuth Apps",
  },
  self_serve_review_to_scale: {
    label: "Self-serve, review to scale",
    short: "Works now, review to go public",
    description:
      "Credentials are instant and work for your own account or workspace. Distributing to other customers, or listing in a marketplace, adds settings, policy URLs, or an optional/required review.",
    examples: "Slack apps, Notion public integrations",
  },
  scope_verification: {
    label: "Scope-based verification",
    short: "The scopes you ask for decide the review",
    description:
      "Setup is self-serve, but the sensitivity of the scopes you request triggers verification: brand review, demo videos, and for the most sensitive data, an independent security assessment. Unverified apps are capped or show warnings.",
    examples: "Google (Gmail, Drive), Microsoft publisher verification",
  },
  tenant_scoped: {
    label: "Tenant-scoped",
    short: "Every customer's instance is its own world",
    description:
      "The OAuth client lives inside, or must be installed/approved in, each customer's org, store, or subdomain. Endpoints or credentials can differ per customer, and a customer admin is usually involved.",
    examples: "Salesforce, Shopify, ServiceNow, Zendesk",
  },
  partner_gated: {
    label: "Partner / program gated",
    short: "You must apply and be accepted",
    description:
      "Basic sign-in may be self-serve, but the useful API permissions require applying to a program. Approval is discretionary and timelines are not published.",
    examples: "LinkedIn Marketing / Community Management APIs, Meta advanced access",
  },
  no_public_oauth: {
    label: "No public OAuth",
    short: "OAuth isn't offered to third parties",
    description:
      "The provider offers API keys, personal tokens, or nothing for third-party developers. Users would have to paste a key, or the integration is not possible.",
    examples: "Many smaller SaaS tools",
  },
};

export const FLAGS = [
  "paid_plan_required",
  "business_verification",
  "domain_verification",
  "policy_urls_required",
  "manual_app_review",
  "demo_video",
  "security_assessment",
  "user_cap_until_approved",
  "partner_application",
  "customer_admin_consent",
  "per_customer_setup",
  "redirect_uri_restrictions",
  "token_lifecycle_gotchas",
  "marketplace_listing_optional",
] as const;
export type Flag = (typeof FLAGS)[number];

export const FLAG_INFO: Record<Flag, { label: string; hint: string }> = {
  paid_plan_required: {
    label: "Paid plan required",
    hint: "API or app registration needs a paid tier, credits, or edition.",
  },
  business_verification: {
    label: "Business verification",
    hint: "Provider verifies a legal entity, business documents, or a company page.",
  },
  domain_verification: {
    label: "Domain verification",
    hint: "You must prove you own the domain behind your homepage or redirect URIs.",
  },
  policy_urls_required: {
    label: "Policy URLs required",
    hint: "Public privacy policy, terms of service, or support URL on your domain.",
  },
  manual_app_review: {
    label: "Manual app review",
    hint: "A human at the provider reviews the app before it can be distributed.",
  },
  demo_video: {
    label: "Demo video",
    hint: "A screencast showing the OAuth flow and how each scope is used.",
  },
  security_assessment: {
    label: "Security assessment",
    hint: "Independent security assessment (e.g. CASA), often paid and recurring.",
  },
  user_cap_until_approved: {
    label: "User cap until approved",
    hint: "Only a limited number of users/workspaces can connect before approval.",
  },
  partner_application: {
    label: "Partner application",
    hint: "You apply for access to an API product; approval is discretionary.",
  },
  customer_admin_consent: {
    label: "Customer admin consent",
    hint: "Your customer's admin must approve or install the app before users can connect.",
  },
  per_customer_setup: {
    label: "Per-customer setup",
    hint: "Each customer org/store/subdomain needs its own client, install, or endpoint.",
  },
  redirect_uri_restrictions: {
    label: "Redirect URI rules",
    hint: "HTTPS-only, exact-match, no localhost, or limited number of redirect URIs.",
  },
  token_lifecycle_gotchas: {
    label: "Token lifecycle gotchas",
    hint: "Expiring/rotating refresh tokens, no refresh tokens, or revocation surprises.",
  },
  marketplace_listing_optional: {
    label: "Marketplace listing optional",
    hint: "A directory/marketplace listing exists but isn't needed to connect users.",
  },
};

export const EVIDENCE_STATUSES = ["tested", "source", "community", "uncertain"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const EVIDENCE_INFO: Record<EvidenceStatus, { label: string; hint: string }> = {
  tested: {
    label: "Tested",
    hint: "Observed directly by our agent (live endpoint probe, discovery document, URL check).",
  },
  source: {
    label: "Source-backed",
    hint: "Stated in official provider documentation we cite, but not observed by us.",
  },
  community: {
    label: "Community-reported",
    hint: "Reported by developers (forums, issues, blogs); not confirmed by official docs.",
  },
  uncertain: {
    label: "Uncertain",
    hint: "Could not be confirmed — ambiguous, paywalled, or only knowable after applying.",
  },
};

export const STEP_PHASES = [
  "prepare",
  "register",
  "configure",
  "test",
  "review",
  "launch",
  "customer",
] as const;
export type StepPhase = (typeof STEP_PHASES)[number];

export const PHASE_INFO: Record<StepPhase, string> = {
  prepare: "Prepare",
  register: "Register the app",
  configure: "Configure OAuth",
  test: "Test with your account",
  review: "Review & verification",
  launch: "Launch to customers",
  customer: "Customer-side setup",
};

export const OWNERS = ["agent", "human", "shared"] as const;
export type Owner = (typeof OWNERS)[number];

export const HUMAN_REASONS = [
  "account_login",
  "legal_or_billing",
  "business_decision",
  "provider_review",
  "customer_admin",
  "domain_or_dns",
  "recording",
] as const;
export type HumanReason = (typeof HUMAN_REASONS)[number];

export const HUMAN_REASON_INFO: Record<HumanReason, string> = {
  account_login: "Needs your logged-in console session (2FA/CAPTCHA)",
  legal_or_billing: "Legal attestation, payment, or contract",
  business_decision: "A product/business judgement only you can make",
  provider_review: "Waiting on the provider's reviewers",
  customer_admin: "Your customer's admin must act",
  domain_or_dns: "DNS or domain ownership change",
  recording: "Record a demo video",
};

export const SCOPE_TIERS = ["basic", "sensitive", "restricted", "admin", "unknown"] as const;
export type ScopeTier = (typeof SCOPE_TIERS)[number];
