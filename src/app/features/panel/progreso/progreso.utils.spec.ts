import { describe, expect, it } from 'vitest';
import {
  claveEjercicio,
  cumplimientoPorSemana,
  leerPeso,
  resumenCarga,
  unidadAKg,
  diferenciaDias,
  etiquetaCorta,
  etiquetaRango,
  formatoCambio,
  formatoPeso,
  hoyISO,
  inicioSemanaISO,
  notasDeSemana,
  pesoMaximoPorEjercicio,
  progresionSemana,
  semanasRecientes,
  sesionesPorSemana,
  subioDePeso,
  sumarDias,
  type FilaCarga,
  type FilaCumplimiento,
} from './progreso.utils';

describe('fechas (hora de Ciudad de México, semana lunes-domingo)', () => {
  it('hoyISO usa la hora de México y no la de UTC', () => {
    // 21:30 del 27 de octubre en México = 03:30 UTC del día 28
    expect(hoyISO(new Date('2026-10-28T03:30:00Z'))).toBe('2026-10-27');
    // justo a las 18:00 locales ya es "mañana" en UTC; en México sigue siendo hoy
    expect(hoyISO(new Date('2026-10-28T00:00:00Z'))).toBe('2026-10-27');
    expect(hoyISO(new Date('2026-10-27T18:00:00Z'))).toBe('2026-10-27');
  });

  it('inicioSemanaISO devuelve siempre el lunes', () => {
    expect(inicioSemanaISO('2026-10-26')).toBe('2026-10-26'); // lunes
    expect(inicioSemanaISO('2026-10-27')).toBe('2026-10-26'); // martes
    expect(inicioSemanaISO('2026-11-01')).toBe('2026-10-26'); // domingo
    expect(inicioSemanaISO('2026-11-02')).toBe('2026-11-02'); // lunes siguiente
  });

  it('sumarDias cruza meses, años y bisiestos', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(diferenciaDias('2026-10-26', '2026-11-01')).toBe(6);
  });

  it('semanasRecientes devuelve 8 lunes consecutivos hasta la semana actual', () => {
    const s = semanasRecientes('2026-10-27');
    expect(s).toHaveLength(8);
    expect(s[0]).toBe('2026-09-07');
    expect(s[7]).toBe('2026-10-26');
    for (let i = 1; i < s.length; i++) expect(diferenciaDias(s[i - 1], s[i])).toBe(7);
  });

  it('etiquetas', () => {
    expect(etiquetaRango('2026-10-12')).toBe('12–18 oct');
    expect(etiquetaRango('2026-10-26')).toBe('26 oct – 1 nov');
    expect(etiquetaCorta('2026-09-07')).toBe('7 sep');
  });
});

describe('unidades', () => {
  it('formatea kg y lb sin ceros sobrantes', () => {
    expect(formatoPeso(100, 'kg')).toBe('100');
    expect(formatoPeso(45.4, 'kg')).toBe('45.4');
    expect(formatoPeso(45.359, 'lb')).toBe('100'); // 100 lb guardadas como 45.359 kg
    expect(formatoPeso(100, 'lb')).toBe('220.5');
  });

  it('formatoCambio', () => {
    expect(formatoCambio(5, 'kg')).toBe('+5');
    expect(formatoCambio(-2.5, 'kg')).toBe('-2.5');
    expect(formatoCambio(0.0001, 'kg')).toBe('=');
    expect(formatoCambio(2.26796185, 'lb')).toBe('+5');
  });
});

describe('cumplimiento de comidas por semana', () => {
  const semana = '2026-10-26';
  const fila = (fecha: string, i: number, cumplida: boolean | null = true): FilaCumplimiento => ({
    fecha,
    comida_index: i,
    cumplida,
  });

  it('calcula el porcentaje sobre los días transcurridos de la semana en curso', () => {
    // hoy = miércoles: 3 días transcurridos x 4 comidas = 12 esperadas
    const filas = [
      fila('2026-10-26', 0), fila('2026-10-26', 1), fila('2026-10-26', 2),
      fila('2026-10-27', 0), fila('2026-10-27', 1),
      fila('2026-10-28', 0),
    ];
    const [r] = cumplimientoPorSemana(filas, [semana], 4, '2026-10-28');
    expect(r.cumplidas).toBe(6);
    expect(r.esperadas).toBe(12);
    expect(r.porcentaje).toBe(50);
  });

  it('una semana pasada usa los 7 días', () => {
    const [r] = cumplimientoPorSemana([fila('2026-10-26', 0)], [semana], 4, '2026-11-10');
    expect(r.esperadas).toBe(28);
    expect(r.porcentaje).toBe(4);
  });

  it('no cuenta duplicados, comidas no cumplidas ni días de otras semanas', () => {
    const filas = [
      fila('2026-10-26', 0), fila('2026-10-26', 0),
      fila('2026-10-26', 1, false),
      fila('2026-10-25', 0), // domingo anterior
      fila('2026-11-02', 0), // lunes siguiente
    ];
    const [r] = cumplimientoPorSemana(filas, [semana], 4, '2026-11-01');
    expect(r.cumplidas).toBe(1);
  });

  it('sin plan conocido el porcentaje es null', () => {
    const [r] = cumplimientoPorSemana([fila('2026-10-26', 0)], [semana], 0, '2026-10-28');
    expect(r.porcentaje).toBeNull();
    expect(r.cumplidas).toBe(1);
  });

  it('semanas futuras no esperan nada y el porcentaje nunca pasa de 100', () => {
    const [futura] = cumplimientoPorSemana([], ['2026-11-02'], 4, '2026-10-28');
    expect(futura.esperadas).toBe(0);
    const [tope] = cumplimientoPorSemana(
      [fila('2026-10-26', 0), fila('2026-10-26', 1), fila('2026-10-26', 2)],
      [semana], 1, '2026-10-26',
    );
    expect(tope.porcentaje).toBe(100);
  });
});

describe('cargas por ejercicio', () => {
  const semanas = ['2026-10-19', '2026-10-26'];
  const carga = (ejercicio: string, fecha: string, kg: number | string): FilaCarga => ({
    ejercicio,
    ejercicio_clave: ejercicio.trim().toLowerCase(),
    fecha,
    peso_kg: kg,
  });

  const cargas = [
    carga('Remo', '2026-10-20', 100),
    carga('Remo', '2026-10-22', 102.5),
    carga('remo ', '2026-10-27', '105'), // misma clave, distinta escritura y peso como texto
    carga('Jalón', '2026-10-27', 80),
    carga('Press', '2026-10-21', 60),
    carga('Fuera', '2026-09-01', 50), // fuera de las semanas visibles
    carga('Cero', '2026-10-27', 0), // inválido
  ];

  it('sesiones = días distintos con carga', () => {
    const r = sesionesPorSemana(cargas, semanas);
    expect(r).toEqual([
      { semana: '2026-10-19', sesiones: 3 }, // 20, 21 y 22
      { semana: '2026-10-26', sesiones: 1 }, // 27
    ]);
  });

  it('peso máximo por semana, agrupando por clave y usando el nombre más reciente', () => {
    const e = pesoMaximoPorEjercicio(cargas, semanas);
    expect(e.map((x) => x.clave)).toEqual(['jalón', 'press', 'remo']);
    const remo = e.find((x) => x.clave === 'remo')!;
    expect(remo.porSemana['2026-10-19']).toBe(102.5);
    expect(remo.porSemana['2026-10-26']).toBe(105);
    expect(remo.nombre).toBe('remo ');
    expect(e.find((x) => x.clave === 'fuera')).toBeUndefined();
    expect(e.find((x) => x.clave === 'cero')).toBeUndefined();
  });

  it('progresión: compara con la semana previa y marca quién subió', () => {
    const e = pesoMaximoPorEjercicio(cargas, semanas);
    const filas = progresionSemana(e, '2026-10-26', '2026-10-19');
    expect(filas.map((f) => f.clave)).toEqual(['jalón', 'remo']); // Press no se hizo esta semana
    const remo = filas.find((f) => f.clave === 'remo')!;
    expect(remo.anteriorKg).toBe(102.5);
    expect(remo.deltaKg).toBe(2.5);
    expect(subioDePeso(remo)).toBe(true);
    const jalon = filas.find((f) => f.clave === 'jalón')!;
    expect(jalon.anteriorKg).toBeNull();
    expect(jalon.deltaKg).toBeNull();
    expect(subioDePeso(jalon)).toBe(false);
  });

  it('una diferencia menor a un gramo no cuenta como subida', () => {
    expect(
      subioDePeso({ clave: 'x', nombre: 'x', anteriorKg: 100, actualKg: 100.0005, deltaKg: 0.0005 }),
    ).toBe(false);
  });
});

describe('captura de carga', () => {
  it('claveEjercicio coincide con lower(btrim(ejercicio)) de la base de datos', () => {
    expect(claveEjercicio('  Remo con Barra ')).toBe('remo con barra');
    expect(claveEjercicio('LOI')).toBe('loi');
    // btrim no toca los espacios internos
    expect(claveEjercicio('Remo  con barra')).toBe('remo  con barra');
  });

  it('leerPeso acepta punto o coma y rechaza lo demás', () => {
    expect(leerPeso('102.5')).toBe(102.5);
    expect(leerPeso('102,5')).toBe(102.5);
    expect(leerPeso(' 80 ')).toBe(80);
    expect(leerPeso('')).toBeNull();
    expect(leerPeso('0')).toBeNull();
    expect(leerPeso('-5')).toBeNull();
    expect(leerPeso('10kg')).toBeNull();
  });

  it('lb a kg y de regreso', () => {
    expect(formatoPeso(unidadAKg(100, 'lb'), 'lb')).toBe('100');
    expect(unidadAKg(50, 'kg')).toBe(50);
  });

  it('con registro hoy: compara contra la vez anterior', () => {
    const r = resumenCarga(
      [
        { fecha: '2026-10-20', peso_kg: 100 },
        { fecha: '2026-10-27', peso_kg: '105' },
        { fecha: '2026-10-13', peso_kg: 95 },
      ],
      '2026-10-27',
    );
    expect(r).toEqual({ hoyKg: 105, previaKg: 100, previaFecha: '2026-10-20', deltaKg: 5 });
  });

  it('sin registro hoy: muestra la última y su cambio contra la penúltima', () => {
    const r = resumenCarga(
      [
        { fecha: '2026-10-13', peso_kg: 100 },
        { fecha: '2026-10-20', peso_kg: 97.5 },
      ],
      '2026-10-27',
    );
    expect(r).toEqual({ hoyKg: null, previaKg: 97.5, previaFecha: '2026-10-20', deltaKg: -2.5 });
  });

  it('primera vez: sin cambio que mostrar', () => {
    expect(resumenCarga([], '2026-10-27').deltaKg).toBeNull();
    expect(resumenCarga([{ fecha: '2026-10-27', peso_kg: 60 }], '2026-10-27')).toEqual({
      hoyKg: 60, previaKg: null, previaFecha: null, deltaKg: null,
    });
  });
});

describe('notas', () => {
  it('filtra por semana y ordena de la más reciente a la más antigua', () => {
    const notas = [
      { fecha: '2026-10-26', nota: 'lunes' },
      { fecha: '2026-10-28', nota: 'miércoles' },
      { fecha: '2026-10-25', nota: 'semana anterior' },
    ];
    expect(notasDeSemana(notas, '2026-10-26').map((n) => n.nota)).toEqual(['miércoles', 'lunes']);
  });
});
