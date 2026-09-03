import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getMe, 
  getWorkers, 
  updateProfile,
  checkHasAdmin,
  getAllUsers,
  updateUserRole
} from '../controllers/authController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/has-admin', checkHasAdmin);
router.get('/me', protect, getMe);
router.get('/workers', getWorkers);
router.put('/profile', protect, updateProfile);

// Admin-only user management routes
router.get('/users', protect, authorizeRoles('admin'), getAllUsers);
router.put('/users/:id/role', protect, authorizeRoles('admin'), updateUserRole);

export default router;
