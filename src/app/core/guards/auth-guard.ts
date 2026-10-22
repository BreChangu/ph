import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../supabase/auth';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Verificamos si hay una sesión activa en Supabase
  const session = await authService.getSession();
  if (!session?.user) {
    router.navigate(['/auth']);
    return false;
  }

  const user = session.user;
  const email = user.email;

  // 2. Buscamos el perfil para ver su estado real en la base de datos
  const perfil = await authService.getUserProfileForAuth(user.id, email);

  if (!perfil) {
    await authService.signOut();
    router.navigate(['/auth'], { queryParams: { error: 'perfil_no_encontrado' } });
    return false;
  }

  // 3. 🔴 BLOQUEO PRINCIPAL: Si está pendiente, cerramos sesión y lo mandamos al login con un aviso
  if (perfil.estado_aprobacion !== 'aprobado' && perfil.rol !== 'admin') {
    await authService.signOut();
    router.navigate(['/auth'], {
      queryParams: { pendiente: perfil.estado_aprobacion === 'pendiente' ? '1' : 'suspendido' },
    });
    return false;
  }

  // 4. Protección extra para el panel de administrador
  const url = state.url;
  if (url.includes('/admin-panel') && perfil.rol !== 'admin') {
    router.navigate(['/panel']);
    return false;
  }

  return true;
};
