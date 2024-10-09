import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes.js";
import messagesRoute from "./routes/messagesRoutes.js";
import { Server as socketIO } from "socket.io";
import path from "path";
import dotenv from "dotenv"; 

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Error: ", err.message);
  });

const app = express();
app.use(cors());
app.use(express.json());

// Define the directory path
const __dirname = path.resolve();

// Set up routes
app.use("/api/auth", userRoutes);
app.use("/api/messages", messagesRoute); // Assuming `messagesRoute` is properly imported

// Serve static files from the client build
app.use(express.static(path.join(__dirname, "client", "dist")));

// Handle all other GET requests and serve the index.html
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "client", "dist", "index.html"))
);

// Start the server
const server = app.listen(process.env.PORT, () => {
  console.log(`Server is running on port: ${process.env.PORT}`);
});

// Set up Socket.IO
const io = new socketIO(server, {
  cors: {
    origin: process.env.ORIGIN,
    credentials: true,
  },
});

global.onlineUsers = new Map();

io.on("connection", (socket) => {
  global.chatSocket = socket;

  // Listen for new user additions
  socket.on("add-user", (userId) => {
    onlineUsers.set(userId, socket.id);
  });

  // Listen for incoming messages
  socket.on("send-msg", (data) => {
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("msg-receive", data.message);
    }
  });
});
