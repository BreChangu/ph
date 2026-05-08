import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../supabase/auth';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    if (authService.getCachedAuthUser()) {
      return true;
    }

    const session = await authService.getSession();

    if (session?.user) {
      return true; // Usuario válido, lo dejamos pasar
    } else {
      router.navigate(['/auth']); // Intruso, a la pantalla de login
      return false;
    }
  } catch (error) {
    console.error('Error en AuthGuard:', error);
    router.navigate(['/auth']);
    return false;
  }
};
