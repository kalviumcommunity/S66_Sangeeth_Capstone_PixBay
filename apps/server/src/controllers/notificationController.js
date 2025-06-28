import prisma from "../db.js";

export const getUserNotifications = async (req, res) => {
  try {
    const { emailAddresses } = req.auth;
    const email = emailAddresses?.[0]?.emailAddress;

    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    // console.log("Authenticated user:", user);
    // console.log("User ID for query:", user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(req.query.unread === "true" && { isRead: false }),
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { emailAddresses } = req.auth;
    const email = emailAddresses?.[0]?.emailAddress;

    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id: id },
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    if (notification.userId !== user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: id },
      data: { isRead: true },
    });

    res.status(200).json(updatedNotification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};
