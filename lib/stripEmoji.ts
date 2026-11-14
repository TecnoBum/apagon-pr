/**
 * Apagón PR — eliminar emojis del texto.
 *
 * Los partes de la empresa vienen con emojis (❗ 📈 🔰 ⚠ ⚜️ 📌 💡 🛎 ⏰ ☀ 🌑).
 * La app es minimalista y sin emojis en NINGÚN sitio: el texto crudo de los
 * partes se muestra siempre pasado por stripEmoji(). Verificado contra los
 * 55 mensajes de la semilla: tras el strip no queda ningún codepoint emoji.
 */

const EMOJI_RE =
  /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu;

/** Quita todos los emojis de un texto y limpia los huecos que dejan. */
export function stripEmoji(text: string): string {
  return text
    .replace(EMOJI_RE, "")
    // Las líneas que eran solo emoji quedan vacías: colapsarlas.
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** true si el texto todavía contiene algún codepoint emoji (para tests). */
export function hasEmoji(text: string): boolean {
  EMOJI_RE.lastIndex = 0;
  return EMOJI_RE.test(text);
}
