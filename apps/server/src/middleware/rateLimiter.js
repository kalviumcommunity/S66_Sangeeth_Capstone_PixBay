import rateLimit from "express-rate-limit";

const projectPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 10 requests per windowMs
  message: "Too many project creation attempts from this IP, please try again later.",
});

export default projectPostLimiter;