import { jest } from "@jest/globals";

// Mock request/response factory helpers for controller unit tests

export const mockRequest = (overrides = {}) => {
  return {
    body: {},
    params: {},
    query: {},
    user: null,
    files: null,
    file: null,
    headers: {},
    cookies: {},
    ...overrides,
  };
};

export const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

// Creates a mock Mongoose model with common static methods
export const createMockModel = (name) => {
  const mockDoc = {
    _id: "mock-id-123",
    save: jest.fn().mockResolvedValue(true),
    populate: jest.fn().mockResolvedValue(true),
    toObject: jest.fn().mockReturnThis(),
  };

  const model = jest.fn().mockImplementation((data) => ({
    ...mockDoc,
    ...data,
    save: jest.fn().mockResolvedValue({ ...mockDoc, ...data }),
    populate: jest.fn().mockResolvedValue({ ...mockDoc, ...data }),
  }));

  // Static methods
  model.find = jest.fn().mockReturnValue({
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  });
  model.findOne = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null),
  });
  model.findById = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null),
  });
  model.findByIdAndDelete = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(null),
  });
  model.countDocuments = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(0),
  });
  model.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
  model.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 0 });
  model.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });
  model.aggregate = jest.fn().mockResolvedValue([]);
  model.distinct = jest.fn().mockResolvedValue([]);

  return model;
};
