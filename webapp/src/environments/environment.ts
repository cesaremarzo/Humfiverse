export const environment = {
  production: false,
  apiBase: 'http://localhost:3001',
  /* thirdweb in-app wallet (§2.83). A public identifier, not a secret: the
     thirdweb dashboard restricts which domains may use it. Empty hides the
     Google/Apple/email options and leaves only the injected-wallet button. */
  thirdwebClientId: 'cc90cc706e96d2a80f1c5220f5359c12'
};
