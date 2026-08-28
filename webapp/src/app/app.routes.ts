import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'marketplace' },
  { path: 'marketplace', loadComponent: () => import('./features/marketplace/marketplace.component').then((m) => m.MarketplaceComponent) },
  { path: 'asset/:id', loadComponent: () => import('./features/asset-detail/asset-detail.component').then((m) => m.AssetDetailComponent) },
  { path: 'portfolio', loadComponent: () => import('./features/portfolio/portfolio.component').then((m) => m.PortfolioComponent) },
  { path: 'redeem', loadComponent: () => import('./features/redeem/redeem.component').then((m) => m.RedeemComponent) },
  { path: 'kyc', loadComponent: () => import('./features/kyc/kyc.component').then((m) => m.KycComponent) },
  { path: 'kyc/:returnAssetId', loadComponent: () => import('./features/kyc/kyc.component').then((m) => m.KycComponent) },
  { path: 'for-artists', loadComponent: () => import('./features/for-artists/for-artists.component').then((m) => m.ForArtistsComponent) },
  { path: 'artist/onboarding', loadComponent: () => import('./features/onboarding/onboarding.component').then((m) => m.OnboardingComponent) },
  { path: 'artist/dashboard', loadComponent: () => import('./features/artist-dashboard/artist-dashboard.component').then((m) => m.ArtistDashboardComponent) },
  { path: '**', redirectTo: 'marketplace' }
];
