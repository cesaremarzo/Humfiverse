import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent) },
  { path: 'marketplace', loadComponent: () => import('./features/marketplace/marketplace.component').then((m) => m.MarketplaceComponent) },
  { path: 'asset/:id', loadComponent: () => import('./features/asset-detail/asset-detail.component').then((m) => m.AssetDetailComponent) },
  { path: 'portfolio', loadComponent: () => import('./features/portfolio/portfolio.component').then((m) => m.PortfolioComponent) },
  { path: 'redeem', redirectTo: 'portfolio' },
  { path: 'kyc', loadComponent: () => import('./features/kyc/kyc.component').then((m) => m.KycComponent) },
  { path: 'kyc/:returnAssetId', loadComponent: () => import('./features/kyc/kyc.component').then((m) => m.KycComponent) },
  { path: 'for-artists', loadComponent: () => import('./features/for-artists/for-artists.component').then((m) => m.ForArtistsComponent) },
  { path: 'artist/onboarding', loadComponent: () => import('./features/onboarding/onboarding.component').then((m) => m.OnboardingComponent) },
  { path: 'artist/dashboard', loadComponent: () => import('./features/artist-dashboard/artist-dashboard.component').then((m) => m.ArtistDashboardComponent) },
  // Internal operator tool (§2.15) — deliberately not linked from nav.
  { path: 'admin/escrow', loadComponent: () => import('./features/admin-escrow/admin-escrow.component').then((m) => m.AdminEscrowComponent) },
  { path: '**', redirectTo: 'marketplace' }
];
