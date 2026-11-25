import jwt from "jsonwebtoken";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Application } from "express";
import type { JwtPayload } from "../Interfaces/IAuthService";

const ISSUER = "companydashboard-local-development";
const AUDIENCE = "companydashboard-local";

export class LocalDevelopmentAuth {
  private constructor(private readonly secret: string, private readonly passwordHash?: Buffer) {}

  static fromEnvironment(
    env: NodeJS.ProcessEnv,
    frontendOrigin = env.FRONTEND_ORIGIN,
  ): LocalDevelopmentAuth | undefined {
    if (env.DEMO_LOGIN_PASSWORD !== undefined) {
      if (env.LOCAL_AUTH_ENABLED === "true" || env.NODE_ENV !== "production" ||
          env.DEMO_LOGIN_PASSWORD.length < 32 || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32 ||
          env.DEMO_LOGIN_PASSWORD === env.SESSION_SECRET ||
          !frontendOrigin?.startsWith("https://")) {
        throw new Error("Demo prijava zahtijeva production, HTTPS FRONTEND_ORIGIN i zasebne tajne od najmanje 32 znaka.");
      }
      return new LocalDevelopmentAuth(
        env.SESSION_SECRET,
        createHash("sha256").update(env.DEMO_LOGIN_PASSWORD).digest(),
      );
    }
    if (env.LOCAL_AUTH_ENABLED !== "true") return undefined;
    if (env.NODE_ENV !== "development") {
      throw new Error("LOCAL_AUTH_ENABLED je dozvoljen samo uz NODE_ENV=development.");
    }
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
      throw new Error("Lokalna prijava zahtijeva SESSION_SECRET od najmanje 32 znaka.");
    }
    return new LocalDevelopmentAuth(env.SESSION_SECRET);
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    return jwt.verify(token, this.secret, {
      algorithms: ["HS256"],
      issuer: this.passwordHash ? "companydashboard-demo" : ISSUER,
      audience: AUDIENCE,
    }) as JwtPayload;
  }

  registerEndpoints(app: Application, frontendOrigin: string): void {
    const passwordHash = this.passwordHash;
    app.post(passwordHash ? "/auth/demo-login" : "/auth/local-login", (req, res) => {
      if (req.headers.origin !== frontendOrigin) {
        res.status(403).json({
          error: passwordHash ? "Prijava nije dostupna s ove adrese." :
            "Lokalna prijava je dostupna samo iz lokalnog frontenda.",
        });
        return;
      }
      if (passwordHash) {
        const password = req.body?.password;
        if (typeof password !== "string" ||
            !timingSafeEqual(createHash("sha256").update(password).digest(), passwordHash)) {
          res.status(401).json({ error: "Pogrešna lozinka." });
          return;
        }
      }
      const accessToken = jwt.sign({
        sub: passwordHash ? "00000000-0000-4000-8000-000000000013" : "00000000-0000-4000-8000-000000000012",
        preferred_username: passwordHash ? "demo-admin" : "local-admin",
        email: passwordHash ? "demo-admin@example.test" : "local-admin@example.test",
        name: passwordHash ? "Demo administrator" : "Lokalni administrator",
        given_name: passwordHash ? "Demo" : "Lokalni",
        family_name: "Administrator",
        realm_access: { roles: ["admin"] },
      }, this.secret, {
        algorithm: "HS256",
        issuer: passwordHash ? "companydashboard-demo" : ISSUER,
        audience: AUDIENCE,
        expiresIn: "1h",
      });
      res.setHeader("Cache-Control", "no-store");
      res.json({ accessToken });
    });
  }
}
