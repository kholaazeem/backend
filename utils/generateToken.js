import jwt from 'jsonwebtoken';

export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supportflow_secret_key', {
    expiresIn: '30d'
  });
};
