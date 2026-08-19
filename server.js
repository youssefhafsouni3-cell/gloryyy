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

// Un code de verification expire apres 10 minutes
const CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Configuration Nodemailer
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
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

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(400).json({ error: "Email ou mot de passe incorrect." });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: "Email ou mot de passe incorrect." });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ message: "Connexion reussie", user: userWithoutPassword });

  } catch (error) {
    console.error("LOGIN ERROR DETAILS:", error);
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
});

// 2. Demande d'inscription : Envoi du code de verification par email
//    Le brouillon d'inscription est desormais stocke en base (PendingRegistration)
//    au lieu d'une Map en memoire, qui etait videe a chaque redemarrage/cold-start
//    du serveur -> c'etait la cause principale des inscriptions qui "ne marchaient plus".
app.post('/api/register-pending', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Nom d'utilisateur, email et mot de passe requis." });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 4 caracteres." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.trim();

  try {
    // Verification de l'existence de l'email ou du username (comptes deja confirmes)
    const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) {
      return res.status(409).json({ error: "We already have an account with this email" });
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (existingUsername) {
      return res.status(409).json({ error: "Ce nom d'utilisateur est deja pris." });
    }

    // Generation du code a 6 chiffres
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Stockage persistant (upsert -> permet aussi le "renvoyer le code")
    await prisma.pendingRegistration.upsert({
      where: { email: normalizedEmail },
      update: {
        username: normalizedUsername,
        password: hashedPassword,
        code: verificationCode,
        createdAt: new Date()
      },
      create: {
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        code: verificationCode
      }
    });

    // Envoi de l'email. Si l'envoi echoue (identifiants SMTP invalides, quota...),
    // on le signale clairement au lieu de laisser l'inscription bloquee sans explication.
    try {
      await transporter.sendMail({
        from: `"Glory Aures" <${process.env.EMAIL_USER}>`,
        to: normalizedEmail,
        subject: "Code de verification - Glory Aures Portal",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
            <h2 style="color: #0f172a;">Bienvenue sur Glory Aures Portal !</h2>
            <p style="color: #475569;">Voici votre code de verification pour confirmer votre compte :</p>
            <div style="background-color: #f0fdf4; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #059669; letter-spacing: 6px; font-size: 32px; margin: 0;">${verificationCode}</h1>
            </div>
            <p style="color: #64748b; font-size: 12px;">Ce code est confidentiel et expire dans 10 minutes.</p>
          </div>
        `
      });
    } catch (mailError) {
      console.error("EMAIL SEND ERROR:", mailError);
      return res.status(502).json({
        error: "Le compte a ete prepare mais l'envoi de l'email a echoue. Verifiez la configuration EMAIL_USER/EMAIL_PASS puis reessayez.",
        details: mailError.message
      });
    }

    res.json({ message: "Code de verification envoye par email." });
  } catch (error) {
    console.error("REGISTER-PENDING ERROR:", error);
    res.status(500).json({ error: "Erreur lors de l'envoi du code", details: error.message });
  }
});

// 3. Verification du code et creation definitive du compte
app.post('/api/verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Email et code requis." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const pending = await prisma.pendingRegistration.findUnique({ where: { email: normalizedEmail } });

    if (!pending) {
      return res.status(400).json({ error: "Aucune demande d'inscription trouvee pour cet email." });
    }

    if (Date.now() - new Date(pending.createdAt).getTime() > CODE_TTL_MS) {
      await prisma.pendingRegistration.delete({ where: { email: normalizedEmail } }).catch(() => {});
      return res.status(400).json({ error: "Le code de verification a expire. Veuillez recommencer l'inscription." });
    }

    if (pending.code !== String(code).trim()) {
      return res.status(400).json({ error: "Code de verification incorrect." });
    }

    // Re-verification anti doublon (au cas ou un autre compte a ete cree entre-temps)
    const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) {
      await prisma.pendingRegistration.delete({ where: { email: normalizedEmail } }).catch(() => {});
      return res.status(409).json({ error: "We already have an account with this email" });
    }

    const memberId = 'GA-' + Math.floor(100000 + Math.random() * 900000);

    const newUser = await prisma.user.create({
      data: {
        username: pending.username,
        email: pending.email,
        password: pending.password, // deja hashe
        memberId,
        role: 'user'
      }
    });

    // Nettoyage de la demande en attente
    await prisma.pendingRegistration.delete({ where: { email: normalizedEmail } }).catch(() => {});

    const { password: _pw, ...safeUser } = newUser;
    res.status(201).json({ message: "Account created successfully", user: safeUser, ...safeUser });
  } catch (error) {
    console.error("VERIFY-CODE ERROR:", error);
    res.status(500).json({ error: 'Erreur lors de la creation du compte', details: error.message });
  }
});

// Ancienne route d'inscription directe (conservee si besoin, sans verification email)
// مثال على مسار التسجيل المباشر في server.js
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 1. التحقق هل المستخدم موجود مسبقاً
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: "Cet email ou nom d'utilisateur est déjà utilisé." });
    }

    // 2. تشفير كلمة المرور (إذا كنت تستخدم bcrypt)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. إنشاء المستخدم في قاعدة البيانات مباشرة
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'user' // أو الدور الافتراضي
      }
    });

    res.status(201).json({ message: "Compte créé avec succès", user: newUser });

  } catch (error) {
    console.error("Erreur lors de l'inscription:", error);
    res.status(500).json({ error: "Erreur interne du serveur." });
  }
});

// ==================== POSTS / PRODUITS ====================

app.get('/api/posts', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const posts = await prisma.post.findMany({
      include: { category: true, catalogue: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching posts', details: error.message });
  }
});

app.post('/api/posts', async (req, res) => {
  // Le frontend envoie soit categoryId (produit rattache a une categorie),
  // soit catalogueId (produit rattache a un catalogue) - jamais les deux.
  const { title, description, content, price, image, categoryId, catalogueId } = req.body;

  if (!title || !image || (!categoryId && !catalogueId)) {
    return res.status(400).json({ error: "Titre, image et categorie/catalogue de destination requis." });
  }

  try {
    const newPost = await prisma.post.create({
      data: {
        title,
        description: description || content || null,
        price: price ? parseFloat(price) : null,
        image,
        categoryId: categoryId || null,
        catalogueId: catalogueId || null
      },
      include: { category: true, catalogue: true }
    });
    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: 'Error creating post', details: error.message });
  }
});

app.put('/api/posts/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, content, price, image } = req.body;
  try {
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined || content !== undefined) data.description = description || content || null;
    if (price !== undefined) data.price = price ? parseFloat(price) : null;
    if (image) data.image = image;

    const updatedPost = await prisma.post.update({
      where: { id },
      data,
      include: { category: true, catalogue: true }
    });
    res.json(updatedPost);
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ error: 'Error updating post', details: error.message });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.post.delete({ where: { id } });
    res.json({ message: 'Post supprime avec succes' });
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
  if (!name || !image) {
    return res.status(400).json({ error: "Nom et image requis." });
  }
  try {
    const newCategory = await prisma.category.create({
      data: { name, image }
    });
    res.status(201).json({ ...newCategory, posts: [] });
  } catch (error) {
    res.status(500).json({ error: 'Error creating category', details: error.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, image } = req.body;
  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (image) data.image = image;

    const updatedCategory = await prisma.category.update({
      where: { id },
      data,
      include: { posts: true }
    });
    res.json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: 'Error updating category', details: error.message });
  }
});

// Supprime les produits rattaches a cette categorie, puis la categorie elle-meme.
app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.post.deleteMany({
      where: { categoryId: id }
    });

    await prisma.category.delete({
      where: { id }
    });

    res.json({ message: 'Categorie et ses produits supprimes avec succes' });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: 'Error deleting category', details: error.message });
  }
});

// ==================== CATALOGUES ====================

app.get('/api/catalogues', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const catalogues = await prisma.catalogue.findMany({
      include: { posts: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(catalogues);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching catalogues', details: error.message });
  }
});

app.post('/api/catalogues', async (req, res) => {
  const { name, dateFrom, dateTo, image } = req.body;
  if (!name || !image) {
    return res.status(400).json({ error: "Nom et image requis." });
  }
  try {
    const newCatalogue = await prisma.catalogue.create({
      data: { name, dateFrom, dateTo, image }
    });
    res.status(201).json({ catalogue: { ...newCatalogue, posts: [] } });
  } catch (error) {
    res.status(500).json({ error: 'Error creating catalogue', details: error.message });
  }
});

app.put('/api/catalogues/:id', async (req, res) => {
  const { id } = req.params;
  const { name, dateFrom, dateTo, image } = req.body;
  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (dateFrom !== undefined) data.dateFrom = dateFrom;
    if (dateTo !== undefined) data.dateTo = dateTo;
    if (image) data.image = image;

    const updatedCatalogue = await prisma.catalogue.update({
      where: { id },
      data,
      include: { posts: true }
    });
    res.json({ catalogue: updatedCatalogue });
  } catch (error) {
    console.error("Error updating catalogue:", error);
    res.status(500).json({ error: 'Error updating catalogue', details: error.message });
  }
});

app.delete('/api/catalogues/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.post.deleteMany({ where: { catalogueId: id } });
    await prisma.catalogue.delete({ where: { id } });
    res.json({ message: 'Catalogue et ses produits supprimes avec succes' });
  } catch (error) {
    console.error("Error deleting catalogue:", error);
    res.status(500).json({ error: 'Error deleting catalogue', details: error.message });
  }
});

// ==================== ORDERS / COMMANDES ====================

app.get('/api/orders', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
        quantity: parseInt(quantity) || 1,
        status: status || 'pending'
      }
    });
    res.status(201).json({ order: newOrder });
  } catch (error) {
    res.status(500).json({ error: 'Error creating order', details: error.message });
  }
});

// Met a jour le statut d'une commande/demande (accepte / refuse / en attente).
// Cette route n'existait pas: c'est la raison pour laquelle les changements de
// statut ne persistaient jamais en base et disparaissaient au rechargement.
app.patch('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowedStatuses = ['pending', 'accepted', 'rejected'];
  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Statut invalide. Valeurs autorisees: pending, accepted, rejected." });
  }
  try {
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status }
    });
    res.json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: 'Error updating order status', details: error.message });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.order.delete({ where: { id } });
    res.json({ message: 'Commande supprimee avec succes' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting order', details: error.message });
  }
});

app.delete('/api/orders', async (req, res) => {
  try {
    await prisma.order.deleteMany({});
    res.json({ message: 'Toutes les commandes ont ete supprimees' });
  } catch (error) {
    res.status(500).json({ error: 'Error clearing orders', details: error.message });
  }
});

// ==================== DEMARRAGE DU SERVEUR ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
