"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const userRoute_1 = __importDefault(require("./src/routes/userRoute"));
const taskRoute_1 = __importDefault(require("./src/routes/taskRoute"));
const payRoute_1 = __importDefault(require("./src/routes/payRoute"));
const apiRoute_1 = __importDefault(require("./src/routes/apiRoute"));
const path = require("path");
const authRoute_1 = __importDefault(require("./src/routes/authRoute"));
const User_1 = __importDefault(require("./src/models/User"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 8000;
const server = http_1.default.createServer(app);
const wss = new ws_1.Server({ server });
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const uri = process.env.DB_URI;
const d = process.env.POSTMARK_API_TOKEN;
//init routes
app.use("/u", userRoute_1.default);
app.use("/api", apiRoute_1.default);
app.post("/auth", authRoute_1.default);
app.use("/task", taskRoute_1.default);
app.use("/pay", payRoute_1.default);
// Route to serve the success page
app.get("/success", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "success.html"));
});
// Connect to MongoDB
mongoose_1.default
    .connect(uri)
    .then(() => {
    console.log("Connected to MongoDB");
})
    .catch((error) => {
    console.error("Error connecting to MongoDB", error);
});
app.get("/", (req, res) => {
    res.send("Hello, world!");
});
// Store connections
const connections = {};
wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get("userId");
    if (userId) {
        // connections[userId] = ws;
        console.log(`User ${userId} connected`);
        const ws = connections[userId];
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                event: "subscription_updated",
                subscription: "plus",
            }));
            console.log(`Notification sent to user ${userId}`);
        }
        else {
            console.log(`User ${userId} is not connected or socket is not open`);
        }
        ws.on("close", () => {
            delete connections[userId];
            console.log(`User ${userId} disconnected`);
        });
    }
    else {
        ws.close();
        console.log("Connection closed due to missing userId");
    }
});
// This is a server-side pseudo-code example
app.post("/catwebhook", express_1.default.json({ type: "application/json" }), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const event = req.body;
    // Assume 'User' is your user model and has a method 'findByIdAndUpdate'
    // Assume 'subscriptionStatus' is a property on your user model that indicates the subscription level
    try {
        switch (event.event.type) {
            case "INITIAL_PURCHASE":
                yield User_1.default.findByIdAndUpdate(event.event.app_user_id, {
                    subscription: "plus",
                });
                break;
            case "RENEWAL":
                // Update user to active subscription
                yield User_1.default.findByIdAndUpdate(event.event.app_user_id, {
                    subscription: "plus",
                });
                break;
            case "NON_RENEWING_PURCHASE":
                // Handle one-time purchase
                break;
            case "CANCELLATION":
                // Update user to reflect the cancellation
                yield User_1.default.findByIdAndUpdate(event.event.app_user_id, {
                    subscription: "standard",
                });
                break;
            case "PRODUCT_CHANGE":
                // Update user to reflect their new subscription product
                break;
            case "UNCANCELLATION":
                // Handle reactivated subscription
                yield User_1.default.findByIdAndUpdate(event.event.app_user_id, {
                    subscription: "plus",
                });
                break;
            case "BILLING_ISSUE":
                // Update user to reflect billing issue (e.g., payment failed)
                yield User_1.default.findByIdAndUpdate(event.event.app_user_id, {
                    subscription: "standard",
                });
                break;
            case "SUBSCRIBER_ALIAS":
                // Update the user record if aliases are used in your system
                break;
            case "PAUSE":
                // Handle subscription pause
                break;
            case "EXPIRATION":
                // Update user to reflect expired subscription
                yield User_1.default.findByIdAndUpdate(event.event.app_user_id, {
                    subscription: "standard",
                });
                break;
            case "OFFER_REDEEMED":
                // Handle redemption of an offer code
                break;
            default:
                console.log("Unhandled event type:", event.event.type);
                break;
        }
        res.status(200).send("Received");
    }
    catch (error) {
        console.error("Error handling RevenueCat webhook:", error);
        res.status(500).send("Internal Server Error");
    }
}));
app.post("/webhook", express_1.default.json({ type: "application/json" }), (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    const event = request.body;
    try {
        // Handle the event
        switch (event.type) {
            case "checkout.session.completed":
                const checkoutSession = event.data.object;
                if (checkoutSession.mode === "subscription") {
                    const userId = checkoutSession.metadata.userId;
                    if (!userId) {
                        console.error("User ID is missing in metadata");
                        return response
                            .status(400)
                            .send("Metadata is missing the user ID");
                    }
                    const user = yield User_1.default.findByIdAndUpdate(userId, { subscription: "plus" }, { new: true });
                    if (!user) {
                        console.error(`User not found for ID: ${userId}`);
                        return response
                            .status(404)
                            .send(`User not found for ID: ${userId}`);
                    }
                    console.log(`User subscription updated to 'plus' for user ID: ${userId}`);
                    // Notify frontend
                    const ws = connections[userId];
                    if (ws && ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            event: "subscription_updated",
                            subscription: "plus",
                        }));
                        console.log(`Notification sent to user ${userId}`);
                    }
                    else {
                        console.log(`User ${userId} is not connected or socket is not open`);
                    }
                }
                break;
            // Handle other event types as needed
            case "invoice.payment_failed":
                const invoice = event.data.object;
                const userId = invoice.metadata.userId;
                if (!userId) {
                    console.error("User ID is missing in metadata");
                    return response.status(400).send("Metadata is missing the user ID");
                }
                const user = yield User_1.default.findByIdAndUpdate(userId, { subscription: "standard" }, { new: true });
                if (!user) {
                    console.error(`User not found for ID: ${userId}`);
                    return response
                        .status(404)
                        .send(`User not found for ID: ${userId}`);
                }
                console.log(`User subscription updated to 'standard' for user ID: ${userId}`);
                // Notify frontend (if needed)
                const ws = connections[userId];
                if (ws && ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        event: "subscription_updated",
                        subscription: "standard",
                    }));
                    console.log(`Notification sent to user ${userId}`);
                }
                else {
                    console.log(`User ${userId} is not connected or socket is not open`);
                }
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
        // Return a response to acknowledge receipt of the event
        response.json({ received: true });
    }
    catch (error) {
        console.error("Error in webhook handler:", error);
        response.status(500).send("Internal Server Error");
    }
}));
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
