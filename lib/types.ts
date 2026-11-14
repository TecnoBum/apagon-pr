/**
 * Apagón PR — tipos compartidos.
 * Un "parte" es un mensaje crudo de la Empresa Eléctrica tal como se publicó,
 * siempre guardado íntegro. El parseo es un añadido: nunca sustituye al texto.
 */

export type MessageKind =
  | "nota" // NOTA de actualización del SEN
  | "averia" // Avería primaria / disparo / restablecido
  | "prevision" // Previsión de déficit diurno/nocturno (NO es horario por circuito)
  | "aviso" // Aviso general (fuera de plan, etc.)
  | "restaurado_total" // "No presenta afectación por déficit": todo restablecido
  | "otro"; // Sin clasificar: se muestra el texto tal cual

export type ParsedMessage = {
  kind: MessageKind;
  notaNum: number | null;
  deficitMw: number | null;
  bloques: string | null;
  /** 1 si la NOTA trae sección de circuitos afectados (aunque sea 1 solo).
   * Sin ella, la NOTA no cambia el estado de ningún circuito. */
  hasAfetadosSection: boolean;
  /** Circuitos afectados (códigos normalizados, p. ej. P916, PD1082). */
  afectados: string[];
  /** Circuitos restablecidos en este mensaje. */
  restablecidos: string[];
  /** Circuitos mencionados en averías (para kind=averia). */
  averiaCircuitos: string[];
  /** Si la avería es un restablecimiento (contiene RESTABLECIDO). */
  averiaRestablecido: boolean;
  /** Zona/lugar que acompaña al código, por código. */
  zonas: Record<string, string>;
  municipio: string | null;
};

export type StoredMessage = {
  id: string;
  source: "telegramian" | "elecpinar" | "mtproto" | "manual";
  externalId: string;
  /** ISO UTC. */
  postedAt: string;
  /** 1 si la hora fue inferida (el mensaje no traía fecha/hora propia). */
  postedAtInferred: number;
  /** 1 si es semilla de demostración (telegramian, oct 2024), no vigente. */
  demo: number;
  kind: MessageKind;
  notaNum: number | null;
  deficitMw: number | null;
  bloques: string | null;
  rawText: string;
  hasAfetadosSection: boolean;
  afectados: string[];
  restablecidos: string[];
  averiaCircuitos: string[];
  averiaRestablecido: number;
  zonas: Record<string, string>;
  municipio: string | null;
  parsedOk: number;
};

export type CircuitState = {
  id?: number;
  circuit: string;
  /** ISO UTC. */
  since: string;
  /** ISO UTC o null si sigue vigente. */
  until: string | null;
  status: "sin" | "con";
  /** 1 si la restauración fue inferida (el circuito dejó de aparecer en afectados). */
  inferred: number;
  sourceMsgId: string | null;
};

export type CircuitSummary = {
  code: string;
  zona: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  /** Estado actual según el último dato. */
  status: "sin" | "con" | "desconocido";
  /** ISO UTC del cambio al estado actual, o null. */
  since: string | null;
  /** 1 si la restauración al estado actual fue inferida. */
  inferred: number;
  /** Horas acumuladas SIN corriente (hasta el corte de datos). */
  hoursSin: number;
  /** Horas acumuladas CON corriente (solo desde la primera observación). */
  hoursCon: number;
  /** ISO UTC del último mensaje que menciona al circuito. */
  lastMsgAt: string | null;
  mentions: number;
};

export type PushSubscription = {
  id?: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** Circuitos suscritos; lista vacía = todos. */
  circuits: string[];
  createdAt: number;
};
