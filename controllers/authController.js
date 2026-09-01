import mongoose from 'mongoose';
import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

// In-memory mock storage if MongoDB is not connected
let mockUsers = [
  {
    _id: 'user_cust_1',
    name: 'Customer Sara',
    email: 'customer@demo.com',
    password: 'password123', // unhashed mock
    role: 'customer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
  },
  {
    _id: 'user_work_1',
    name: 'Worker Ali (Tech Expert)',
    email: 'worker@demo.com',
    password: 'password123',
    role: 'worker',
    specialty: 'Technical',
    rating: 4.9,
    reviewCount: 24,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
  },
  {
    _id: 'user_work_2',
    name: 'Worker Usman (Billing)',
    email: 'usman@demo.com',
    password: 'password123',
    role: 'worker',
    specialty: 'Billing',
    rating: 4.8,
    reviewCount: 18,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
  },
  {
    _id: 'user_admin_1',
    name: 'Admin Boss',
    email: 'admin@demo.com',
    password: 'password123',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
  }
];

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, specialty } = req.body;

    // Check database connection
    if (mongoose.connection.readyState === 1) {
      try {
        const userExists = await User.findOne({ email });
        if (userExists) {
          return res.status(400).json({ message: 'User already exists with this email' });
        }

        const user = await User.create({
          name,
          email,
          password,
          role: role || 'customer',
          specialty: specialty || 'General'
        });

        if (user) {
          return res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            specialty: user.specialty,
            rating: user.rating,
            token: generateToken(user._id)
          });
        }
      } catch (dbError) {
        console.log('📌 DB error, falling back to mock user registration');
      }
    }

    // Fallback mock mode
    console.log('📌 DB offline/mock mode, using mock user registration');
    const mockUser = {
      _id: 'user_' + Date.now(),
      name,
      email,
      role: role || 'customer',
      specialty: specialty || 'General',
      rating: 5.0,
      token: generateToken('user_' + Date.now())
    };
    mockUsers.push({ ...mockUser, password });
    return res.status(201).json(mockUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (mongoose.connection.readyState === 1) {
      try {
        const user = await User.findOne({ email });
        if (user && (await user.matchPassword(password))) {
          return res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            specialty: user.specialty,
            rating: user.rating,
            avatar: user.avatar,
            token: generateToken(user._id)
          });
        } else if (user) {
          return res.status(401).json({ message: 'Invalid email or password' });
        }
      } catch (dbError) {
        console.log('📌 DB offline, checking mock user login');
      }
    }

    // Check mock users for quick demo login
    const foundMock = mockUsers.find(u => u.email === email && u.password === password);
    if (foundMock) {
      return res.json({
        _id: foundMock._id,
        name: foundMock.name,
        email: foundMock.email,
        role: foundMock.role,
        specialty: foundMock.specialty || 'General',
        rating: foundMock.rating || 5.0,
        avatar: foundMock.avatar,
        token: generateToken(foundMock._id)
      });
    }

    return res.status(401).json({ message: 'Invalid credentials. Tip: use customer@demo.com, worker@demo.com, or admin@demo.com with password123' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    if (req.user) {
      return res.json(req.user);
    }
    res.status(404).json({ message: 'User not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
