import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import staffPortalRouter from "./routes/staff-portal";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Rate limiting — max 120 requests per minute per IP (normal users never hit this)
// Tighter limit on sensitive endpoints: 10 attempts per 15 min
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

app.use("/api", generalLimiter);
app.use("/api/admin/login", strictLimiter);
app.use("/api/admin/bio-session", strictLimiter);
app.use("/api/staff/login", strictLimiter);

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

if (process.env.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
}

app.use("/api", router);
app.use("/api/staff", staffPortalRouter);

if (process.env.NODE_ENV === "production") {
  app.use((_req, res, next) => {
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    next();
  });

  const staticDir = path.join(process.cwd(), "artifacts/sky-official/dist/public");
  app.use("/uploads", express.static(path.join(process.cwd(), "artifacts/sky-official/public/uploads")));
  app.use(express.static(staticDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");
      }
    },
  }));
  app.get("/{*any}", (req, res, next) => {
    if (req.path.startsWith("/api")) { next(); return; }
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
