// data.js — mock data for DocFill

// Templates with detected {{variables}}
export const TEMPLATES = [
  {
    id: "fra",
    name: "Factura de servicios",
    file: "factura_servicios.docx",
    date: "12 may 2026",
    vars: ["cliente", "nif", "numero_factura", "fecha", "concepto", "base", "iva", "total"],
    body: [
      { t: "h", text: "FACTURA Nº ", v: "numero_factura" },
      { t: "p", parts: ["Fecha de emisión: ", { v: "fecha" }] },
      { t: "p", parts: ["Cliente: ", { v: "cliente" }, "  ·  NIF: ", { v: "nif" }] },
      { t: "p", parts: ["Concepto: ", { v: "concepto" }] },
      { t: "p", parts: ["Base imponible: ", { v: "base" }, " €"] },
      { t: "p", parts: ["IVA (", { v: "iva" }, "%) incluido."] },
      { t: "p", parts: ["TOTAL A PAGAR: ", { v: "total" }, " €"] },
    ],
  },
  {
    id: "arr",
    name: "Contrato de arrendamiento",
    file: "contrato_arrendamiento.docx",
    date: "28 abr 2026",
    vars: ["nombre_inquilino", "dni", "direccion", "fecha_inicio", "duracion_meses", "importe_mensual"],
    body: [
      { t: "h", text: "CONTRATO DE ARRENDAMIENTO" },
      { t: "p", parts: ["En la fecha ", { v: "fecha_inicio" }, ", D./Dña. ", { v: "nombre_inquilino" }, ", con DNI ", { v: "dni" }, ","] },
      { t: "p", parts: ["arrienda la vivienda sita en ", { v: "direccion" }, "."] },
      { t: "p", parts: ["Duración: ", { v: "duracion_meses" }, " meses."] },
      { t: "p", parts: ["Renta mensual: ", { v: "importe_mensual" }, " € pagaderos por mensualidades anticipadas."] },
    ],
  },
  {
    id: "cert",
    name: "Certificado de asistencia",
    file: "certificado_asistencia.docx",
    date: "15 abr 2026",
    vars: ["nombre", "curso", "fecha", "horas"],
    body: [
      { t: "h", text: "CERTIFICADO DE ASISTENCIA" },
      { t: "p", parts: ["Se certifica que ", { v: "nombre" }, " ha asistido"] },
      { t: "p", parts: ["al curso «", { v: "curso" }, "»"] },
      { t: "p", parts: ["con una duración de ", { v: "horas" }, " horas lectivas,"] },
      { t: "p", parts: ["celebrado con fecha ", { v: "fecha" }, "."] },
    ],
  },
  {
    id: "bien",
    name: "Carta de bienvenida",
    file: "carta_bienvenida.docx",
    date: "2 abr 2026",
    vars: ["nombre", "empresa", "puesto", "fecha_inicio"],
    body: [
      { t: "h", text: "¡Te damos la bienvenida!" },
      { t: "p", parts: ["Estimado/a ", { v: "nombre" }, ","] },
      { t: "p", parts: ["Nos complace darte la bienvenida a ", { v: "empresa" }, "."] },
      { t: "p", parts: ["Te incorporarás como ", { v: "puesto" }, " el día ", { v: "fecha_inicio" }, "."] },
    ],
  },
];

// Spanish labels for variables (used in forms)
export const VAR_LABELS = {
  cliente: "Cliente", nif: "NIF / CIF", numero_factura: "Nº de factura", fecha: "Fecha",
  concepto: "Concepto", base: "Base imponible", iva: "IVA (%)", total: "Total",
  nombre_inquilino: "Nombre del inquilino", dni: "DNI", direccion: "Dirección",
  fecha_inicio: "Fecha de inicio", duracion_meses: "Duración (meses)", importe_mensual: "Importe mensual",
  nombre: "Nombre completo", curso: "Curso", horas: "Horas", empresa: "Empresa", puesto: "Puesto",
};

// Recent activity
export const RECENT = [
  { id: 1, template: "Factura de servicios", count: 24, when: "Hace 2 horas", source: "Excel", folder: "Facturas/Mayo" },
  { id: 2, template: "Carta de bienvenida", count: 1, when: "Hace 5 horas", source: "Manual", folder: "RRHH/Altas" },
  { id: 3, template: "Certificado de asistencia", count: 18, when: "Ayer", source: "Excel", folder: "Formación/Q2" },
  { id: 4, template: "Contrato de arrendamiento", count: 1, when: "Hace 3 días", source: "Manual", folder: "Contratos" },
  { id: 5, template: "Factura de servicios", count: 31, when: "Hace 4 días", source: "Excel", folder: "Facturas/Abril" },
];

// Sample Excel for the mapping screen (matches "Factura de servicios")
export const EXCEL = {
  file: "clientes_mayo_2026.xlsx",
  columns: ["Razón social", "CIF", "Nº doc", "Fecha emisión", "Servicio prestado", "Base (€)", "IVA", "Total (€)"],
  rows: [
    ["Construcciones Vega S.L.", "B12345678", "2026-0142", "05/05/2026", "Reforma oficina planta 2", "4.200,00", "21", "5.082,00"],
    ["Atelier Marín", "X9988221C", "2026-0143", "06/05/2026", "Diseño de identidad visual", "1.800,00", "21", "2.178,00"],
    ["Frutas del Sur S.A.", "A87654321", "2026-0144", "07/05/2026", "Mantenimiento web anual", "960,00", "21", "1.161,60"],
    ["Clínica Aurora", "B55667788", "2026-0145", "08/05/2026", "Consultoría LOPD", "1.250,00", "21", "1.512,50"],
    ["Talleres Quintana", "B33445566", "2026-0146", "09/05/2026", "Campaña Google Ads", "740,00", "21", "895,40"],
  ],
  total: 24,
};

// A reasonable auto-mapping guess (var -> column index, or null)
export const AUTO_MAP = {
  cliente: 0, nif: 1, numero_factura: 2, fecha: 3, concepto: 4, base: 5, iva: 6, total: 7,
};
