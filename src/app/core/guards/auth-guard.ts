import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../supabase/auth';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificamos si hay un usuario en el Signal O si la sesión de Supabase existe
  const session = await authService.getSession();

  if (session) {
    return true; 
  } else {
    router.navigate(['/auth']);
    return false;
  }
};