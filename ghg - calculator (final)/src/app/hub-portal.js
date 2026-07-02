export const HUB_PORTAL_URL = (
  import.meta.env.VITE_HUB_PORTAL_URL || 'https://sustainability-hub-portal-eight.vercel.app/'
).trim();

export function landingHubPortalLink() {
  return `<a class="landing-hub-link" href="${HUB_PORTAL_URL}">← Back to Sustainability Hub Portal</a>`;
}

export function headerHubPortalLink() {
  return `<a class="header-hub-link" href="${HUB_PORTAL_URL}">← Hub Portal</a>`;
}
