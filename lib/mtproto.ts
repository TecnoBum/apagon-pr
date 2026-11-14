/**
 * Apagón PR — lector MTProto de Telegram (PLACEHOLDER).
 *
 * El canal @EmpresaElectricaPROficial tiene el contenido protegido:
 * t.me/s/ no muestra los mensajes sin iniciar sesión. La única vía
 * directa y en vivo es una sesión MTProto (cliente Telegram) con el
 * string de sesión en la variable TELEGRAM_SESSION_STRING.
 *
 * ESTADO ACTUAL: NO hay sesión configurada. Este módulo NO inventa
 * datos: cuando falta la sesión, devuelve { ok: false, reason:
 * "no_session_configured" } y /api/sync lo reporta tal cual.
 * Cuando Johan decida la sesión, aquí se conecta GramJS (telegram)
 * con TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION_STRING
 * y se leen los últimos mensajes del canal elecpinar.
 */

export type MtprotoResult = {
  ok: boolean;
  reason: string;
  detail?: string;
  messages: never[];
};

export async function readTelegramChannel(): Promise<MtprotoResult> {
  const session = process.env.TELEGRAM_SESSION_STRING || "";
  if (!session) {
    return {
      ok: false,
      reason: "no_session_configured",
      detail:
        "No hay sesión de Telegram configurada. El lector en vivo necesita TELEGRAM_SESSION_STRING (decisión pendiente de Johan). Sin sesión no se leen mensajes del canal.",
      messages: [],
    };
  }
  // Hay sesión pero el cliente GramJS aún no está instalado en el proyecto.
  // No se intenta nada a ciegas: se reporta y no se inventa ningún dato.
  return {
    ok: false,
    reason: "mtproto_no_disponible",
    detail:
      "Hay una sesión configurada, pero el cliente MTProto (GramJS) aún no está instalado en este despliegue.",
    messages: [],
  };
}
