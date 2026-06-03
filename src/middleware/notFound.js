const notFound = (req, res, next) => {
  const error = new Error(`Endpoint tidak ditemukan: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = notFound;
