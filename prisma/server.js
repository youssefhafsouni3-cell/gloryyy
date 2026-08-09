const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit bch tssehel envoi mta3 les images Base64

// Map temporaire pour stocker les inscriptions en attente de vérification
const pendingUsers = new Map();

// Configuration Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Votre email Gmail
    pass: process.env.EMAIL_PASS  // Mot de passe d'application Gmail
  }
});

// ==================== AUTHENTICATION ====================

// 1. Login via email + password
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Champs manquants." });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(400).json({ error: "Email ou mot de passe incorrect." });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: "Email ou mot de passe incorrect." });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ message: "Connexion réussie", user: userWithoutPassword });

  } catch (error) {
    console.error("LOGIN ERROR DETAILS:", error);
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
});

// 2. Demande d'inscription : Envoi du code de vérification par email
app.post('/api/register-pending', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Nom d'utilisateur, email et mot de passe requis." });
  }

  const normalizedEmail = email.toLowerCase();

  try {
    // Vérification de l'existence de l'email ou du username
    const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) {
      return res.status(409).json({ error: "Un compte existe déjà avec cet email." });
    }

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });
    }

    // Génération du code à 6 chiffres
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Stockage temporaire en mémoire
    pendingUsers.set(normalizedEmail, {
      username,
      email: normalizedEmail,
      password,
      code: verificationCode,
      createdAt: Date.now()
    });

    // Envoi de l'email
    await transporter.sendMail({
      from: `"Glory Aures" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Code de vérification - Glory Aures Portal",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; rounded: 10px;">
          <h2 style="color: #0f172a;">Bienvenue sur Glory Aures Portal !</h2>
          <p style="color: #475569;">Voici votre code de vérification pour confirmer votre compte :</p>
          <div style="background-color: #f0fdf4; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #059669; letter-spacing: 6px; font-size: 32px; margin: 0;">${verificationCode}</h1>
          </div>
          <p style="color: #64748b; font-size: 12px;">Ce code est confidentiel et expire dans 10 minutes.</p>
        </div>
      `
    });

    res.json({ message: "Code de vérification envoyé par email." });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'envoi du code", details: error.message });
  }
});

// 3. Vérification du code et création définitive du compte
app.post('/api/verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Email et code requis." });
  }

  const normalizedEmail = email.toLowerCase();
  const pending = pendingUsers.get(normalizedEmail);

  if (!pending) {
    return res.status(400).json({ error: "Aucune demande d'inscription trouvée pour cet email." });
  }

  if (pending.code !== code.trim()) {
    return res.status(400).json({ error: "Code de vérification incorrect." });
  }

  try {
    const hashedPassword = await bcrypt.hash(pending.password, 10);
    const memberId = 'GA-' + Math.floor(100000 + Math.random() * 900000);

    const newUser = await prisma.user.create({
      data: {
        username: pending.username,
        email: pending.email,
        password: hashedPassword,
        memberId,
        role: 'user'
      }
    });

    // Nettoyage de la mémoire temporaire
    pendingUsers.delete(normalizedEmail);

    const { password: _pw, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création du compte', details: error.message });
  }
});

// Ancienne route d'inscription directe (conservée si besoin)
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

// ==================== POSTS / PRODUITS ====================

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

app.delete('/api/posts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.post.delete({ where: { id } });
    res.json({ message: 'Post supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting post', details: error.message });
  }
});

// ==================== CATEGORIES ====================

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

app.post('/api/categories', async (req, res) => {
  const { name, image } = req.body;
  try {
    const newCategory = await prisma.category.create({
      data: { name, image }
    });
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ error: 'Error creating category', details: error.message });
  }
});

// ✅ الكود الصحيح: يحذف المنتجات التابعة للكاتيجوري أولاً ثم يحذف الكاتيجوري
app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. حذف جميع المنتجات المرتبطة بهذه الكاتيجوري
    await prisma.post.deleteMany({
      where: { categoryId: id }
    });

    // 2. حذف الكاتيجوري نفسها بعد إفرغها
    await prisma.category.delete({
      where: { id }
    });

    res.json({ message: 'Catégorie et ses produits supprimés avec succès' });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: 'Error deleting category', details: error.message });
  }
});

// ==================== CATALOGUES ====================

app.get('/api/catalogues', async (req, res) => {
  try {
    const catalogues = await prisma.catalogue.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(catalogues);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching catalogues', details: error.message });
  }
});

app.post('/api/catalogues', async (req, res) => {
  const { name, dateFrom, dateTo, image } = req.body;
  try {
    const newCatalogue = await prisma.catalogue.create({
      data: { name, dateFrom, dateTo, image }
    });
    res.status(201).json({ catalogue: newCatalogue });
  } catch (error) {
    res.status(500).json({ error: 'Error creating catalogue', details: error.message });
  }
});

// ==================== ORDERS / COMMANDES ====================

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching orders', details: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { username, productTitle, productImage, categoryName, fullname, email, phone, quantity, status } = req.body;
  try {
    const newOrder = await prisma.order.create({
      data: {
        username,
        productTitle,
        productImage,
        categoryName,
        fullname,
        email,
        phone,
        quantity: parseInt(quantity),
        status: status || 'pending'
      }
    });
    res.status(201).json({ order: newOrder });
  } catch (error) {
    res.status(500).json({ error: 'Error creating order', details: error.message });
  }
});

// ==================== DÉMARRAGE DU SERVEUR ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});