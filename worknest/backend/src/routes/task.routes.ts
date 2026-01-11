import { Router } from "express";
import {
  getChannelTasks,
  createTask,
  updateTask,
  deleteTask,
  updateTaskOrder,
} from "../controllers/task.controller.js";
import { authenticate } from "../middlewares/index.js";

const router = Router();

router.use(authenticate);

router.get("/channel/:channelId", getChannelTasks);
router.post("/channel/:channelId", createTask);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);
router.post("/reorder", updateTaskOrder);

export default router;
