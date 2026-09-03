import mongoose from 'mongoose';
import Review from '../models/Review.js';
import User from '../models/User.js';
import Ticket from '../models/Ticket.js';
import { connectDB } from '../config/db.js';

let mockReviews = [];

// @desc    Submit 5-Star Rating & Review for Completed Task (Miss's Step 7)
// @route   POST /api/reviews
export const submitReview = async (req, res) => {
  try {
    const { ticketId, workerId, rating, comment } = req.body;
    const customerId = req.user?._id;

    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB();
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const isValidWorker = workerId && mongoose.Types.ObjectId.isValid(workerId);
        let review = null;

        if (isValidWorker) {
          review = await Review.create({
            ticket: ticketId,
            customer: customerId || undefined,
            worker: workerId,
            rating: Number(rating),
            comment
          });

          // Update worker average rating
          const workerReviews = await Review.find({ worker: workerId });
          const total = workerReviews.reduce((sum, r) => sum + r.rating, 0);
          const avg = (total / workerReviews.length).toFixed(1);

          await User.findByIdAndUpdate(workerId, {
            rating: Number(avg),
            $inc: { reviewCount: 1 }
          });
        }

        // Save rating onto Ticket so worker & customer see it on their dashboards
        const updatedTicket = await Ticket.findByIdAndUpdate(
          ticketId,
          {
            rating: Number(rating),
            reviewComment: comment,
            isRated: true
          },
          { new: true }
        );

        // Emit real-time notification to worker
        if (req.io) {
          req.io.emit('new_review_submitted', {
            ticketId,
            workerId,
            rating: Number(rating),
            comment,
            customerName: req.user?.name || 'Customer'
          });
        }

        return res.status(201).json(review || updatedTicket);
      } catch (dbError) {
        console.log('📌 DB error in review:', dbError.message);
      }
    }

    const newMockReview = {
      _id: 'rev_' + Date.now(),
      ticket: ticketId,
      customer: customerId,
      worker: workerId,
      rating: Number(rating),
      comment,
      createdAt: new Date()
    };
    mockReviews.push(newMockReview);

    // Emit real-time notification to worker
    if (req.io) {
      req.io.emit('new_review_submitted', {
        ticketId,
        workerId,
        rating: Number(rating),
        comment,
        customerName: req.user?.name || 'Customer'
      });
    }

    return res.status(201).json(newMockReview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
