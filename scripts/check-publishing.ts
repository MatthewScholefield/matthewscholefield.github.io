import { site } from '../content/site.js'

if (!site.googlePlayDeveloperUrl) {
  throw new Error('Publication blocked: verify the Recursive Corruption public Google Play developer page, then set googlePlayDeveloperUrl in content/site.ts. Local build and preview remain available.')
}
const url = new URL(site.googlePlayDeveloperUrl)
if (url.protocol !== 'https:' || url.hostname !== 'play.google.com' || !['/store/apps/dev', '/store/apps/developer'].includes(url.pathname) || !url.searchParams.get('id')) {
  throw new Error('googlePlayDeveloperUrl must be the verified public Google Play developer-account URL, not an app listing or search result.')
}
console.log('Publishing identity is configured. Public account verification is maintained in content/site.ts.')
