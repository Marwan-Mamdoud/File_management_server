import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import * as statsController from "./stats.controller.js";
import { Role } from "../../generated/prisma/client.js";

export const statsRoutes = Router();

statsRoutes.get("/user", authenticate, statsController.userStats);
statsRoutes.get(
  "/admin",
  authenticate,
  authorize(Role.ADMIN),
  statsController.adminStats,
);
