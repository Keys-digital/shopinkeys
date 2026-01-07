const i18next = require("../config/i18nConfig");

describe("Localization Verification", () => {
    beforeAll(async () => {
        // Ensure i18next is initialized. 
        // Since i18nConfig calling init() might be async for FS backend, we wait a bit or force load.
        // changeLanguage triggers a load.
        await i18next.changeLanguage("en");
    });

    test("should resolve auth keys correctly", () => {
        const key = "auth:login_success";
        const translation = i18next.t(key);
        expect(translation).toBe("Login successful.");
        expect(translation).not.toBe(key);
    });

    test("should resolve flattened auth keys", () => {
        const key = "auth:registration_success";
        const translation = i18next.t(key);
        expect(translation).toContain("Registration successful");
        expect(translation).not.toBe(key);
    });

    test("should resolve error keys correctly", () => {
        const key = "errors:bad_request";
        const translation = i18next.t(key);
        expect(translation).toBe("Bad request.");
        expect(translation).not.toBe(key);
    });

    test("should resolve internal server error from errors namespace", () => {
        const key = "errors:internal_server";
        const translation = i18next.t(key);
        expect(translation).toBe("An unexpected error occurred.");
        expect(translation).not.toBe(key);
    });

    test("should resolve newly added auth keys", () => {
        expect(i18next.t("auth:logout_success")).toBe("Logout successful.");
        expect(i18next.t("auth:missing_verification_token")).toBe("Verification token is missing.");
        expect(i18next.t("auth:password_required")).toBe("Password is required.");
        expect(i18next.t("auth:verification_email_sent")).toBe("Verification email has been sent.");
    });
});
