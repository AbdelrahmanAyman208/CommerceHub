/**
 * Helper to parse pagination parameters and format responses
 */
function getPaginationParams(req, defaultLimit = 20, maxLimit = 100) {
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function formatPaginatedResponse(items, totalCount, page, limit) {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: items,
    pagination: {
      total: parseInt(totalCount, 10),
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

module.exports = {
  getPaginationParams,
  formatPaginatedResponse,
};
