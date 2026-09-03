import mongoose from 'mongoose';
import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import { connectDB } from '../config/db.js';

// In-memory mock storage if MongoDB is not connected
let mockUsers = [];

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, specialty } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    if (!cleanEmail || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Ensure database connection
    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB();
      } catch (e) {
        console.log('📌 DB connection attempt failed in register');
      }
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const userExists = await User.findOne({ email: cleanEmail });
        if (userExists) {
          return res.status(400).json({ message: 'User already exists with this email' });
        }

        const user = await User.create({
          name: name ? name.trim() : 'User',
          email: cleanEmail,
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
        console.log('📌 DB error in registration:', dbError.message);
        return res.status(500).json({ message: 'Database error creating account: ' + dbError.message });
      }
    }

    // Fallback mock mode only if DB is truly offline
    console.log('📌 DB offline, using mock user registration');
    const mockUser = {
      _id: 'user_' + Date.now(),
      name: name ? name.trim() : 'User',
      email: cleanEmail,
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
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    if (!cleanEmail || !password) {
      return res.status(400).json({ message: 'Please enter both email and password' });
    }

    // Ensure database connection
    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB();
      } catch (e) {
        console.log('📌 DB connection attempt failed in login');
      }
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const user = await User.findOne({ email: cleanEmail });
        if (user) {
          const isMatch = await user.matchPassword(password);
          if (isMatch) {
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
          } else {
            return res.status(401).json({ message: 'Invalid password. Please check your password.' });
          }
        } else {
          return res.status(401).json({ message: 'No account found with this email. Please register first.' });
        }
      } catch (dbError) {
        console.log('📌 DB query error in login:', dbError.message);
      }
    }

    // Check mock users for quick demo login if DB query missed
    const foundMock = mockUsers.find(
      u => u.email?.toLowerCase() === cleanEmail && u.password === password
    );
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

    return res.status(401).json({ message: 'Invalid email or password' });
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

// @desc    Get all registered workers for customer booking
// @route   GET /api/auth/workers
// @access  Public
export const getWorkers = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      try {
        const workers = await User.find({ role: 'worker' }).select('-password');
        return res.json(workers);
      } catch (dbError) {
        console.log('📌 DB error fetching workers');
      }
    }
    const mockFiltered = mockUsers.filter(u => u.role === 'worker');
    return res.json(mockFiltered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile / password
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { name, password, specialty, avatar } = req.body;
    const userId = req.user?._id;

    if (mongoose.connection.readyState === 1 && userId) {
      try {
        const user = await User.findById(userId);
        if (user) {
          if (name) user.name = name;
          if (specialty) user.specialty = specialty;
          if (avatar !== undefined) user.avatar = avatar;
          if (password) user.password = password;

          const updated = await user.save();
          return res.json({
            _id: updated._id,
            name: updated.name,
            email: updated.email,
            role: updated.role,
            specialty: updated.specialty,
            rating: updated.rating,
            avatar: updated.avatar,
            token: generateToken(updated._id)
          });
        }
      } catch (dbError) {
        console.log('📌 DB error updating profile');
      }
    }

    // Mock fallback update
    const userIndex = mockUsers.findIndex(u => u._id === userId || u.email === req.user?.email);
    if (userIndex !== -1) {
      if (name) mockUsers[userIndex].name = name;
      if (specialty) mockUsers[userIndex].specialty = specialty;
      if (avatar !== undefined) mockUsers[userIndex].avatar = avatar;
      if (password) mockUsers[userIndex].password = password;
      return res.json(mockUsers[userIndex]);
    }

    const updatedMock = {
      ...req.user,
      name: name || req.user?.name,
      specialty: specialty || req.user?.specialty,
      avatar: avatar !== undefined ? avatar : req.user?.avatar
    };
    return res.json(updatedMock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

