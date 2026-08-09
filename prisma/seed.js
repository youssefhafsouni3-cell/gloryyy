const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// En production, définis ADMIN_EMAIL / ADMIN_PASSWORD dans les variables d'environnement
// de Render plutôt que de laisser le mot de passe en clair dans un fichier versionné sur GitHub.
// Les valeurs ci-dessous ne servent que de repli pour que le seed fonctionne tel quel.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "gloryaures@gmail.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "gloryayresinternational321*";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";

async function main() {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password: hashedPassword,
      role: 'admin',
    },
    create: {
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
      memberId: 'GA-ADMIN',
    },
  });

  const { password, ...safeAdmin } = admin;
  console.log('Compte admin créé/mis à jour avec succès :', safeAdmin);
}

main()
  .catch((e) => {
    console.error("Erreur lors du seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });