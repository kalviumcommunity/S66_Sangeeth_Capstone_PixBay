import { requireAuth, clerkClient } from '@clerk/express';

const authMiddleware = async (req, res, next) => {
  // console.log('authMiddleware triggered');
  // Use requireAuth to ensure the user is authenticated and attach req.auth
  requireAuth({
    onError: (req, res) => {
      res.status(401).json({ error: 'Unauthenticated' });
    },
  })(req, res, async (err) => {
    if (err) return next(err);

    try {
      // Fetch the user's details from Clerk using userId
      const user = await clerkClient.users.getUser(req.auth.userId);

      // Attach emailAddresses to req.auth
      req.auth.emailAddresses = user.emailAddresses;

      next();
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};

export default authMiddleware;
// import { requireAuth, clerkClient } from '@clerk/express';

// const authMiddleware = async (req, res, next) => {
//   console.log('authMiddleware triggered');
//   console.log('Request headers:', req.headers);
//   console.log('Request cookies:', req.cookies); // if using cookies

//   // Use requireAuth to ensure the user is authenticated and attach req.auth
//   requireAuth({
//     onError: (req, res) => {
//       res.status(401).json({ error: 'Unauthenticated' });
//     },
//   })(req, res, async (err) => {
//     if (err) {
//       console.error('Error in requireAuth:', err);
//       return next(err);
//     }

//     try {
//       console.log('req.auth after requireAuth:', req.auth);
//       // Fetch the user's details from Clerk using userId
//       const user = await clerkClient.users.getUser(req.auth.userId);
//       console.log('Fetched Clerk user:', user);

//       // Attach emailAddresses to req.auth
//       req.auth.emailAddresses = user.emailAddresses;
//       next();
//     } catch (error) {
//       console.error('Error fetching user details:', error);
//       res.status(500).json({ error: 'Internal server error' });
//     }
//   });
// };

// export default authMiddleware;
