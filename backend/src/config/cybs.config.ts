import path from "node:path";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const cybsConfig = {
  authenticationType: process.env.CYBS_AUTHENTICATION_TYPE || "jwt",
  merchantID: requiredEnv("CYBS_MERCHANT_ID"),
  runEnvironment: requiredEnv("CYBS_RUN_ENVIRONMENT"),

  keyAlias: requiredEnv("CYBS_KEY_ALIAS"),
  keyPass: requiredEnv("CYBS_KEY_PASS"),
  keyFileName: requiredEnv("CYBS_KEY_FILE_NAME"),
  keysDirectory: path.resolve(
    process.cwd(),
    requiredEnv("CYBS_KEYS_DIRECTORY"),
  ),

  enableLog: process.env.CYBS_ENABLE_LOG === "true",
  logDirectory: path.resolve(process.cwd(), "logs"),
  logFilename: "cybs-lab",
  includeRawResponse: process.env.NODE_ENV !== "production",
  allowProductionCaptures:
    process.env.CYBS_ALLOW_PRODUCTION_CAPTURES === "true",
};
