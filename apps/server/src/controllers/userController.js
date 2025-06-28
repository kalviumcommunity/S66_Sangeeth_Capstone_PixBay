import prisma from '../db.js'

export const checkUserExists = async (req, res) => {
  try {
    const { email } = req.query;
    // console.log('Checking user with email:', email);

    if (!email) {
      // console.log('Email missing in query parameters');
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { 
        id: true, 
        name: true,
        email: true
      },
    });

    if (user) {
      // console.log('User found:', user); // Add this to debug
      res.status(200).json({ 
        exists: true, 
        id: user.id,  // Make sure this is being sent
        name: user.name,
        hasName: !!user.name // Add this to explicitly check if name exists
      });
    } else {
      res.status(200).json({ exists: false });
    }
  } catch (error) {
    console.error('Error in checkUserExists:', error);
    res.status(500).json({ 
      error: 'Failed to check user existence',
      details: error.message 
    });
  }
};

export const createUser = async (req, res) => {
  try {
    const { email, name, role } = req.body;
    // console.log('Creating user with:', { email, name, role });

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role || 'MEMBER',
      },
    });
    // console.log('User created:', user);

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    console.error('Error in createUser:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const getUser = async (req, res) => {
    try {
      const { id } = req.params;
  
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          // projects: true, 
          workspaces: true, 
        },
      });
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      res.status(200).json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  };

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, role } = req.body;

    // console.log('Updating user with ID:', id);
    // console.log('Update data:', { email, name, role });

    // First check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      // console.log(`User with ID ${id} not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    // If user exists, proceed with update
    const user = await prisma.user.update({
      where: { id },
      data: {
        email: email || undefined,
        name: name || undefined,
        role: role || undefined,
      },
    });

    // console.log('User updated successfully:', user);
    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    if (error.code === 'P2025') { // Prisma error for record not found
      // console.log('Prisma record not found error:', error);
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Error in updateUser:', error);
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
};

export const updateUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const { name, role } = req.body;
    
    // console.log('Updating user with email:', email);
    // console.log('Update data:', { name, role });

    // First check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      // console.log(`User with email ${email} not found, creating new user`);
      // Create new user if not found
      const newUser = await prisma.user.create({
        data: {
          email,
          name,
          role: role || 'MEMBER',
        },
      });
      return res.status(201).json({ message: 'User created successfully', user: newUser });
    }

    // Update existing user
    const user = await prisma.user.update({
      where: { email },
      data: {
        name: name || undefined,
        role: role || undefined,
      },
    });

    // console.log('User updated successfully:', user);
    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Error in updateUserByEmail:', error);
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
};

export const deleteUser = async (req, res) => {
    try {
      const { id } = req.params;
  
      await prisma.user.delete({
        where: { id },
      });
  
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      console.error(error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  };

