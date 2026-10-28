import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../supabase/auth';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Verificar que exista una sesión activa en Supabase.
  const session = await authService.getSession();

  if (!session?.user) {
    await router.navigate(['/auth']);
    return false;
  }

  const user = session.user;
  const email = user.email;

  // 2. Obtener el perfil del usuario autenticado.
  const perfil = await authService.getUserProfileForAuth(
    user.id,
    email
  );

  if (!perfil) {
    await authService.signOut();

    await router.navigate(['/auth'], {
      queryParams: { error: 'perfil_no_encontrado' }
    });

    return false;
  }

  // 3. Los administradores conservan su acceso habitual.
  if (perfil.rol === 'admin') {
    if (state.url.split('?')[0] === '/admin-panel') {
      return true;
    }

    return true;
  }

  const rutaActual = state.url.split('?')[0];

  // 4. Permitir que un paciente pendiente complete la entrevista
  // únicamente si todavía no tiene un expediente.
  if (perfil.estado_aprobacion === 'pendiente') {
    if (rutaActual === '/onboarding') {
      const expediente = await authService.getExpedienteClinico(
        perfil.id
      );

      if (!expediente) {
        return true;
      }
    }

    // Si ya envió su entrevista, o intenta acceder a otra ruta,
    // conservar el bloqueo de la cuenta pendiente.
    await authService.signOut();

    await router.navigate(['/auth'], {
      queryParams: { pendiente: '1' }
    });

    return false;
  }

  // 5. Los usuarios suspendidos o con estados no reconocidos
  // no pueden acceder a las rutas privadas.
  if (perfil.estado_aprobacion !== 'aprobado') {
    await authService.signOut();

    await router.navigate(['/auth'], {
      queryParams: { pendiente: 'suspendido' }
    });

    return false;
  }

  // 6. Un paciente aprobado no puede entrar al panel de administración.
  if (rutaActual === '/admin-panel') {
    await router.navigate(['/panel']);
    return false;
  }

  // 7. Paciente aprobado: conservar el acceso habitual.
  return true;
};


