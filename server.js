const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Zdna limit bch tssehel envoi mta3 les images Base64

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