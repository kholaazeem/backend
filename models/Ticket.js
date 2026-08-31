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
      enum: ['pending', 'accepted', 'in-progress', 'completed', 'rejected'],
      default: 'pending'
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
      method: { type: String, enum: ['gemini', 'keyword-fallback'], default: 'keyword-fallback' },
      isReviewedByWorker: { type: Boolean, default: false }
    },
    resolutionNote: {
      type: String,
      default: ''
    },
    resolvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
