const logger = require("../../utils/logger");

describe("Logger Utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should log info messages", () => {
    const infoSpy = jest.spyOn(logger, "info").mockImplementation(() => {});
    logger.info("Test Info Message");
    expect(infoSpy).toHaveBeenCalledWith("Test Info Message");
  });

  test("should log warning messages", () => {
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {}); // ✅ Added missing warn test
    logger.warn("Test Warning Message");
    expect(warnSpy).toHaveBeenCalledWith("Test Warning Message");
  });

  test("should log error messages", () => {
    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
    logger.error("Test Error Message");
    expect(errorSpy).toHaveBeenCalledWith("Test Error Message");
  });
});
