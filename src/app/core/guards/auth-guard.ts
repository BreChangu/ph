import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../supabase/auth';
export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Le preguntamos a Supabase: ¿Hay un usuario legítimo aquí?
  const user = await authService.getCurrentUser();

  if (user) {
    // Si hay usuario, la puerta se abre
    return true; 
  } else {
    // Si es un intruso, lo rebotamos al login
    router.navigate(['/auth']);
    return false;
  }
};