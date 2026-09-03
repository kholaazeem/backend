import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      default: () => 'TKT-' + Math.floor(1000 + Math.random() * 9000)
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    subject: {
      type: String,
      required: [true, 'Please enter a ticket subject'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Please enter complaint details'],
      trim: true
    },
    category: {
      type: String,
      enum: ['Billing', 'Technical', 'Account', 'Appliance', 'General'],
      default: 'General'
    },
    status: {
      type: String,
      enum: ['new', 'assigned', 'in-progress', 'resolved', 'pending', 'accepted', 'completed', 'rejected'],
      default: 'new'
    },
    urgency: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium'
    },
    aiTriage: {
      predictedCategory: { type: String, default: 'General' },
      suggestedUrgency: { type: String, default: 'Medium' },
      aiSummary: { type: String, default: 'AI analysis in progress...' },
      method: { type: String, enum: ['gemini', 'keyword-fallback','smart-engine'], default: 'keyword-fallback' },
      isReviewedByWorker: { type: Boolean, default: false },
      isReviewedByAgent: { type: Boolean, default: false },
      reviewedAt: { type: Date }
    },
    messages: [
      {
        sender: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        senderRole: {
          type: String,
          enum: ['customer', 'worker', 'admin'],
          required: true
        },
        senderName: {
          type: String,
          required: true
        },
        text: {
          type: String,
          required: true,
          trim: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    resolutionNote: {
      type: String,
      default: ''
    },
    resolvedAt: {
      type: Date
    },
    rating: {
      type: Number,
      default: null
    },
    reviewComment: {
      type: String,
      default: ''
    },
    isRated: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
