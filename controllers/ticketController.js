import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import { analyzeComplaintAI } from '../services/aiService.js';

// In-memory mock tickets for fast demo if DB is offline
let mockTickets = [
  {
    _id: 'tkt_1001',
    ticketNumber: 'TKT-1001',
    customer: { _id: 'user_cust_1', name: 'Sara Khan', email: 'customer@demo.com' },
    assignedWorker: { _id: 'user_work_1', name: 'Worker Ali', specialty: 'Technical', rating: 4.9 },
    subject: 'AC cooling issue and water leaking',
    description: 'My main office AC is leaking water continuously and not cooling properly.',
    category: 'Appliance',
    status: 'in-progress',
    urgency: 'High',
    aiTriage: {
      predictedCategory: 'Appliance',
      suggestedUrgency: 'High',
      aiSummary: 'Appliance leakage and cooling failure reported by customer.',
      method: 'keyword-fallback'
    },
    createdAt: new Date(Date.now() - 3600000 * 2)
  },
  {
    _id: 'tkt_1002',
    ticketNumber: 'TKT-1002',
    customer: { _id: 'user_cust_1', name: 'Sara Khan', email: 'customer@demo.com' },
    assignedWorker: { _id: 'user_work_2', name: 'Worker Usman', specialty: 'Billing', rating: 4.8 },
    subject: 'Double charge on invoice #9921',
    description: 'I was charged twice for the same subscription payment on my credit card.',
    category: 'Billing',
    status: 'pending',
    urgency: 'High',
    aiTriage: {
      predictedCategory: 'Billing',
      suggestedUrgency: 'High',
      aiSummary: 'Duplicate credit card payment charge reported for invoice #9921.',
      method: 'keyword-fallback'
    },
    createdAt: new Date(Date.now() - 3600000 * 5)
  }
];

// Available mock workers list for selection preview
const mockAvailableWorkers = [
  { _id: 'user_work_1', name: 'Worker Ali (Tech Expert)', specialty: 'Technical', rating: 4.9, reviewCount: 24, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
  { _id: 'user_work_2', name: 'Worker Usman (Billing Specialist)', specialty: 'Billing', rating: 4.8, reviewCount: 18, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
  { _id: 'user_work_3', name: 'Worker Hamza (Appliance Repair)', specialty: 'Appliance', rating: 5.0, reviewCount: 31, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150' }
];

// @desc    Live AI Triage preview endpoint as user types description
// @route   POST /api/tickets/triage-preview
export const previewAITriage = async (req, res) => {
  try {
    const { subject, description } = req.body;
    if (!description || description.trim().length < 5) {
      return res.json({
        predictedCategory: 'General',
        suggestedUrgency: 'Low',
        aiSummary: 'Type complaint details to activate AI Triage...',
        method: 'keyword-fallback',
        suggestedWorkers: mockAvailableWorkers
      });
    }

    const aiResult = await analyzeComplaintAI(description, subject);

    // Fetch suggested workers matching predicted category
    let suggestedWorkers = [];
    try {
      suggestedWorkers = await User.find({ role: 'worker', isAvailable: true }).select('-password');
    } catch (e) {
      suggestedWorkers = mockAvailableWorkers;
    }

    if (!suggestedWorkers || suggestedWorkers.length === 0) {
      suggestedWorkers = mockAvailableWorkers;
    }

    res.json({
      ...aiResult,
      suggestedWorkers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create Ticket & Select Worker (Miss's Step 3)
// @route   POST /api/tickets
export const createTicket = async (req, res) => {
  try {
    const { subject, description, category, urgency, assignedWorkerId, aiTriage } = req.body;
    const customerId = req.user?._id || 'user_cust_1';

    if (mongoose.connection.readyState === 1) {
      try {
        const ticket = await Ticket.create({
          customer: customerId,
          assignedWorker: assignedWorkerId || null,
          subject,
          description,
          category: category || aiTriage?.predictedCategory || 'General',
          urgency: urgency || aiTriage?.suggestedUrgency || 'Medium',
          aiTriage: aiTriage || {
            predictedCategory: category || 'General',
            suggestedUrgency: urgency || 'Medium',
            aiSummary: description.substring(0, 100),
            method: 'keyword-fallback'
          }
        });

        const populated = await Ticket.findById(ticket._id)
          .populate('customer', 'name email avatar')
          .populate('assignedWorker', 'name specialty rating avatar');

        // Emit real-time notification via Socket.IO
        if (req.io) {
          req.io.emit('new_booking_notification', {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            assignedWorkerId
          });
        }

        return res.status(201).json(populated);
      } catch (dbError) {
        console.log('📌 DB error, using mock ticket creation fallback');
      }
    }
      const newMock = {
        _id: 'tkt_' + Date.now(),
        ticketNumber: 'TKT-' + Math.floor(1000 + Math.random() * 9000),
        customer: { _id: customerId, name: req.user?.name || 'Sara Khan', email: req.user?.email || 'customer@demo.com' },
        assignedWorker: mockAvailableWorkers.find(w => w._id === assignedWorkerId) || mockAvailableWorkers[0],
        subject,
        description,
        category: category || aiTriage?.predictedCategory || 'General',
        status: 'pending',
        urgency: urgency || aiTriage?.suggestedUrgency || 'Medium',
        aiTriage: aiTriage || {
          predictedCategory: category || 'General',
          suggestedUrgency: urgency || 'Medium',
          aiSummary: description.substring(0, 100),
          method: 'keyword-fallback'
        },
        createdAt: new Date()
      };
      mockTickets.unshift(newMock);
      return res.status(201).json(newMock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all tickets filtered by user role
// @route   GET /api/tickets
export const getTickets = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role || 'customer';

    if (mongoose.connection.readyState === 1) {
      try {
        let query = {};
        if (userRole === 'customer') {
          query.customer = userId;
        } else if (userRole === 'worker') {
          query.$or = [{ assignedWorker: userId }, { status: 'pending' }];
        }

        const tickets = await Ticket.find(query)
          .populate('customer', 'name email avatar')
          .populate('assignedWorker', 'name specialty rating avatar')
          .sort({ createdAt: -1 });

        return res.json(tickets);
      } catch (dbError) {
        console.log('📌 DB error, returning mock tickets filtered by role');
      }
    }

    let filtered = mockTickets;
    if (userRole === 'customer') {
      filtered = mockTickets.filter(t => t.customer._id === userId || t.customer.email === req.user?.email);
    } else if (userRole === 'worker') {
      filtered = mockTickets.filter(t => t.assignedWorker?._id === userId || t.status === 'pending');
    }
    return res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update Ticket Status / Action (Cancel, Complete, Status update)
// @route   PUT /api/tickets/:id/status
export const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, urgency, resolutionNote } = req.body;

    if (mongoose.connection.readyState === 1) {
      try {
        const ticket = await Ticket.findById(id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        // Enforce status lock rule: Once rejected or completed, status cannot be changed again!
        if (ticket.status === 'completed' || ticket.status === 'rejected') {
          return res.status(400).json({ message: 'Task status is finalized and locked. Cannot edit completed or rejected tasks!' });
        }

        if (status) ticket.status = status;
        if (urgency) ticket.urgency = urgency;
        if (resolutionNote) ticket.resolutionNote = resolutionNote;
        if (status === 'completed') ticket.resolvedAt = new Date();

        await ticket.save();

        // Socket IO notification
        if (req.io) {
          req.io.emit('ticket_status_updated', { ticketId: id, status: ticket.status });
        }

        return res.json(ticket);
      } catch (dbError) {
        console.log('📌 DB error on status update, trying mock');
      }
    }

    // Mock fallback update
    const ticket = mockTickets.find(t => t._id === id);
    if (ticket) {
      if (ticket.status === 'completed' || ticket.status === 'rejected') {
        return res.status(400).json({ message: 'Task status is finalized and locked. Cannot edit completed or rejected tasks!' });
      }
      if (status) ticket.status = status;
      if (urgency) ticket.urgency = urgency;
      if (resolutionNote) ticket.resolutionNote = resolutionNote;
      return res.json(ticket);
    }
    res.status(404).json({ message: 'Ticket not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
