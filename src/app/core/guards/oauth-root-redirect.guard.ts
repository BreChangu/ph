import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';

export const oauthRootRedirectGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const params = new URLSearchParams(window.location.search);
  const isOAuthReturn = params.has('code') || params.has('error') || window.location.hash.includes('access_token=');

  if (!isOAuthReturn) {
    return true;
  }

  return router.createUrlTree(['/auth/callback'], {
    queryParams: Object.fromEntries(params.entries()),
    fragment: window.location.hash ? window.location.hash.slice(1) : undefined,
  });
};
