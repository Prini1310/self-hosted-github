'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth.middleware');

const VALID_USERS = [
  { username: 'prabhaharan', password: 'admin123' },
  { username: 'friend', password: 'dev123' },
  { username: 'admin', password: 'admin123' }
];

const { validate } = require('../middleware/validate.middleware');

/**
 * @api {post} /api/auth/login Login user
 * @apiName Login
 * @apiGroup Auth
 * @apiBody {String} username User name
 * @apiBody {String} password Password
 * @apiSuccess (200) {String} token JWT access token
 * @apiSuccess (200) {String} username Authenticated username
 * @apiSuccess (200) {String} expiresIn Token expiration timeframe
 * @apiError (401) {String} error Invalid credentials message
 */
router.post('/login', validate(['username', 'password']), (req, res) => {
  const { username, password } = req.body;
  const user = VALID_USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({
    token,
    username,
    expiresIn: '8h'
  });
});

/**
 * @api {post} /api/auth/verify Verify token
 * @apiName Verify
 * @apiGroup Auth
 * @apiHeader {String} Authorization Bearer token
 * @apiSuccess (200) {Boolean} valid Status flag
 * @apiSuccess (200) {Object} user Decoded user object
 * @apiError (401) {String} error Invalid token message
 */
router.post('/verify', auth, (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;
