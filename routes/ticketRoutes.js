import express from 'express';
import { previewAITriage, createTicket, getTickets, updateTicketStatus } from '../controllers/ticketController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/triage-preview', previewAITriage);
router.route('/')
  .post(protect, createTicket)
  .get(protect, getTickets);

router.put('/:id/status', protect, updateTicketStatus);

export default router;
