import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeHashInput, describePasswordInput, parseArguments, preparePasswordHash, readHidden, readWindowsClipboard, summarizeAdminConfiguration, verifyPreparedPassword } from "../../scripts/admin-access.mjs";
import { verifyAdminPassword } from "@/lib/admin-password";

afterEach(() => vi.unstubAllEnvs());

describe("offline administrator recovery preparation", () => {
  it("produces independently salted hashes accepted by the real application", async () => {
    const password = "phrase fictive locale 2026 !";
    const first = preparePasswordHash(password, password), second = preparePasswordHash(password, password);
    expect(first).not.toBe(second); expect(first).not.toContain(password);
    vi.stubEnv("ADMIN_PASSWORD_HASH", first);
    expect(await verifyAdminPassword(password)).toBe(true);
    expect(await verifyAdminPassword("incorrect")).toBe(false);
    expect(verifyPreparedPassword(password, first)).toBe(true);
    expect(verifyPreparedPassword("incorrect", first)).toBe(false);
  });
  it("rejects short, unconfirmed and malformed inputs", () => {
    expect(() => preparePasswordHash("short", "short")).toThrow();
    expect(() => preparePasswordHash("long fixture password", "other fixture password")).toThrow();
    expect(() => verifyPreparedPassword("fixture", "malformed")).toThrow();
    expect(() => parseArguments(["verify", "secret-in-arguments"])).toThrow();
    expect(() => parseArguments(["prepare", "--env-file", ".env.local"])).toThrow();
  });
  it("distinguishes missing input from a short password without reproducing its contents", () => {
    expect(describePasswordInput("", 16)).toContain("Aucun caractère reçu");
    expect(describePasswordInput("short", 16)).toContain("5 caractères reçus");
    expect(describePasswordInput("short", 16)).not.toContain("short");
    expect(describePasswordInput(" ".repeat(16), 16)).toContain("hors espaces");
    expect(describePasswordInput("x".repeat(257))).toContain("trop long");
    expect(describePasswordInput("short")).toBeNull();
    expect(() => preparePasswordHash("fixture password long enough", "")).toThrow("confirmation est vide");
  });
  it("accepts unpadded base64 already accepted by the application", async () => {
    const password = "fixture password without padding";
    const hash = preparePasswordHash(password, password).split("$").map((part) => part.replace(/=+$/, "")).join("$");
    vi.stubEnv("ADMIN_PASSWORD_HASH", hash);
    expect(await verifyAdminPassword(password)).toBe(true);
    expect(verifyPreparedPassword(password, hash)).toBe(true);
    expect(describeHashInput(hash)).toBeNull();
  });
  it.each([
    ["", "Aucun texte reçu"], ["ADMIN_PASSWORD_HASH", "nom de la variable"],
    ["••••••••", "valeur masquée"], ["ADMIN_PASSWORD_HASH=scrypt$fictional", "affectation complète"],
    ['"scrypt$fictional"', "guillemets"], ["scrypt$fictional", "structure est incomplète"],
    ["not-a-hash-fixture", "ne commence pas"],
  ])("diagnoses input without reproducing its contents: %s", (value, message) => {
    const result = describeHashInput(value);
    expect(result).toContain(message);
    expect(result).not.toContain("fictional"); expect(result).not.toContain("not-a-hash-fixture");
  });
  it("only enables clipboard access through its explicit verification flag", () => {
    expect(parseArguments(["verify-vercel"]).clipboard).toBe(false);
    expect(parseArguments(["verify-vercel", "--clipboard"]).clipboard).toBe(true);
    expect(() => parseArguments(["prepare", "--clipboard"])).toThrow();
  });
  it("captures clipboard content in memory using a static hidden command", () => {
    const run = vi.fn().mockReturnValue("scrypt$clipboard-fixture");
    expect(readWindowsClipboard({ platform: "win32", run })).toBe("scrypt$clipboard-fixture");
    const [command, args, options] = run.mock.calls[0];
    expect(command).toBe("powershell.exe");
    expect(args.join(" ")).not.toContain("clipboard-fixture");
    expect(args.join(" ")).toContain("[Console]::Write((Get-Clipboard");
    expect(options).toMatchObject({ windowsHide: true, stdio: ["ignore", "pipe", "pipe"], timeout: 5000 });
  });
  it("does not leak clipboard contents through child-process errors", () => {
    const run = vi.fn(() => { throw new Error("sensitive-clipboard-fixture"); });
    expect(() => readWindowsClipboard({ platform: "win32", run })).toThrow("Lecture du presse-papiers impossible");
    expect(() => readWindowsClipboard({ platform: "win32", run })).not.toThrow("sensitive-clipboard-fixture");
    expect(() => readWindowsClipboard({ platform: "linux", run })).toThrow("uniquement sous Windows");
  });
  it("reports readiness without returning secrets or the allowlisted address", () => {
    const result = summarizeAdminConfiguration({
      ADMIN_PASSWORD_HASH: preparePasswordHash("fixture password value", "fixture password value"),
      ADMIN_SESSION_SECRET: "fixture-signing-secret", ADMIN_TOTP_SECRET: "fixture-totp-secret", ADMIN_ALLOWED_EMAILS: "fixture@example.invalid",
    });
    expect(result).toEqual({ adminPassword: "format valide", signingSecret: "présent", totp: "configuré", allowlist: "personnalisée" });
    expect(JSON.stringify(result)).not.toContain("fixture");
  });
  it("refuses passwords from a pipe or redirected terminal output", async () => {
    await expect(readHidden("Password", { input: new PassThrough(), output: new PassThrough() })).rejects.toThrow("terminal interactif");
  });
  it("never echoes input and restores the terminal on submit", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: true, isRaw: false, setRawMode: vi.fn() });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    let rendered = ""; output.on("data", (chunk) => { rendered += chunk.toString(); });
    const result = readHidden("Password", { input, output });
    input.emit("keypress", "fixture-password", {});
    input.emit("keypress", "\r", { name: "return" });
    await expect(result).resolves.toBe("fixture-password");
    expect(rendered).not.toContain("fixture-password");
    expect(input.setRawMode.mock.calls).toEqual([[true], [false]]);
    expect(input.listenerCount("keypress")).toBe(0);
  });
  it("discards input on cancellation without displaying it", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: true, isRaw: false, setRawMode: vi.fn() });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    const result = readHidden("Password", { input, output });
    input.emit("keypress", "fixture-password", {});
    input.emit("keypress", "\u0003", { ctrl: true, name: "c" });
    await expect(result).rejects.toThrow("annulée");
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  });
  it.each([{ ctrl: true, name: "v" }, { shift: true, name: "insert" }])("pastes explicitly without echoing or trimming the password: %j", async (key) => {
    const input = Object.assign(new PassThrough(), { isTTY: true, isRaw: false, setRawMode: vi.fn() });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    const clipboardReader = vi.fn(() => " fixture password ");
    let rendered = ""; output.on("data", (chunk) => { rendered += chunk.toString(); });
    const result = readHidden("Password", { input, output, clipboardReader });
    expect(clipboardReader).not.toHaveBeenCalled();
    input.emit("keypress", "", key);
    input.emit("keypress", "\r", { name: "return" });
    await expect(result).resolves.toBe(" fixture password ");
    expect(clipboardReader).toHaveBeenCalledOnce();
    expect(rendered).not.toContain("fixture password");
  });
  it("aborts multiline paste without interpreting it as submission or leaking it", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: true, isRaw: false, setRawMode: vi.fn() });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    let rendered = ""; output.on("data", (chunk) => { rendered += chunk.toString(); });
    const result = readHidden("Password", { input, output, clipboardReader: () => "private fixture\r\nextra" });
    input.emit("keypress", "", { ctrl: true, name: "v" });
    await expect(result).rejects.toThrow("plusieurs lignes");
    expect(rendered).not.toContain("private fixture");
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  });
});
