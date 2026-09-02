import express from 'express';
import { registerUser, loginUser, getMe, getWorkers, updateProfile } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.get('/workers', getWorkers);
router.put('/profile', protect, updateProfile);

export default router;
