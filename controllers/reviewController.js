import Review from '../models/Review.js';
import User from '../models/User.js';
import Ticket from '../models/Ticket.js';

let mockReviews = [];

// @desc    Submit 5-Star Rating & Review for Completed Task (Miss's Step 7)
// @route   POST /api/reviews
export const submitReview = async (req, res) => {
  try {
    const { ticketId, workerId, rating, comment } = req.body;
    const customerId = req.user?._id || 'user_cust_1';

    try {
      const review = await Review.create({
        ticket: ticketId,
        customer: customerId,
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

      return res.status(201).json(review);
    } catch (dbError) {
      console.log('📌 DB offline, using mock review submission fallback');
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
      return res.status(201).json(newMockReview);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
