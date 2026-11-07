export const GITHUB = 'https://github.com/penlock-io/bitcoin-vision';
export const PENLOCK = 'https://github.com/penlock-io';
/** The integration guide page (app/docs, content/integration-guide.md). Use with next/link. */
export const INTEGRATION_GUIDE = '/docs/';
/** Where people ask for a shared training sample to be removed. */
export const removalRequest = (id: string) =>
  `https://github.com/Vayras/bitcoin-vision-site/issues/new?title=${encodeURIComponent(`Remove training sample ${id}`)}&body=${encodeURIComponent(`Please remove training sample ${id}.`)}`;
