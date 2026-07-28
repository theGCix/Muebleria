// Tarifario de envío por distrito — origen: Los Olivos
// Actualizar aquí si cambian los precios; se usa en checkout.tsx

export type DistritoEnvio = { destino: string; precio: number };

export const ORIGEN_ENVIO = "Los Olivos";

export const DISTRITOS_ENVIO: DistritoEnvio[] = [
  { destino: "Ancón", precio: 130 },
  { destino: "Ate", precio: 180 },
  { destino: "Barranco", precio: 180 },
  { destino: "Breña", precio: 130 },
  { destino: "Carabayllo", precio: 130 },
  { destino: "Chaclacayo", precio: 280 },
  { destino: "Chorrillos", precio: 220 },
  { destino: "Cieneguilla", precio: 300 },
  { destino: "Comas", precio: 80 },
  { destino: "El Agustino", precio: 160 },
  { destino: "Independencia", precio: 70 },
  { destino: "Jesús María", precio: 140 },
  { destino: "La Molina", precio: 220 },
  { destino: "La Victoria", precio: 150 },
  { destino: "Lince", precio: 150 },
  { destino: "Los Olivos", precio: 60 },
  { destino: "Lurigancho - Chosica", precio: 300 },
  { destino: "Lurín", precio: 300 },
  { destino: "Magdalena del Mar", precio: 150 },
  { destino: "Miraflores", precio: 180 },
  { destino: "Pachacámac", precio: 280 },
  { destino: "Pucusana", precio: 380 },
  { destino: "Pueblo Libre", precio: 140 },
  { destino: "Puente Piedra", precio: 100 },
  { destino: "Punta Hermosa", precio: 340 },
  { destino: "Punta Negra", precio: 360 },
  { destino: "Rímac", precio: 120 },
  { destino: "San Bartolo", precio: 380 },
  { destino: "San Borja", precio: 180 },
  { destino: "San Isidro", precio: 170 },
  { destino: "San Juan de Lurigancho", precio: 170 },
  { destino: "San Juan de Miraflores", precio: 240 },
  { destino: "San Luis", precio: 170 },
  { destino: "San Martín de Porres", precio: 80 },
  { destino: "San Miguel", precio: 150 },
  { destino: "Santa Anita", precio: 180 },
  { destino: "Santa María del Mar", precio: 400 },
  { destino: "Santa Rosa", precio: 180 },
  { destino: "Santiago de Surco", precio: 200 },
  { destino: "Surquillo", precio: 180 },
  { destino: "Villa El Salvador", precio: 260 },
  { destino: "Villa María del Triunfo", precio: 260 },
  { destino: "Bellavista", precio: 140 },
  { destino: "Callao", precio: 140 },
  { destino: "Carmen de la Legua", precio: 130 },
  { destino: "La Perla", precio: 150 },
  { destino: "La Punta", precio: 170 },
  { destino: "Mi Perú", precio: 170 },
  { destino: "Ventanilla", precio: 180 },
];

/** Devuelve el precio de envío para un distrito, o null si no hay cobertura registrada. */
export function getPrecioEnvio(distrito: string): number | null {
  if (!distrito) return null;
  const match = DISTRITOS_ENVIO.find(
    (d) => d.destino.localeCompare(distrito, "es", { sensitivity: "base" }) === 0
  );
  return match ? match.precio : null;
} 