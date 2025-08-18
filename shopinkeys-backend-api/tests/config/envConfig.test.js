const { PORT, MONGODB_URI, JWT_SECRET } = require("../../config/envConfig");

describe("Environment Configuration", () => {
  test("PORT should have a default value", () => {
    expect(PORT).toBeDefined();
    expect(typeof PORT).toBe("number");
  });

  test("MONGODB_URI should have a default fallback", () => {
    expect(MONGODB_URI).toBeDefined();
    expect(typeof MONGODB_URI).toBe("string");
  });

  test("JWT_SECRET should have a default fallback", () => {
    expect(JWT_SECRET).toBeDefined();
    expect(typeof JWT_SECRET).toBe("string");
  });
});
