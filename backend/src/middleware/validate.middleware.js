/**
 * Returns an Express middleware that validates required fields in req.body.
 * Usage: router.post('/path', validate(['field1', 'field2']), controller)
 */
function validate(requiredFields) {
  return (req, res, next) => {
    const missing = requiredFields.filter(f => {
      const alternatives = f.split('|');
      const hasAtLeastOne = alternatives.some(alt => {
        const val = req.body[alt];
        return val !== undefined && val !== null && val !== '';
      });
      return !hasAtLeastOne;
    });
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }
    next();
  };
}

module.exports = { validate };
