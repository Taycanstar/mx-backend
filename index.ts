import express, { Request, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import UserRoute from "./src/routes/userRoute";
import TaskRoute from "./src/routes/taskRoute";
import PayRoute from "./src/routes/payRoute";
import ApiRoute from "./src/routes/apiRoute";
const path = require("path");
import AuthRoute from "./src/routes/authRoute";
import User, { IUser } from "./src/models/User";
import http from "http";

import { Server, WebSocket as WS } from "ws";

interface WebSocket extends WS {
  // Add any additional properties/methods if needed
}

dotenv.config();

const app = express();
const port: number = Number(process.env.PORT) || 8000;
const server = http.createServer(app);
const wss = new Server({ server });

app.use(cors());
app.use(express.json());
const uri: string = process.env.DB_URI!;
const d: string = process.env.POSTMARK_API_TOKEN!;

//init routes
app.use("/u", UserRoute);
app.use("/api", ApiRoute);
app.post("/auth", AuthRoute);
app.use("/task", TaskRoute);
app.use("/pay", PayRoute);
// Route to serve the success page
app.get("/success", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "public", "success.html"));
});

// Connect to MongoDB
mongoose
  .connect(uri)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB", error);
  });

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, world!");
});

// Store connections
const connections: { [userId: string]: WebSocket } = {};

wss.on("connection", (ws, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const userId = url.searchParams.get("userId");
  if (userId) {
    // connections[userId] = ws;
    console.log(`User ${userId} connected`);

    const ws = connections[userId];
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          event: "subscription_updated",
          subscription: "plus",
        })
      );
      console.log(`Notification sent to user ${userId}`);
    } else {
      console.log(`User ${userId} is not connected or socket is not open`);
    }

    ws.on("close", () => {
      delete connections[userId];
      console.log(`User ${userId} disconnected`);
    });
  } else {
    ws.close();
    console.log("Connection closed due to missing userId");
  }
});

// This is a server-side pseudo-code example
app.post(
  "/catwebhook",
  express.json({ type: "application/json" }),
  async (req, res) => {
    const event = req.body;

    // Assume 'User' is your user model and has a method 'findByIdAndUpdate'
    // Assume 'subscriptionStatus' is a property on your user model that indicates the subscription level

    try {
      switch (event.event.type) {
        case "INITIAL_PURCHASE":
          await User.findByIdAndUpdate(event.event.app_user_id, {
            subscription: "plus",
          });
          break;
        case "RENEWAL":
          // Update user to active subscription
          await User.findByIdAndUpdate(event.event.app_user_id, {
            subscription: "plus",
          });
          break;

        case "NON_RENEWING_PURCHASE":
          // Handle one-time purchase
          break;

        case "CANCELLATION":
          // Update user to reflect the cancellation
          await User.findByIdAndUpdate(event.event.app_user_id, {
            subscription: "standard",
          });
          break;

        case "PRODUCT_CHANGE":
          // Update user to reflect their new subscription product
          break;

        case "UNCANCELLATION":
          // Handle reactivated subscription
          await User.findByIdAndUpdate(event.event.app_user_id, {
            subscription: "plus",
          });
          break;

        case "BILLING_ISSUE":
          // Update user to reflect billing issue (e.g., payment failed)
          await User.findByIdAndUpdate(event.event.app_user_id, {
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
          await User.findByIdAndUpdate(event.event.app_user_id, {
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
    } catch (error) {
      console.error("Error handling RevenueCat webhook:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.post(
  "/webhook",
  express.json({ type: "application/json" }),
  async (request, response) => {
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

            const user = await User.findByIdAndUpdate(
              userId,
              { subscription: "plus" },
              { new: true }
            );

            if (!user) {
              console.error(`User not found for ID: ${userId}`);
              return response
                .status(404)
                .send(`User not found for ID: ${userId}`);
            }

            console.log(
              `User subscription updated to 'plus' for user ID: ${userId}`
            );
            // Notify frontend
            const ws = connections[userId];
            if (ws && ws.readyState === ws.OPEN) {
              ws.send(
                JSON.stringify({
                  event: "subscription_updated",
                  subscription: "plus",
                })
              );
              console.log(`Notification sent to user ${userId}`);
            } else {
              console.log(
                `User ${userId} is not connected or socket is not open`
              );
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

          const user = await User.findByIdAndUpdate(
            userId,
            { subscription: "standard" },
            { new: true }
          );

          if (!user) {
            console.error(`User not found for ID: ${userId}`);
            return response
              .status(404)
              .send(`User not found for ID: ${userId}`);
          }

          console.log(
            `User subscription updated to 'standard' for user ID: ${userId}`
          );
          // Notify frontend (if needed)
          const ws = connections[userId];
          if (ws && ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({
                event: "subscription_updated",
                subscription: "standard",
              })
            );
            console.log(`Notification sent to user ${userId}`);
          } else {
            console.log(
              `User ${userId} is not connected or socket is not open`
            );
          }
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      // Return a response to acknowledge receipt of the event
      response.json({ received: true });
    } catch (error) {
      console.error("Error in webhook handler:", error);
      response.status(500).send("Internal Server Error");
    }
  }
);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
