const getHome = (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the Express.js API',
  });
};

const getHealth = (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    uptime: process.uptime(),
  });
};

module.exports = { getHome, getHealth };
