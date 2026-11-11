// Offline administrator access preparation. Never changes an environment file,
// browser cookie, account, database, or deployment. No network dependencies.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function parseAdminPasswordHash(hash) {
  if (typeof hash !== "string" || hash.length > 2048) return null;
  const parts = hash.trim().split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return null;
  const salt = Buffer.from(parts[1], "base64"), key = Buffer.from(parts[2], "base64");
  if (salt.length < 16 || salt.length > 128 || key.length < 32 || key.length > 128) return null;
  // Match the application's Buffer base64 decoder, including omitted padding.
  return { salt, key };
}

export function describeHashInput(value) {
  if (typeof value !== "string" || !value.trim()) return "Aucun texte reçu. Le collage n’a peut-être pas atteint le terminal. Essayez verify-vercel --clipboard.";
  const hash = value.trim();
  if (hash === "ADMIN_PASSWORD_HASH") return "Le nom de la variable a été reçu. Copiez sa valeur complète dans Vercel.";
  if (/^[*.\u2022\u25cf\u00b7\u2026\s]+$/.test(hash)) return "Une valeur masquée a été reçue. Utilisez la copie de la valeur réelle dans Vercel.";
  if (hash.startsWith("ADMIN_PASSWORD_HASH=")) return "Une affectation complète a été reçue. Copiez uniquement la valeur, sans ADMIN_PASSWORD_HASH=.";
  if (/^["']|["']$/.test(hash)) return "Des guillemets entourent la copie. Vérifiez la valeur brute dans Vercel ; l’outil ne retire pas ces guillemets automatiquement.";
  if (!hash.startsWith("scrypt$")) return "La copie reçue ne commence pas par le format scrypt$ attendu. Aucun mot de passe n’a été testé.";
  if (!parseAdminPasswordHash(hash)) return "La copie commence par scrypt$, mais sa structure est incomplète ou non prise en charge. Copiez toute la valeur depuis Vercel. Aucun mot de passe n’a été testé.";
  return null;
}

export function readWindowsClipboard({ platform = process.platform, run = execFileSync } = {}) {
  if (platform !== "win32") throw new Error("L’option --clipboard est disponible uniquement sous Windows.");
  try {
    // Static command only. Clipboard text is returned through a captured pipe,
    // never interpolated into executable text or forwarded to terminal output.
    return run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-Command",
      "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::Write((Get-Clipboard -Raw -ErrorAction Stop))"],
    { encoding: "utf8", windowsHide: true, timeout: 5000, maxBuffer: 16 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw new Error("Lecture du presse-papiers impossible. Recopiez la valeur depuis Vercel, puis réessayez. Aucun changement effectué.");
  }
}

export function verifyPreparedPassword(password, hash) {
  const parsed = parseAdminPasswordHash(hash);
  if (!parsed) throw new Error("Empreinte administrateur absente ou invalide.");
  if (typeof password !== "string" || password.length < 1 || password.length > 256) return false;
  return timingSafeEqual(scryptSync(password, parsed.salt, parsed.key.length), parsed.key);
}

export function describePasswordInput(password, minimumLength = 1) {
  if (typeof password !== "string" || password.length === 0) return "Aucun caractère reçu pour le mot de passe. Tapez-le au clavier ou utilisez Ctrl+V, puis Entrée. Aucun mot de passe n’a été testé ou enregistré.";
  if (password.length < minimumLength) return `Mot de passe trop court : ${password.length} caractères reçus ; ${minimumLength} minimum.`;
  if (password.length > 256) return "Mot de passe trop long : 256 caractères maximum.";
  if (minimumLength > 1 && password.trim().length < minimumLength) return "Choisissez au moins 16 caractères hors espaces en début et fin de saisie.";
  return null;
}

export function preparePasswordHash(password, confirmation) {
  const error = describePasswordInput(password, 16);
  if (error) throw new Error(error);
  if (confirmation === "") throw new Error("La confirmation est vide. Aucun fichier créé ; recommencez les deux saisies.");
  if (password !== confirmation) throw new Error("Les deux saisies ne correspondent pas.");
  const salt = randomBytes(32);
  return `scrypt$${salt.toString("base64")}$${scryptSync(password, salt, 64).toString("base64")}`;
}

export function summarizeAdminConfiguration(env) {
  const hash = env.ADMIN_PASSWORD_HASH?.trim();
  return {
    adminPassword: !hash ? "absent" : parseAdminPasswordHash(hash) ? "format valide" : "format invalide",
    signingSecret: env.ADMIN_SESSION_SECRET?.trim() ? "présent" : "absent",
    totp: env.ADMIN_TOTP_SECRET?.trim() ? "configuré" : "absent",
    allowlist: env.ADMIN_ALLOWED_EMAILS?.trim() ? "personnalisée" : "valeur par défaut du site",
  };
}

export function parseArguments(args) {
  const [mode = "status", ...rest] = args;
  if (!["status", "verify", "verify-vercel", "prepare", "help"].includes(mode)) throw new Error("Commande inconnue. Utilisez help.");
  const clipboard = mode === "verify-vercel" && rest.length === 1 && rest[0] === "--clipboard";
  if (rest.length !== 0 && !clipboard && !(rest.length === 2 && rest[0] === "--env-file" && ["status", "verify"].includes(mode))) {
    throw new Error("Arguments invalides. Ne passez jamais un mot de passe en argument.");
  }
  return { mode, envFile: resolve(ROOT, rest[1] ?? ".env.local"), clipboard };
}

// Read from a real interactive terminal only: no echo, pipes, shell arguments,
// debug logs, or terminal-history entry containing the supplied value.
/**
 * @param {string} prompt
 * @param {{ input?: import('node:stream').Readable & { isTTY?: boolean, isRaw?: boolean, setRawMode?: (enabled: boolean) => unknown }, output?: import('node:stream').Writable & { isTTY?: boolean }, clipboardReader?: () => string, pasteHint?: boolean }} [streams]
 * @returns {Promise<string>}
 */
export function readHidden(prompt, { input = process.stdin, output = process.stdout, clipboardReader = () => readWindowsClipboard(), pasteHint = true } = {}) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(new Error("Ouvrez cet outil dans un terminal interactif. La saisie par pipe est refusée."));
  }
  return new Promise((resolveInput, rejectInput) => {
    let value = "";
    const wasRaw = input.isRaw;
    const cleanup = () => {
      input.removeListener("keypress", onKey);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
      output.write("\n");
    };
    const onKey = (text, key = {}) => {
      if (key.ctrl && key.name === "c") { value = ""; cleanup(); rejectInput(new Error("Saisie annulée. Aucun changement.")); return; }
      if (key.name === "return" || key.name === "enter") { const result = value; value = ""; cleanup(); resolveInput(result); return; }
      if (key.name === "backspace") { value = Array.from(value).slice(0, -1).join(""); return; }
      if (key.ctrl && key.name === "u") { value = ""; return; }
      if ((key.ctrl && key.name === "v") || (key.shift && key.name === "insert")) {
        try {
          const pasted = clipboardReader();
          if (typeof pasted !== "string" || /[\u0000-\u001f\u007f]/.test(pasted)) {
            throw new Error("Le collage contient un retour à la ligne ou un caractère de contrôle. Copiez uniquement la valeur sur une ligne, puis recommencez.");
          }
          if (value.length + pasted.length > 2048) throw new Error("Saisie trop longue.");
          value += pasted;
        } catch {
          value = ""; cleanup();
          rejectInput(new Error("Collage impossible ou contenant plusieurs lignes. Recommencez en tapant la valeur au clavier. Aucun changement."));
        }
        return;
      }
      if (!key.ctrl && !key.meta && text && !/[\u0000-\u001f\u007f]/.test(text)) {
        if (value.length + text.length > 2048) { value = ""; cleanup(); rejectInput(new Error("Saisie trop longue.")); return; }
        value += text;
      }
    };
    output.write(`${prompt} (${pasteHint ? "saisie masquée, Ctrl+V pour coller, Entrée pour valider" : "Entrée pour continuer, sans coller"}) : `);
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.on("keypress", onKey);
    input.resume();
  });
}

export async function main(args = process.argv.slice(2)) {
  const { mode, envFile, clipboard } = parseArguments(args);
  if (mode === "help") {
    console.log("node scripts/admin-access.mjs status [--env-file chemin]\nnode scripts/admin-access.mjs verify [--env-file chemin]\nnode scripts/admin-access.mjs verify-vercel [--clipboard]\nnode scripts/admin-access.mjs prepare\n--clipboard lit uniquement le presse-papiers local Windows, sans l’afficher.\nAucun appel réseau ni modification de configuration. Ne fournissez aucun secret en argument.");
    return;
  }
  if (mode === "prepare") {
    const password = await readHidden("Nouveau mot de passe administrateur (16 caractères minimum)");
    const passwordError = describePasswordInput(password, 16);
    if (passwordError) throw new Error(passwordError);
    const confirmation = await readHidden("Confirmez ce mot de passe");
    const hash = preparePasswordHash(password, confirmation);
    const folder = resolve(ROOT, "output/admin-access");
    mkdirSync(folder, { recursive: true });
    const file = resolve(folder, `password-hash-${Date.now()}-${randomBytes(4).toString("hex")}.txt`);
    writeFileSync(file, hash, { flag: "wx", mode: 0o600 });
    console.log(`Empreinte préparée dans ${file}\nAucun mot de passe en clair enregistré. Aucune configuration changée. Ce fichier contient uniquement la valeur à installer plus tard dans ADMIN_PASSWORD_HASH. Conservez votre mot de passe dans votre gestionnaire.`);
    return;
  }
  let hash;
  if (mode === "verify-vercel") {
    console.log("Vérification hors ligne. Copiez ADMIN_PASSWORD_HASH depuis Vercel sans le modifier. Le résultat porte sur la valeur copiée, pas sur le déploiement actif.");
    if (clipboard) {
      await readHidden("Copiez maintenant la valeur Vercel, puis revenez ici", { pasteHint: false });
      hash = readWindowsClipboard();
      console.log("Presse-papiers lu localement, sans affichage ni enregistrement.");
    } else {
      hash = await readHidden("Valeur ADMIN_PASSWORD_HASH copiée de Vercel");
    }
  } else {
    let env;
    try { env = parseEnv(readFileSync(envFile, "utf8")); }
    catch { throw new Error("Fichier d’environnement absent ou illisible."); }
    if (mode === "status") {
      console.log(`Lecture du fichier ${envFile} uniquement ; aucune preuve de la configuration déployée.`);
      console.log(JSON.stringify(summarizeAdminConfiguration(env), null, 2));
      return;
    }
    hash = env.ADMIN_PASSWORD_HASH?.trim();
    console.log(`Vérification contre ${envFile} uniquement ; aucun appel au site.`);
  }
  const inputError = describeHashInput(hash);
  if (inputError) throw new Error(inputError);
  console.log("Format de l’empreinte accepté. Pour le mot de passe, tapez-le ou collez-le avec Ctrl+V, puis appuyez sur Entrée. Copier seul ne le saisit pas.");
  const password = await readHidden("Mot de passe à vérifier");
  const passwordError = describePasswordInput(password);
  if (passwordError) throw new Error(passwordError);
  const matches = verifyPreparedPassword(password, hash);
  console.log(matches ? "CORRESPOND : ce mot de passe valide l’empreinte fournie. Rien n’a été modifié." : "NE CORRESPOND PAS : rien n’a été modifié. Votre connexion actuelle n’a pas été utilisée.");
  if (!matches) process.exitCode = 2;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : "Vérification impossible."); process.exitCode = 1; });
}
