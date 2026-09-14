export const environment = {
  production: false,
  apiBase: 'http://localhost:3001',
  /* thirdweb in-app wallet (§2.83). A public identifier, not a secret: the
     thirdweb dashboard restricts which domains may use it. Empty hides the
     Google/Apple/email options and leaves only the injected-wallet button. */
  thirdwebClientId: ''
};
