import express from 'express';
import { 
  previewAITriage, 
  createTicket, 
  getTickets, 
  updateTicketStatus, 
  handleAIChat,
  addTicketMessage,
  reviewAITriage
} from '../controllers/ticketController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/triage-preview', previewAITriage);
router.post('/chat', handleAIChat);
router.route('/')
  .post(protect, createTicket)
  .get(protect, getTickets);

router.put('/:id/status', protect, updateTicketStatus);
router.post('/:id/messages', protect, addTicketMessage);
router.put('/:id/ai-review', protect, reviewAITriage);

export default router;

