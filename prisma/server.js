const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Zdna limit bch tssehel envoi mta3 les images Base64

// ==================== AUTH ====================

// Login via email + password
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }
  const normalizedEmail = email.toLowerCase();
  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({ error: "Aucun compte trouvé avec cet email." });
    }
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Mot de passe incorrect." });
    }
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la connexion', details: error.message });
  }
});

// Create Account: unique email (stored lowercase) + unique username
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Nom d'utilisateur, email et mot de passe requis." });
  }
  const normalizedEmail = email.toLowerCase();
  try {
    const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) {
      return res.status(409).json({ error: "Un compte existe déjà avec cet email." });
    }
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const memberId = 'GA-' + Math.floor(100000 + Math.random() * 900000);

    const newUser = await prisma.user.create({
      data: {
        username,
        email: normalizedEmail,
        password: hashedPassword,
        memberId,
        role: 'user'
      }
    });

    const { password: _pw, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création du compte', details: error.message });
  }
});

// Get All Posts (With No-Cache Headers)
app.get('/api/posts', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const posts = await prisma.post.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching posts', details: error.message });
  }
});

// Create New Post (Admin)
app.post('/api/posts', async (req, res) => {
  const { title, description, price, image, categoryId } = req.body;
  try {
    const newPost = await prisma.post.create({
      data: {
        title,
        description,
        price: price ? parseFloat(price) : null,
        image,
        categoryId
      }
    });
    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ error: 'Error creating post', details: error.message });
  }
});

// Get Categories
app.get('/api/categories', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const categories = await prisma.category.findMany({
      include: { posts: true }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching categories', details: error.message });
  }
});

// Create New Category (Admin) - HEDHI ELLI KANET NA9SA
app.post('/api/categories', async (req, res) => {
  const { name, image } = req.body;
  try {
    const newCategory = await prisma.category.create({
      data: {
        name,
        image
      }
    });
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ error: 'Error creating category', details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});