import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import { analyzeComplaintAI, chatWithSupportAI } from '../services/aiService.js';
import { connectDB } from '../config/db.js';

// In-memory mock storage if MongoDB is not connected
let mockTickets = [];
const mockAvailableWorkers = [];

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

    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB();
      } catch (e) {}
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

    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB();
      } catch (e) {}
    }

    let targetWorkerId = (assignedWorkerId && mongoose.Types.ObjectId.isValid(assignedWorkerId)) ? assignedWorkerId : null;

    if (mongoose.connection.readyState === 1) {
      try {
        // If customer did not manually pick a worker, auto-match the best registered worker from database
        if (!targetWorkerId) {
          const predictedCat = category || aiTriage?.predictedCategory || 'General';
          let matched = await User.findOne({ role: 'worker', specialty: predictedCat, isAvailable: true });
          if (!matched) {
            matched = await User.findOne({ role: 'worker', isAvailable: true });
          }
          if (!matched) {
            matched = await User.findOne({ role: 'worker' });
          }
          if (matched) {
            targetWorkerId = matched._id;
          }
        }

        const initialStatus = targetWorkerId ? 'assigned' : 'new';

        const ticket = await Ticket.create({
          customer: customerId,
          assignedWorker: targetWorkerId,
          subject,
          description,
          status: initialStatus,
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
            assignedWorkerId: targetWorkerId,
            status: ticket.status,
            customerName: populated.customer?.name || 'Customer',
            ticket: populated
          });
        }

        return res.status(201).json(populated);
      } catch (dbError) {
        console.log('📌 DB error in createTicket:', dbError.message);
      }
    }
    const newMock = {
      _id: 'tkt_' + Date.now(),
      ticketNumber: 'TKT-' + Math.floor(1000 + Math.random() * 9000),
      customer: { _id: customerId, name: req.user?.name || 'Customer', email: req.user?.email || '' },
      assignedWorker: validWorkerId ? { _id: validWorkerId, name: 'Assigned Worker' } : null,
      subject,
      description,
      category: category || aiTriage?.predictedCategory || 'General',
      status: initialStatus,
      urgency: urgency || aiTriage?.suggestedUrgency || 'Medium',
      aiTriage: aiTriage || {
        predictedCategory: category || 'General',
        suggestedUrgency: urgency || 'Medium',
        aiSummary: description.substring(0, 100),
        method: 'keyword-fallback'
      },
      messages: [],
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

    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB();
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        let query = {};
        if (userRole === 'customer') {
          query.customer = userId;
        } else if (userRole === 'worker') {
          query.$or = [
            { assignedWorker: userId },
            { assignedWorker: null, status: { $in: ['new', 'pending', 'assigned'] } },
            { status: 'new' },
            { status: 'pending' }
          ];
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
      filtered = mockTickets.filter(t => 
        t.assignedWorker?._id === userId || 
        t.status === 'new' || 
        t.status === 'pending' || 
        t.status === 'assigned'
      );
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

    // Enforce Rule: A ticket cannot be marked Resolved without a resolution/reply note
    if ((status === 'resolved' || status === 'completed') && (!resolutionNote || !resolutionNote.trim())) {
      return res.status(400).json({ message: 'A ticket cannot be marked Resolved without a resolution/reply note.' });
    }

    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB();
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const ticket = await Ticket.findById(id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        // Enforce status lock rule: A resolved/rejected ticket cannot be changed through normal workflow unless reopened
        const isCurrentlyResolved = ticket.status === 'resolved' || ticket.status === 'completed' || ticket.status === 'rejected';
        if (isCurrentlyResolved && status !== 'reopened' && status !== 'new' && status !== 'in-progress') {
          return res.status(400).json({ message: 'A resolved ticket cannot be changed through the normal workflow unless reopened.' });
        }

        if (status) ticket.status = status;
        if (urgency) ticket.urgency = urgency;
        if (resolutionNote) ticket.resolutionNote = resolutionNote.trim();
        if (status === 'resolved' || status === 'completed') ticket.resolvedAt = new Date();

        await ticket.save();

        // Socket IO notification
        if (req.io) {
          req.io.emit('ticket_status_updated', {
            ticketId: id,
            status: ticket.status,
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            customerId: ticket.customer?._id || ticket.customer,
            assignedWorkerId: ticket.assignedWorker?._id || ticket.assignedWorker,
            resolutionNote: ticket.resolutionNote,
            ticket
          });
        }

        return res.json(ticket);
      } catch (dbError) {
        console.log('📌 DB error on status update, trying mock');
      }
    }

    // Mock fallback update
    const ticket = mockTickets.find(t => t._id === id);
    if (ticket) {
      const isCurrentlyResolved = ticket.status === 'resolved' || ticket.status === 'completed' || ticket.status === 'rejected';
      if (isCurrentlyResolved && status !== 'reopened' && status !== 'new' && status !== 'in-progress') {
        return res.status(400).json({ message: 'A resolved ticket cannot be changed through the normal workflow unless reopened.' });
      }
      if (status) ticket.status = status;
      if (urgency) ticket.urgency = urgency;
      if (resolutionNote) ticket.resolutionNote = resolutionNote.trim();
      if (status === 'resolved' || status === 'completed') ticket.resolvedAt = new Date();

      if (req.io) {
        req.io.emit('ticket_status_updated', {
          ticketId: id,
          status: ticket.status,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          customerId: ticket.customer?._id || ticket.customer,
          assignedWorkerId: ticket.assignedWorker?._id || ticket.assignedWorker,
          resolutionNote: ticket.resolutionNote,
          ticket
        });
      }

      return res.json(ticket);
    }
    res.status(404).json({ message: 'Ticket not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a message to the persistent Ticket Conversation
// @route   POST /api/tickets/:id/messages
// @access  Private (Customer, Worker, Admin)
export const addTicketMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const newMessage = {
      sender: req.user?._id,
      senderRole: req.user?.role || 'customer',
      senderName: req.user?.name || 'User',
      text: text.trim(),
      createdAt: new Date()
    };

    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB();
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const ticket = await Ticket.findById(id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        if (!ticket.messages) ticket.messages = [];
        ticket.messages.push(newMessage);
        await ticket.save();

        const populated = await Ticket.findById(id)
          .populate('customer', 'name email avatar')
          .populate('assignedWorker', 'name specialty rating avatar');

        if (req.io) {
          req.io.emit('ticket_message_received', {
            ticketId: id,
            ticketNumber: ticket.ticketNumber,
            message: newMessage,
            ticket: populated
          });
        }

        return res.status(201).json(populated);
      } catch (dbError) {
        console.log('📌 DB error in addTicketMessage, falling back to mock');
      }
    }

    // Mock fallback
    const ticket = mockTickets.find(t => t._id === id);
    if (ticket) {
      if (!ticket.messages) ticket.messages = [];
      ticket.messages.push(newMessage);

      if (req.io) {
        req.io.emit('ticket_message_received', {
          ticketId: id,
          ticketNumber: ticket.ticketNumber,
          message: newMessage,
          ticket
        });
      }

      return res.status(201).json(ticket);
    }
    return res.status(404).json({ message: 'Ticket not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Agent Reviews and Edits AI Triage Suggestions before finalizing
// @route   PUT /api/tickets/:id/ai-review
// @access  Private (Worker / Agent / Admin)
export const reviewAITriage = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, urgency, aiSummary } = req.body;

    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB();
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const ticket = await Ticket.findById(id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        if (category) {
          ticket.category = category;
          ticket.aiTriage.predictedCategory = category;
        }
        if (urgency) {
          ticket.urgency = urgency;
          ticket.aiTriage.suggestedUrgency = urgency;
        }
        if (aiSummary) {
          ticket.aiTriage.aiSummary = aiSummary;
        }

        ticket.aiTriage.isReviewedByAgent = true;
        ticket.aiTriage.isReviewedByWorker = true;
        ticket.aiTriage.reviewedAt = new Date();

        await ticket.save();

        const populated = await Ticket.findById(id)
          .populate('customer', 'name email avatar')
          .populate('assignedWorker', 'name specialty rating avatar');

        if (req.io) {
          req.io.emit('ticket_ai_reviewed', {
            ticketId: id,
            ticket: populated
          });
        }

        return res.json(populated);
      } catch (dbError) {
        console.log('📌 DB error in reviewAITriage, trying mock');
      }
    }

    // Mock fallback
    const ticket = mockTickets.find(t => t._id === id);
    if (ticket) {
      if (category) {
        ticket.category = category;
        if (!ticket.aiTriage) ticket.aiTriage = {};
        ticket.aiTriage.predictedCategory = category;
      }
      if (urgency) {
        ticket.urgency = urgency;
        if (!ticket.aiTriage) ticket.aiTriage = {};
        ticket.aiTriage.suggestedUrgency = urgency;
      }
      if (aiSummary) {
        if (!ticket.aiTriage) ticket.aiTriage = {};
        ticket.aiTriage.aiSummary = aiSummary;
      }
      if (!ticket.aiTriage) ticket.aiTriage = {};
      ticket.aiTriage.isReviewedByAgent = true;
      ticket.aiTriage.isReviewedByWorker = true;
      ticket.aiTriage.reviewedAt = new Date();

      if (req.io) {
        req.io.emit('ticket_ai_reviewed', {
          ticketId: id,
          ticket
        });
      }

      return res.json(ticket);
    }
    return res.status(404).json({ message: 'Ticket not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Live Support AI Agent Chat
// @route   POST /api/tickets/chat
// @access  Public
export const handleAIChat = async (req, res) => {
  try {
    const { message, chatHistory } = req.body;
    const reply = await chatWithSupportAI(message, chatHistory);
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

