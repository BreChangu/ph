import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { AuthService } from '../supabase/auth';

export const oauthRootRedirectGuard: CanActivateFn = async () => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const authService = inject(AuthService);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const params = new URLSearchParams(window.location.search);
  const isOAuthReturn = params.has('code') || params.has('error') || window.location.hash.includes('access_token=');

  if (isOAuthReturn) {
    return router.createUrlTree(['/auth/callback'], {
      queryParams: Object.fromEntries(params.entries()),
      fragment: window.location.hash ? window.location.hash.slice(1) : undefined,
    });
  }

  // A confirmed email or persisted session can arrive on the public home page.
  // Resolve its private destination immediately instead of waiting for /auth.
  const session = await authService.getSession();
  if (!session?.user) return true;

  const destination = await authService.getAuthenticatedDestination(
    session.user.id,
    session.user.email,
  );

  return router.createUrlTree(destination.commands, {
    queryParams: destination.queryParams,
  });
};
