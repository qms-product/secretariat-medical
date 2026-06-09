import { validateEnv } from "@/lib/env";

export function register() {
  const result = validateEnv();

  if (!result.valid) {
    console.error(
      `[secretariat-medical] Variables d'environnement manquantes: ${result.missing.join(", ")}. ` +
        `Consultez .env.example pour la configuration requise.`
    );
    throw new Error(
      `Missing required environment variables: ${result.missing.join(", ")}`
    );
  }
}
