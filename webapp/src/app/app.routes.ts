import { Routes } from '@angular/router';

// Route titles (§2.91) are English, like the default <title> in index.html:
// they are what search results and browser tabs show before a locale loads.
export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'Humfiverse — Music royalty tokens and milestone escrow on Ethereum', loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent) },
  { path: 'marketplace', title: 'Marketplace · Humfiverse', loadComponent: () => import('./features/marketplace/marketplace.component').then((m) => m.MarketplaceComponent) },
  { path: 'asset/:id', title: 'Listing · Humfiverse', loadComponent: () => import('./features/asset-detail/asset-detail.component').then((m) => m.AssetDetailComponent) },
  { path: 'portfolio', title: 'Portfolio · Humfiverse', loadComponent: () => import('./features/portfolio/portfolio.component').then((m) => m.PortfolioComponent) },
  { path: 'redeem', redirectTo: 'portfolio' },
  { path: 'kyc', title: 'Verification · Humfiverse', loadComponent: () => import('./features/kyc/kyc.component').then((m) => m.KycComponent) },
  { path: 'kyc/:returnAssetId', title: 'Verification · Humfiverse', loadComponent: () => import('./features/kyc/kyc.component').then((m) => m.KycComponent) },
  { path: 'for-artists', title: 'For artists · Humfiverse', loadComponent: () => import('./features/for-artists/for-artists.component').then((m) => m.ForArtistsComponent) },
  { path: 'artist/onboarding', title: 'New campaign · Humfiverse', loadComponent: () => import('./features/onboarding/onboarding.component').then((m) => m.OnboardingComponent) },
  { path: 'artist/dashboard', title: 'My campaigns · Humfiverse', loadComponent: () => import('./features/artist-dashboard/artist-dashboard.component').then((m) => m.ArtistDashboardComponent) },
  { path: 'artist/milestones', title: 'Milestones · Humfiverse', loadComponent: () => import('./features/artist-milestones/artist-milestones.component').then((m) => m.ArtistMilestonesComponent) },
  { path: 'studio', title: 'For studios · Humfiverse', loadComponent: () => import('./features/studio/studio.component').then((m) => m.StudioComponent) },
  // Internal operator tool (§2.15) — deliberately not linked from nav.
  { path: 'admin/escrow', title: 'Escrow admin · Humfiverse', loadComponent: () => import('./features/admin-escrow/admin-escrow.component').then((m) => m.AdminEscrowComponent) },
  { path: '**', redirectTo: 'marketplace' }
];
