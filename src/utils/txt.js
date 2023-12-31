"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyNumber = exports.sendVerificationCode = void 0;
// sms.ts
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const twilio_1 = __importDefault(require("twilio"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../../.env") });
const accountSid = "AC19b6c353cf189d17546df9b1e701f384";
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = "VAd28020f6071a8321695bba3698575001";
const client = (0, twilio_1.default)(accountSid, authToken);
const sendVerificationCode = (number) => {
    return client.verify.v2.services(verifySid).verifications.create({
        to: number,
        channel: "sms",
    });
};
exports.sendVerificationCode = sendVerificationCode;
const verifyNumber = (number, otpCode) => {
    return client.verify.v2
        .services(verifySid)
        .verificationChecks.create({ to: number, code: otpCode });
};
exports.verifyNumber = verifyNumber;
