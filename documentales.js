
const DOCUMENTALES = {
  nombre: "MIANTOCLIP LONG VIDEO",
  version: "0.1",
  duracionMaxima: 600,
  duracionEscena: 10
};

export function crearPlanDocumental({
  tema = "Las pirámides de Egipto",
  duracion = 420,
  idioma = "es"
} = {}) {
  const segundos = Number(duracion);

  if (!Number.isInteger(segundos) ||
      segundos < 10 ||
      segundos > DOCUMENTALES.duracionMaxima) {
    throw new Error("Duración no válida");
  }

  const escenas = [];
  const total = Math.ceil(
    segundos / DOCUMENTALES.duracionEscena
  );

  for (let i = 0; i < total; i++) {
    escenas.push({
      numero: i + 1,
      inicio: i * 10,
      duracion: Math.min(10, segundos - i * 10),
      estado: "pendiente"
    });
  }

  return {
    motor: DOCUMENTALES.nombre,
    tema,
    idioma,
    duracion: segundos,
    totalEscenas: total,
    escenas
  };
}
