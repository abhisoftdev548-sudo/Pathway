import { Router } from 'express';
import * as miscController from '../controllers/miscController.js';

const router = Router();

router.get('/health', miscController.health);
router.get('/categories', miscController.getCategories);
router.get('/tags', miscController.getTags);
router.get('/stats', miscController.getPublicStats);
router.get('/highlights', miscController.getPublicHighlights);

export default router;
