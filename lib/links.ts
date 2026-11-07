export const GITHUB = 'https://github.com/penlock-io/bitcoin-vision';
export const PENLOCK = 'https://github.com/penlock-io';
/** The design's integration guide. A claude.ai artifact: visitors need access to open it. */
export const INTEGRATION_GUIDE = 'https://claude.ai/artifact/XKJLxvtks3YSvH5zqf71u5';
/** Where people ask for a shared training sample to be removed. */
export const removalRequest = (id: string) =>
  `https://github.com/Vayras/bitcoin-vision-site/issues/new?title=${encodeURIComponent(`Remove training sample ${id}`)}&body=${encodeURIComponent(`Please remove training sample ${id}.`)}`;
