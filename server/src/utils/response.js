export function successResponse(res, data = {}, message = 'Operation completed successfully', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message
  });
}

export function paginatedResponse(res, data = [], pagination = {}, message = 'Data retrieved successfully', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    pagination: {
      page: Number(pagination.page) || 1,
      limit: Number(pagination.limit) || 20,
      total: Number(pagination.total) || data.length,
      totalPages: Math.ceil((Number(pagination.total) || data.length) / (Number(pagination.limit) || 20))
    },
    message
  });
}

export function errorResponse(res, message = 'An error occurred', statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
  const payload = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
}
