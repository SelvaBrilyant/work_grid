import { Router } from "express";
import { getCanvas, updateCanvas } from "../controllers/canvas.controller.js";

const router = Router();

router.get("/:channelId", getCanvas);
router.put("/:channelId", updateCanvas);

export default router;
