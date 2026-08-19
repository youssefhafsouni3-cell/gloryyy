// ==================== STATE MANAGEMENT ====================
// En local (Live Server, etc.) -> backend Express local sur le port 5000.
// En production (site déployé sur Netlify) -> backend déployé sur Render.
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000'
  : 'https://gloryyy-2.onrender.com';
let users = JSON.parse(localStorage.getItem('ga_users')) || [
  { user: 'admin', pass: 'admin', role: 'admin' }
];
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let categories = JSON.parse(localStorage.getItem('ga_categories')) || [
  { id: 'cat-1', name: 'Category 1', image: '', posts: [] },
  { id: 'cat-2', name: 'Category 2', image: '', posts: [] },
  { id: 'cat-3', name: 'Category 3', image: '', posts: [] },
  { id: 'cat-4', name: 'Category 4', image: '', posts: [] }
];
let orders = JSON.parse(localStorage.getItem('ga_orders')) || [];
let catalogues = JSON.parse(localStorage.getItem('ga_catalogues')) || [];
let currentLang = localStorage.getItem('ga_lang') || 'fr';

let currentView = 'categories'; 
let activeCategoryViewId = null; 
let activeProductId = null;
let activeProductSource = 'category'; // 'category' | 'catalogue'
let pendingRegistration = null; // { username, email, pass, code, memberId }
let verifyCountdownInterval = null;
const VERIFY_COUNTDOWN_SECONDS = 60; // -1m countdown before the code can be resent

// ==================== TRANSLATIONS ====================
const translations = {
  fr: {
    home: "Accueil", categories: "Catégories", products: "Produits", contactUs: "Contact",
    cart: "Panier", items: "articles", admin: "Administration", logout: "Déconnexion",
    view: "Voir", addToCart: "Ajouter au panier", noProducts: "Aucun article dans ce panier.",
    noCategories: "Aucune catégorie disponible.", sentSuccess: "Demande transmise avec succès !",
    welcome: "Bienvenue", connectSub: "Connectez-vous à Glory Aures Portal",
    heroTitle: "Votre épicerie en ligne de confiance",
    heroDesc: "Découvrez une sélection de produits alimentaires et d'articles de tous les jours de qualité",
    start: "Commencer", featuredCat: "Catégories en vedette", featuredSub: "Explorez notre gamme complète par catégorie",
    backCat: "Retour aux Catégories", backProd: "Retour aux produits", sendReq: "Passer une Demande", dir: "ltr"
  },
  eng: {
    home: "Home", categories: "Categories", products: "Products", contactUs: "Contact",
    cart: "Cart", items: "items", admin: "Admin", logout: "Logout",
    view: "View", addToCart: "Add to Cart", noProducts: "No items in this cart.",
    noCategories: "No categories available.", sentSuccess: "Request submitted successfully!",
    welcome: "Welcome", connectSub: "Log in to Glory Aures Portal",
    heroTitle: "Your Trusted Online Grocery",
    heroDesc: "Discover a selection of high-quality food and everyday items",
    start: "Get Started", featuredCat: "Featured Categories", featuredSub: "Explore our complete range by category",
    backCat: "Back to Categories", backProd: "Back to Products", sendReq: "Place a Request", dir: "ltr"
  },
  ar: {
    home: "الرئيسية", categories: "التصنيفات", products: "المنتجات", contactUs: "اتصل بنا",
    cart: "السلة", items: "عناصر", admin: "الإدارة", logout: "تسجيل الخروج",
    view: "عرض", addToCart: "إضافة إلى السلة", noProducts: "لا توجد عناصر في هذه السلة.",
    noCategories: "لا توجد تصنيفات متاحة.", sentSuccess: "تم إرسال الطلب بنجاح!",
    welcome: "مرحباً بك", connectSub: "تسجيل الدخول إلى بوابة Glory Aures",
    heroTitle: "متجرك الإلكتروني الموثوق عبر الإنترنت",
    heroDesc: "اكتشف تشكيلة مختارة من المنتجات الغذائية واليومية عالية الجودة",
    start: "ابدأ الآن", featuredCat: "التصنيفات المميزة", featuredSub: "استكشف مجموعتنا الكاملة حسب التصنيف",
    backCat: "العودة إلى التصنيفات", backProd: "العودة إلى المنتجات", sendReq: "تقديم طلب", dir: "rtl"
  }
};

async function saveData() {
    // Les données sont désormais sauvegardées directement dans la base de données via l'API
}

async function loadData() {
    try {
        const resCat = await fetch(`${API_BASE_URL}/api/categories`);
        if (!resCat.ok) {
            throw new Error(`GET /api/categories a échoué avec le statut ${resCat.status}`);
        }
        categories = await resCat.json();
    } catch (err) {
        console.error("Erreur lors du chargement des catégories :", err);
    }

    try {
        const resCatalogues = await fetch(`${API_BASE_URL}/api/catalogues`);
        if (!resCatalogues.ok) {
            throw new Error(`GET /api/catalogues a échoué avec le statut ${resCatalogues.status}`);
        }
        catalogues = await resCatalogues.json();
    } catch (err) {
        console.error("Erreur lors du chargement des catalogues :", err);
    }

    try {
        const resOrders = await fetch(`${API_BASE_URL}/api/orders`);
        if (!resOrders.ok) {
            throw new Error(`GET /api/orders a échoué avec le statut ${resOrders.status}`);
        }
        orders = await resOrders.json();
    } catch (err) {
        console.error("Erreur lors du chargement des commandes :", err);
    }
}

function changeLanguage(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  localStorage.setItem('ga_lang', lang);
  document.documentElement.dir = translations[lang].dir;
  renderApp();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function switchAuthTab(mode) {
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');
  const tabLogin = document.getElementById('tab-login');
  const tabReg = document.getElementById('tab-register');

  if (mode === 'register') {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    tabReg.classList.add('bg-emerald-600', 'text-white');
    tabReg.classList.remove('text-slate-600');
    tabLogin.classList.remove('bg-emerald-600', 'text-white');
    tabLogin.classList.add('text-slate-600');
  } else {
    regForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    tabLogin.classList.add('bg-emerald-600', 'text-white');
    tabLogin.classList.remove('text-slate-600');
    tabReg.classList.remove('bg-emerald-600', 'text-white');
    tabReg.classList.add('text-slate-600');
  }
}

function togglePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const icon = document.getElementById('mobile-menu-icon');
  const btn = document.getElementById('mobile-menu-btn');
  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    menu.classList.add('flex');
    icon.classList.replace('fa-bars', 'fa-xmark');
    btn.setAttribute('aria-expanded', 'true');
  } else {
    menu.classList.add('hidden');
    menu.classList.remove('flex');
    icon.classList.replace('fa-xmark', 'fa-bars');
    btn.setAttribute('aria-expanded', 'false');
  }
}

function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const icon = document.getElementById('mobile-menu-icon');
  const btn = document.getElementById('mobile-menu-btn');
  menu.classList.add('hidden');
  menu.classList.remove('flex');
  icon.classList.replace('fa-xmark', 'fa-bars');
  btn.setAttribute('aria-expanded', 'false');
}

async function handleAuthLogin(e) {
  e.preventDefault();
  
  const emailInput = document.getElementById('login-email').value.trim();
  const passwordInput = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput, password: passwordInput })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('user', JSON.stringify(data.user));
      // Sauvegarder également le token d'authentification s'il est renvoyé par l'API
      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      showToast('success', `Bienvenue ${data.user.username || ''} !`);
      renderApp();
    } else {
      showToast('error', data.error || 'Erreur de connexion');
    }
  } catch (err) {
    console.error("Login Error:", err);
    showToast('error', 'Impossible de se connecter au serveur');
  }
}

// ==================== REGISTRATION WITH EMAIL VERIFICATION ====================

function generateMemberId() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return 'GA-' + num;
}

async function handleAuthRegister(e) {
  e.preventDefault();

  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value.trim();

  // التحقق من المدخلات...
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    showToast('error', "Veuillez saisir une adresse email valide.");
    return;
  }
  if (password.length < 4) {
    showToast('error', "Le mot de passe doit contenir au moins 4 caractères.");
    return;
  }

  const btnSubmit = document.getElementById('btn-reg-submit');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerText = "Création en cours...";
  }

  try {
    // نغير الرابط إلى مسار التسجيل النهائي المباشر (تأكد من اسم الـ Route في السيرفر، مثلاً /api/register)
    const res = await fetch(`${API_BASE_URL}/api/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();

    if (res.ok) {
      showToast('success', "Compte créé avec succès !");
      // توجيه المستخدم لصفحة تسجيل الدخول أو لوحة التحكم
      setTimeout(() => {
        window.location.href = 'login.html'; // أو صفحة الـ Dashboard
      }, 1500);
    } else if (res.status === 409) {
      showToast('error', data.error || "Cet email ou nom d'utilisateur est déjà utilisé.");
    } else {
      showToast('error', data.error || "Erreur lors de l'inscription.");
    }
  } catch (err) {
    console.error("Erreur:", err);
    showToast('error', "Impossible de contacter le serveur.");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = "Créer un compte";
    }
  }
}

function showVerificationStep() {
  document.getElementById('auth-step-credentials').classList.add('hidden');
  document.getElementById('auth-step-verify').classList.remove('hidden');
  document.getElementById('verify-target-email').innerText = pendingRegistration.email;
  document.getElementById('verify-code').value = '';
  startVerifyCountdown();
}

function backToRegisterStep() {
  pendingRegistration = null;
  stopVerifyCountdown();
  document.getElementById('auth-step-verify').classList.add('hidden');
  document.getElementById('auth-step-credentials').classList.remove('hidden');
}

// ==================== EMAIL VERIFICATION COUNTDOWN (1 MINUTE) ====================

function startVerifyCountdown() {
  stopVerifyCountdown();

  const resendBtn = document.getElementById('btn-resend-code');
  const countdownEl = document.getElementById('verify-countdown');
  let remaining = VERIFY_COUNTDOWN_SECONDS;

  const render = () => {
    if (!countdownEl) return;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    countdownEl.innerText = `-${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  if (resendBtn) {
    resendBtn.disabled = true;
    resendBtn.classList.add('opacity-40', 'cursor-not-allowed');
  }
  render();

  verifyCountdownInterval = setInterval(() => {
    remaining -= 1;
    render();
    if (remaining <= 0) {
      stopVerifyCountdown();
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.classList.remove('opacity-40', 'cursor-not-allowed');
      }
      if (countdownEl) countdownEl.innerText = '';
    }
  }, 1000);
}

function stopVerifyCountdown() {
  if (verifyCountdownInterval) {
    clearInterval(verifyCountdownInterval);
    verifyCountdownInterval = null;
  }
}

async function resendVerificationCode() {
  if (!pendingRegistration) return;
  const resendBtn = document.getElementById('btn-resend-code');
  if (resendBtn && resendBtn.disabled) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/register-pending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: pendingRegistration.username,
        email: pendingRegistration.email,
        password: pendingRegistration.password
      })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('success', "Nouveau code envoyé par email.");
      startVerifyCountdown();
    } else {
      showToast('error', data.error || "Impossible de renvoyer le code.");
    }
  } catch (err) {
    showToast('error', "Impossible de contacter le serveur.");
  }
}

async function handleVerifyCode(e) {
  e.preventDefault();
  if (!pendingRegistration) return;
  const entered = document.getElementById('verify-code').value.trim();

  try {
    const res = await fetch(`${API_BASE_URL}/api/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingRegistration.email, code: entered })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast('error', data.error || "Le code de vérification est incorrect.");
      return;
    }

    stopVerifyCountdown();
    currentUser = data.user || data;
    currentView = 'categories';
    pendingRegistration = null;
    localStorage.setItem('user', JSON.stringify(currentUser));
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    showToast('success', 'Account created successfully');
    renderApp();
  } catch (err) {
    showToast('error', "Impossible de contacter le serveur.");
  }
}

function handleLogout() {
  const modal = document.getElementById('modal-logout-confirm');
  if (modal) {
    modal.classList.remove('hidden');
  } else {
    performLogout();
  }
}

function closeLogoutConfirm() {
  const modal = document.getElementById('modal-logout-confirm');
  if (modal) modal.classList.add('hidden');
}

function performLogout() {
  currentUser = null;
  activeCategoryViewId = null;
  activeProductId = null;
  pendingRegistration = null;
  currentView = 'categories';
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  closeLogoutConfirm();
  renderApp();
}

// ==================== TOAST NOTIFICATIONS ====================

function showToast(type, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const styles = {
    success: { bg: 'bg-emerald-600', icon: 'fa-circle-check' },
    error: { bg: 'bg-rose-600', icon: 'fa-circle-exclamation' },
    info: { bg: 'bg-slate-800', icon: 'fa-circle-info' }
  };
  const s = styles[type] || styles.info;

  const el = document.createElement('div');
  el.className = `toast-item pointer-events-auto ${s.bg} text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5`;
  el.innerHTML = `<i class="fa-solid ${s.icon}"></i><span>${message}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'all .35s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(24px)';
    setTimeout(() => el.remove(), 350);
  }, 4000);
}

// ==================== AUTH SCREEN VISUAL EFFECTS ====================

function initAuthVisualEffects() {
  const cardWrap = document.getElementById('auth-card-wrap');
  const card = document.getElementById('auth-card');
  if (cardWrap && card) {
    cardWrap.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = ((y / rect.height) - 0.5) * -6;
      const rotateY = ((x / rect.width) - 0.5) * 6;
      card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`;
    });
    cardWrap.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1200px) rotateX(0) rotateY(0) scale(1)';
    });
  }

  const particlesBox = document.getElementById('auth-particles');
  if (particlesBox && !particlesBox.dataset.rendered) {
    particlesBox.dataset.rendered = '1';
    let html = '';
    for (let i = 0; i < 26; i++) {
      const left = Math.random() * 100;
      const delay = Math.random() * 12;
      const duration = 9 + Math.random() * 8;
      const drift = (Math.random() * 60 - 30).toFixed(0) + 'px';
      const size = (2 + Math.random() * 3).toFixed(0) + 'px';
      html += `<span style="left:${left}%; width:${size}; height:${size}; animation-duration:${duration}s; animation-delay:${delay}s; --drift:${drift};"></span>`;
    }
    particlesBox.innerHTML = html;
  }
}

// ==================== CATEGORY LOGIC ====================

async function createCategory(e) {
    e.preventDefault();
    const nameInput = document.getElementById("category-name");
    const name = nameInput.value.trim();

    if (!name) return;

    const imageInput = document.getElementById("category-image-file");
    if (!imageInput || !imageInput.files || !imageInput.files[0]) {
        showToast('error', "Veuillez sélectionner une image pour la catégorie.");
        return;
    }
    const image = await fileToBase64(imageInput.files[0]);

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE_URL}/api/categories`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, image })
        });

        if (response.ok) {
            const newCategory = await response.json();
            categories.push(newCategory);
            renderApp();
            nameInput.value = "";
            if (imageInput) imageInput.value = "";
            showToast('success', "Catégorie créée avec succès !");
        } else {
            console.error("Erreur lors de la création :", await response.text());
            showToast('error', "Erreur lors de la création de la catégorie.");
        }
    } catch (err) {
        console.error("Erreur réseau :", err);
        showToast('error', "Impossible de contacter le serveur.");
    }
}

async function deleteCategory(catId, event) {
  if (event) event.stopPropagation();
  if (confirm("Voulez-vous vraiment supprimer cette catégorie et tous ses produits ?")) {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');

      const response = await fetch(`${API_BASE_URL}/api/categories/${catId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        categories = categories.filter(c => c.id !== catId);
        if (activeCategoryViewId === catId) {
          activeCategoryViewId = null;
          currentView = 'categories';
        }
        showToast('success', "Catégorie supprimée.");
        renderApp();
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast('error', errorData.error || "Échec de la suppression sur le serveur.");
      }
    } catch (err) {
      console.error("Erreur réseau :", err);
      showToast('error', "Erreur de connexion au serveur.");
    }
  }
}

function openEditCategoryModal(catId, event) {
  if (event) event.stopPropagation();
  const cat = categories.find(c => c.id === catId);
  if (!cat) return;

  document.getElementById('edit-category-id').value = catId;
  document.getElementById('edit-category-name').value = cat.name;
  document.getElementById('edit-category-image-file').value = '';

  const modal = document.getElementById('modal-edit-category');
  if (modal) modal.classList.remove('hidden');
}

function closeEditCategoryModal() {
  const modal = document.getElementById('modal-edit-category');
  if (modal) modal.classList.add('hidden');
}

async function handleCategoryEditSubmit(e) {
  e.preventDefault();
  const catId = document.getElementById('edit-category-id').value;
  const name = document.getElementById('edit-category-name').value.trim();
  const fileInput = document.getElementById('edit-category-image-file');

  const cat = categories.find(c => c.id === catId);
  if (!cat) return;

  let image = cat.image;
  if (fileInput.files.length > 0) {
    image = await fileToBase64(fileInput.files[0]);
  }

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    const response = await fetch(`${API_BASE_URL}/api/categories/${catId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, image })
    });

    if (response.ok) {
      cat.name = name;
      cat.image = image;
      closeEditCategoryModal();
      showToast('success', "Catégorie mise à jour !");
      renderApp();
    } else {
      showToast('error', "Échec de la mise à jour côté serveur.");
    }
  } catch (err) {
    console.error("Erreur mise à jour catégorie :", err);
    showToast('error', "Erreur lors de la mise à jour.");
  }
}

// ==================== CATALOGUE LOGIC ====================

async function createCatalogue(e) {
  e.preventDefault();
  const name = document.getElementById('catalogue-name').value.trim();
  const dateFrom = document.getElementById('catalogue-date-from').value;
  const dateTo = document.getElementById('catalogue-date-to').value;
  const fileInput = document.getElementById('catalogue-image-file');

  if (name && dateFrom && dateTo && fileInput.files.length > 0) {
    try {
      const imageBase64 = await fileToBase64(fileInput.files[0]);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');

      const response = await fetch(`${API_BASE_URL}/api/catalogues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          dateFrom,
          dateTo,
          image: imageBase64
        })
      });

      const data = await response.json();

      if (response.ok) {
        document.getElementById('catalogue-name').value = '';
        document.getElementById('catalogue-date-from').value = '';
        document.getElementById('catalogue-date-to').value = '';
        fileInput.value = '';

        showToast('success', 'Catalogue créé avec succès !');

        if (data.catalogue) {
          catalogues.unshift(data.catalogue);
        }
        renderApp();
      } else {
        showToast('error', data.error || "Échec de la création du catalogue.");
      }
    } catch (err) {
      console.error("Erreur réseau :", err);
      showToast('error', "Erreur de connexion au serveur.");
    }
  } else {
    showToast('error', "Veuillez remplir tous les champs.");
  }
}

async function deleteCatalogue(catalogueId, event) {
  if (event) event.stopPropagation();
  if (!confirm("Voulez-vous vraiment supprimer ce catalogue et tous ses produits ?")) return;

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    const response = await fetch(`${API_BASE_URL}/api/catalogues/${catalogueId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      showToast('error', errData.error || "Échec de la suppression du catalogue.");
      return;
    }

    catalogues = catalogues.filter(c => c.id !== catalogueId);
    if (activeCategoryViewId === catalogueId && activeProductSource === 'catalogue') {
      activeCategoryViewId = null;
      currentView = 'categories';
    }
    showToast('success', 'Catalogue supprimé.');
    renderApp();
  } catch (err) {
    console.error("Erreur réseau :", err);
    showToast('error', "Erreur de connexion au serveur.");
  }
}

function openEditCatalogueModal(catalogueId, event) {
  if (event) event.stopPropagation();
  const cat = catalogues.find(c => c.id === catalogueId);
  if (!cat) return;

  document.getElementById('edit-catalogue-id').value = catalogueId;
  document.getElementById('edit-catalogue-name').value = cat.name;
  document.getElementById('edit-catalogue-date-from').value = cat.dateFrom || '';
  document.getElementById('edit-catalogue-date-to').value = cat.dateTo || '';
  document.getElementById('edit-catalogue-image-file').value = '';

  const modal = document.getElementById('modal-edit-catalogue');
  if (modal) modal.classList.remove('hidden');
}

function closeEditCatalogueModal() {
  const modal = document.getElementById('modal-edit-catalogue');
  if (modal) modal.classList.add('hidden');
}

async function handleCatalogueEditSubmit(e) {
  e.preventDefault();
  const catalogueId = document.getElementById('edit-catalogue-id').value;
  const name = document.getElementById('edit-catalogue-name').value.trim();
  const dateFrom = document.getElementById('edit-catalogue-date-from').value;
  const dateTo = document.getElementById('edit-catalogue-date-to').value;
  const fileInput = document.getElementById('edit-catalogue-image-file');

  const cat = catalogues.find(c => c.id === catalogueId);
  if (!cat) return;

  try {
    const payload = { name, dateFrom, dateTo };
    if (fileInput.files.length > 0) {
      payload.image = await fileToBase64(fileInput.files[0]);
    }

    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    const response = await fetch(`${API_BASE_URL}/api/catalogues/${catalogueId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      showToast('error', errData.error || "Échec de la mise à jour du catalogue.");
      return;
    }

    const data = await response.json();
    cat.name = data.catalogue.name;
    cat.dateFrom = data.catalogue.dateFrom;
    cat.dateTo = data.catalogue.dateTo;
    cat.image = data.catalogue.image;

    closeEditCatalogueModal();
    showToast('success', 'Catalogue mis à jour.');
    renderApp();
  } catch (err) {
    console.error("Erreur réseau :", err);
    showToast('error', "Erreur de connexion au serveur.");
  }
}

function formatCatalogueDateRange(dateFrom, dateTo) {
  try {
    const opts = { day: '2-digit', month: 'long', year: 'numeric' };
    const from = new Date(dateFrom + 'T00:00:00').toLocaleDateString('fr-FR', opts);
    const to = new Date(dateTo + 'T00:00:00').toLocaleDateString('fr-FR', opts);
    return `Du ${from} au ${to}`;
  } catch (err) {
    return '';
  }
}

// ==================== PRODUCT LOGIC ====================

function getContainerArray(type) {
  return type === 'catalogue' ? catalogues : categories;
}

function findContainer(type, id) {
  return getContainerArray(type).find(c => c.id === id);
}

async function createPost(e) {
  e.preventDefault();
  const rawTarget = document.getElementById('post-category-select').value;
  const title = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').value.trim();
  const fileInput = document.getElementById('post-image-file');

  if (rawTarget && title && content && fileInput.files.length > 0) {
    const [type, targetId] = rawTarget.split(':');
    const targetContainer = findContainer(type, targetId);

    if (targetContainer) {
      const imageBase64 = await fileToBase64(fileInput.files[0]);

      try {
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE_URL}/api/posts`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title,
            description: content,
            image: imageBase64,
            categoryId: type === 'category' ? targetId : null,
            catalogueId: type === 'catalogue' ? targetId : null
          })
        });

        if (response.ok) {
          const newPost = await response.json();
          targetContainer.posts.unshift(newPost);

          document.getElementById('post-title').value = '';
          document.getElementById('post-content').value = '';
          fileInput.value = '';

          showToast('success', 'Produit ajouté !');
          renderApp();
        } else {
          showToast('error', "Erreur lors de la création du produit.");
        }
      } catch (err) {
        console.error("Erreur serveur :", err);
        showToast('error', "Erreur de connexion au serveur.");
      }
    }
  }
}

function openQuickAddProduct(catId) {
  document.getElementById('quick-add-target-type').value = 'category';
  document.getElementById('quick-add-cat-id').value = catId;
  document.getElementById('quick-add-title').value = '';
  document.getElementById('quick-add-content').value = '';
  document.getElementById('quick-add-image-file').value = '';
  const modal = document.getElementById('modal-quick-add-product');
  if (modal) modal.classList.remove('hidden');
}

function openQuickAddCatalogueProduct(catalogueId) {
  document.getElementById('quick-add-target-type').value = 'catalogue';
  document.getElementById('quick-add-cat-id').value = catalogueId;
  document.getElementById('quick-add-title').value = '';
  document.getElementById('quick-add-content').value = '';
  document.getElementById('quick-add-image-file').value = '';
  const modal = document.getElementById('modal-quick-add-product');
  if (modal) modal.classList.remove('hidden');
}

function closeQuickAddProductModal() {
  const modal = document.getElementById('modal-quick-add-product');
  if (modal) modal.classList.add('hidden');
}

async function handleQuickAddProductSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('quick-add-target-type').value;
  const containerId = document.getElementById('quick-add-cat-id').value;
  const title = document.getElementById('quick-add-title').value.trim();
  const content = document.getElementById('quick-add-content').value.trim();
  const fileInput = document.getElementById('quick-add-image-file');

  const targetContainer = findContainer(type, containerId);
  if (targetContainer && title && content && fileInput.files.length > 0) {
    const imageBase64 = await fileToBase64(fileInput.files[0]);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/posts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description: content,
          image: imageBase64,
          categoryId: type === 'category' ? containerId : null,
          catalogueId: type === 'catalogue' ? containerId : null
        })
      });

      if (response.ok) {
        const newPost = await response.json();
        targetContainer.posts.unshift(newPost);
        closeQuickAddProductModal();
        showToast('success', 'Produit ajouté !');
        renderApp();
      } else {
        showToast('error', "Erreur serveur lors de l'ajout rapide.");
      }
    } catch (err) {
      console.error("Erreur réseau :", err);
      showToast('error', "Erreur de connexion au serveur.");
    }
  }
}

async function deletePost(type, containerId, postId, event) {
  if (event) event.stopPropagation();
  if (confirm("Voulez-vous supprimer ce produit ?")) {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const container = findContainer(type, containerId);
        if (container) {
          container.posts = container.posts.filter(p => p.id !== postId);
          if (activeProductId === postId) {
            activeProductId = null;
            currentView = type === 'catalogue' ? 'single-catalogue' : 'single-category';
          }
          showToast('success', 'Produit supprimé.');
          renderApp();
        }
      } else {
        showToast('error', "Erreur lors de la suppression du produit.");
      }
    } catch (err) {
      console.error("Erreur réseau :", err);
      showToast('error', "Impossible de contacter le serveur.");
    }
  }
}

function openEditProductModal(type, containerId, postId, event) {
  if (event) event.stopPropagation();
  const container = findContainer(type, containerId);
  const prod = container ? container.posts.find(p => p.id === postId) : null;
  if (!prod) return;

  document.getElementById('edit-product-type').value = type;
  document.getElementById('edit-product-cat-id').value = containerId;
  document.getElementById('edit-product-id').value = postId;
  document.getElementById('edit-product-title').value = prod.title;
  document.getElementById('edit-product-content').value = prod.description || '';
  document.getElementById('edit-product-image-file').value = '';

  const categoryField = document.getElementById('edit-product-category-field');
  const catalogueField = document.getElementById('edit-product-catalogue-field');

  if (type === 'catalogue') {
    categoryField.classList.add('hidden');
    catalogueField.classList.remove('hidden');
    document.getElementById('edit-product-catalogue-name').innerText = container.name;
  } else {
    catalogueField.classList.add('hidden');
    categoryField.classList.remove('hidden');
    const selectCat = document.getElementById('edit-product-category-select');
    selectCat.innerHTML = '';
    categories.forEach(c => {
      selectCat.innerHTML += `<option value="${c.id}" ${c.id === containerId ? 'selected' : ''}>${c.name}</option>`;
    });
  }

  const modal = document.getElementById('modal-edit-product');
  if (modal) modal.classList.remove('hidden');
}

function closeEditProductModal() {
  const modal = document.getElementById('modal-edit-product');
  if (modal) modal.classList.add('hidden');
}

async function handleProductEditSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('edit-product-type').value;
  const oldContainerId = document.getElementById('edit-product-cat-id').value;
  const prodId = document.getElementById('edit-product-id').value;
  const title = document.getElementById('edit-product-title').value.trim();
  const content = document.getElementById('edit-product-content').value.trim();
  const fileInput = document.getElementById('edit-product-image-file');

  const oldContainer = findContainer(type, oldContainerId);
  if (!oldContainer) return;

  const prodIndex = oldContainer.posts.findIndex(p => p.id === prodId);
  if (prodIndex === -1) return;

  try {
    const payload = { title, description: content };
    if (fileInput.files.length > 0) {
      payload.image = await fileToBase64(fileInput.files[0]);
    }

    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    const response = await fetch(`${API_BASE_URL}/api/posts/${prodId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      showToast('error', errData.error || "Échec de la mise à jour du produit.");
      return;
    }

    const updatedPost = await response.json();
    let product = oldContainer.posts[prodIndex];
    product.title = updatedPost.title;
    product.description = updatedPost.description;
    product.image = updatedPost.image;

    closeEditProductModal();
    showToast('success', 'Produit mis à jour.');
    renderApp();
  } catch (err) {
    console.error("Erreur mise à jour produit :", err);
    showToast('error', "Impossible de contacter le serveur.");
  }
}

// ==================== CART & NOTIFICATIONS ====================

function toggleCartDropdown() {
  const dropdown = document.getElementById('cart-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

async function submitOrder(e) {
  e.preventDefault();
  const fullname = document.getElementById('order-fullname').value.trim();
  const email = document.getElementById('order-email').value.trim();
  const phone = document.getElementById('order-phone').value.trim();
  const quantity = document.getElementById('order-quantity').value;

  const cat = findContainer(activeProductSource, activeCategoryViewId);
  const prod = cat ? cat.posts.find(p => p.id === activeProductId) : null;

  if (fullname && email && phone && quantity && prod && currentUser) {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');

      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: currentUser.user || currentUser.username,
          productTitle: prod.title,
          productImage: prod.image,
          categoryName: cat.name,
          fullname,
          email,
          phone,
          quantity: parseInt(quantity),
          status: 'pending'
        })
      });

      const data = await response.json();

      if (response.ok) {
        showToast('success', translations[currentLang].sentSuccess);

        document.getElementById('order-fullname').value = '';
        document.getElementById('order-email').value = '';
        document.getElementById('order-phone').value = '';

        if (data.order) {
          orders.unshift(data.order);
        }
      } else {
        showToast('error', data.error || "Échec de l'envoi de la commande.");
      }
    } catch (err) {
      console.error("Erreur réseau :", err);
      showToast('error', "Erreur de connexion au serveur.");
    }
  } else {
    showToast('error', "Veuillez remplir tous les champs correctement.");
  }
}

async function updateOrderStatus(orderId, status) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      showToast('error', errData.error || "Échec de la mise à jour du statut.");
      return;
    }

    order.status = status;
    renderApp();

    const templateParams = {
      name: order.fullname || 'Client',
      email: order.email,
      title: order.productTitle || 'Panier',
      status_label: status === 'accepted' ? 'Acceptée ✅' : 'Refusée ❌'
    };

    if (typeof emailjs !== 'undefined') {
      emailjs.send('service_1il1jx5', 'template_4wf1o58', templateParams)
        .then(() => {
          console.log('Email envoyé au client:', order.email);
        })
        .catch((err) => {
          console.error('Erreur envoi email:', err);
        });
    }
  } catch (err) {
    console.error("Erreur réseau :", err);
    showToast('error', "Erreur de connexion au serveur.");
  }
}

async function deleteNotification(orderId, e) {
  if (e) e.stopPropagation();
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, { 
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      showToast('error', "Échec de la suppression de la demande.");
      return;
    }
    orders = orders.filter(o => o.id !== orderId);
    renderApp();
  } catch (err) {
    console.error("Erreur réseau :", err);
    showToast('error', "Erreur de connexion au serveur.");
  }
}

async function clearAllNotifications() {
  if (!confirm("Voulez-vous supprimer toutes les demandes ?")) return;
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    const response = await fetch(`${API_BASE_URL}/api/orders`, { 
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      showToast('error', "Échec de la suppression des demandes.");
      return;
    }
    orders = [];
    renderApp();
  } catch (err) {
    console.error("Erreur réseau :", err);
    showToast('error', "Erreur de connexion au serveur.");
  }
}

// ==================== HERO SHOWCASE ====================

const HERO_DECOR_ICONS = [
  { color: '#f97316', bg: '#fff7ed', svg: '<svg viewBox="0 0 64 64" width="60%" height="60%"><path fill="#ef4444" d="M32 22c-9 0-16 7.5-16 18 0 10 7 20 16 20s16-10 16-20c0-10.5-7-18-16-18z"/><path fill="#16a34a" d="M32 22c1-6 5-9 10-10-1 5-4 8-8 9" /><ellipse cx="26" cy="30" fill="#fca5a5" opacity="0.6" rx="4" ry="6"/></svg>' },
  { color: '#f59e0b', bg: '#fffbeb', svg: '<svg viewBox="0 0 64 64" width="65%" height="65%"><circle cx="32" cy="34" r="20" fill="#fb923c"/><path fill="#16a34a" d="M30 14c2-4 6-6 10-6-1 4-4 7-8 8z"/><path stroke="#fdba74" stroke-width="2" fill="none" d="M32 16v36M14 34h36M18 22l28 24M18 46l28-24"/></svg>' },
  { color: '#f97316', bg: '#fff7ed', svg: '<svg viewBox="0 0 64 64" width="65%" height="65%"><path fill="#f97316" d="M14 30c0-6 8-16 18-16s18 10 18 16c0 3-2 4-4 4-3-6-9-10-14-10s-11 4-14 10c-2 0-4-1-4-4z"/><rect x="10" y="34" width="44" height="10" rx="5" fill="#fdba74"/><rect x="12" y="44" width="40" height="8" rx="4" fill="#fb923c"/></svg>' },
  { color: '#16a34a', bg: '#f0fdf4', svg: '<svg viewBox="0 0 64 64" width="60%" height="60%"><path fill="#f97316" d="M32 20c8 0 14 8 14 18 0 9-6 16-14 16s-14-7-14-16c0-10 6-18 14-18z"/><path fill="#16a34a" d="M32 20c0-6 3-10 8-12-1 5-3 9-7 11l-1 1z"/><path fill="#16a34a" d="M32 20c0-6-3-10-8-12 1 5 3 9 7 11l1 1z"/></svg>' },
  { color: '#0ea5e9', bg: '#f0f9ff', svg: '<svg viewBox="0 0 64 64" width="55%" height="65%"><path fill="#e0f2fe" stroke="#38bdf8" stroke-width="2" d="M24 8h16l3 10v34a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4V18z"/><rect x="24" y="24" width="16" height="8" fill="#38bdf8"/><text x="32" y="46" font-size="10" text-anchor="middle" fill="#0284c7" font-weight="bold">LAIT</text></svg>' },
  { color: '#65a30d', bg: '#f7fee7', svg: '<svg viewBox="0 0 64 64" width="65%" height="65%"><circle cx="24" cy="38" r="7" fill="#84cc16"/><circle cx="36" cy="38" r="7" fill="#84cc16"/><circle cx="30" cy="26" r="7" fill="#84cc16"/><circle cx="18" cy="26" r="6" fill="#a3e635"/><circle cx="42" cy="26" r="6" fill="#a3e635"/><path stroke="#65a30d" stroke-width="2" fill="none" d="M30 10v10"/></svg>' }
];

function renderHeroShowcase() {
  const box = document.getElementById('hero-products-showcase');
  if (!box) return;

  const layout = [
    { top: '2%',  left: '8%',  size: 130, cls: 'f1' },
    { top: '4%',  left: '58%', size: 100, cls: 'f2' },
    { top: '38%', left: '2%',  size: 95,  cls: 'f3' },
    { top: '34%', left: '68%', size: 140, cls: 'f4' },
    { top: '70%', left: '20%', size: 110, cls: 'f5' },
    { top: '66%', left: '55%', size: 90,  cls: 'f6' }
  ];

  box.innerHTML = `
    <div class="hero-glow-blob w-40 h-40 bg-emerald-300" style="top:10%; left:15%;"></div>
    <div class="hero-glow-blob w-32 h-32 bg-teal-300" style="top:55%; left:60%;"></div>
    ${layout.map((pos, i) => {
      const icon = HERO_DECOR_ICONS[i % HERO_DECOR_ICONS.length];
      return `<div class="hero-float-item ${pos.cls}" style="top:${pos.top}; left:${pos.left}; width:${pos.size}px; height:${pos.size}px; background:${icon.bg}; display:flex; align-items:center; justify-content:center;">
        ${icon.svg}
      </div>`;
    }).join('')}
  `;
}

function openCategoryPage(catId) {
  activeCategoryViewId = catId;
  activeProductId = null;
  activeProductSource = 'category';
  currentView = 'single-category';
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openCataloguePage(catalogueId) {
  activeCategoryViewId = catalogueId;
  activeProductId = null;
  activeProductSource = 'catalogue';
  currentView = 'single-catalogue';
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openProductDetails(containerId, postId, source) {
  activeCategoryViewId = containerId;
  activeProductId = postId;
  activeProductSource = source === 'catalogue' ? 'catalogue' : 'category';
  currentView = 'product-details';
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBackFromProductDetails() {
  if (activeProductSource === 'catalogue') {
    openCataloguePage(activeCategoryViewId);
  } else {
    openCategoryPage(activeCategoryViewId);
  }
}

function openCategoriesView() {
  activeCategoryViewId = null;
  activeProductId = null;
  activeProductSource = 'category';
  currentView = 'categories';
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openAdminView() {
  if (currentUser && currentUser.role === 'admin') {
    currentView = 'admin';
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ==================== RENDERING APP ====================

function renderApp() {
  const t = translations[currentLang];
  document.documentElement.dir = t.dir;

  const langSelect = document.getElementById('lang-select');
  if (langSelect) langSelect.value = currentLang;

  const setTxt = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  };

  setTxt('nav-home', t.home);
  setTxt('nav-categories', t.categories);
  setTxt('nav-products', t.products);
  setTxt('nav-contact', t.contactUs);
  setTxt('lbl-admin-btn', t.admin);
  setTxt('txt-welcome', t.welcome);
  setTxt('txt-connect-sub', t.connectSub);
  setTxt('hero-title', t.heroTitle);
  setTxt('hero-desc', t.heroDesc);
  setTxt('lbl-start', t.start);
  setTxt('lbl-featured-cat', t.featuredCat);
  setTxt('lbl-featured-sub', t.featuredSub);
  setTxt('lbl-back-cat', t.backCat);
  setTxt('lbl-back-prod', t.backProd);
  setTxt('lbl-send-req', t.sendReq);

  const authScreen = document.getElementById('auth-screen');
  const mainApp = document.getElementById('main-app');
  const navAdminBtn = document.getElementById('nav-admin-btn');
  const adminNotifWrapper = document.getElementById('admin-notif-wrapper');
  const notifBadge = document.getElementById('notif-badge');
  const notifList = document.getElementById('notif-list');
  const userCartBadge = document.getElementById('user-cart-badge');
  const userCartList = document.getElementById('user-cart-list');
  const selectMenu = document.getElementById('post-category-select');

  const viewAdmin = document.getElementById('view-admin');
  const viewCategoriesGrid = document.getElementById('view-categories-grid');
  const viewSingleCategory = document.getElementById('view-single-category');
  const viewSingleCatalogue = document.getElementById('view-single-catalogue');
  const viewProductDetails = document.getElementById('view-product-details');

  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
  }

  if (!currentUser) {
    if (authScreen) authScreen.classList.remove('hidden');
    if (mainApp) mainApp.classList.add('hidden');
    if (typeof initAuthVisualEffects === 'function') initAuthVisualEffects();
    return;
  }

  if (authScreen) authScreen.classList.add('hidden');
  if (mainApp) mainApp.classList.remove('hidden');

  const userIdBadge = document.getElementById('user-id-badge');
  const userIdBadgeText = document.getElementById('user-id-badge-text');
  if (userIdBadge && userIdBadgeText) {
    if (currentUser.memberId) {
      userIdBadgeText.innerText = currentUser.memberId;
      userIdBadge.classList.remove('hidden');
      userIdBadge.classList.add('sm:flex');
    } else {
      userIdBadge.classList.add('hidden');
    }
  }

  if (typeof renderHeroShowcase === 'function') renderHeroShowcase();

  // --- CART RENDERING ---
  const userIdentifier = currentUser.email || currentUser.user || currentUser.name;
  const myOrders = orders.filter(o => o.username === userIdentifier || o.userEmail === currentUser.email || o.username === currentUser.user);
  
  if (userCartBadge) {
    if (myOrders.length > 0) {
      userCartBadge.innerText = myOrders.length;
      userCartBadge.classList.remove('hidden');
    } else {
      userCartBadge.classList.add('hidden');
    }
  }

  if (userCartList) {
    userCartList.innerHTML = myOrders.length ? '' : `<p class="text-xs text-slate-400 text-center py-4">Aucune commande effectuée.</p>`;
    myOrders.forEach(ord => {
      let badgeClass = "bg-amber-100 text-amber-700";
      let badgeText = "⏳ En attente";
      if (ord.status === 'accepted') {
        badgeClass = "bg-emerald-100 text-emerald-700";
        badgeText = "✅ Acceptée";
      } else if (ord.status === 'rejected') {
        badgeClass = "bg-red-100 text-red-700";
        badgeText = "❌ Refusée";
      }

      userCartList.innerHTML += `
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
          <div class="flex items-center gap-3">
            ${ord.productImage ? `<img src="${ord.productImage}" class="w-10 h-10 object-cover rounded-lg flex-shrink-0 border">` : ''}
            <div class="flex-grow">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900">${ord.productTitle}</span>
                <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full ${badgeClass}">${badgeText}</span>
              </div>
              <p class="text-slate-500 text-[10px]">Quantité: ${ord.quantity} | Catégorie: ${ord.categoryName}</p>
              <p class="text-[9px] text-slate-400">${ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : ''}</p>
            </div>
          </div>
        </div>
      `;
    });
  }

  // --- ADMIN PANEL RENDERING ---
  const isAdminRole = currentUser.role === 'admin' || currentUser.role === 'ADMIN';

  if (isAdminRole) {
    if (navAdminBtn) navAdminBtn.classList.remove('hidden');
    if (adminNotifWrapper) adminNotifWrapper.classList.remove('hidden');

    if (notifBadge) {
      if (orders.length > 0) {
        notifBadge.innerText = orders.length;
        notifBadge.classList.remove('hidden');
      } else {
        notifBadge.classList.add('hidden');
      }
    }

    if (notifList) {
      notifList.innerHTML = orders.length ? '' : `<p class="text-xs text-slate-400 text-center py-4">Aucune notification.</p>`;
      orders.forEach(ord => {
        let statusColor = "bg-amber-100 text-amber-700";
        let statusLabel = "En attente";
        if (ord.status === 'accepted') {
          statusColor = "bg-emerald-100 text-emerald-700";
          statusLabel = "Acceptée";
        } else if (ord.status === 'rejected') {
          statusColor = "bg-red-100 text-red-700";
          statusLabel = "Refusée";
        }

        notifList.innerHTML += `
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
            <div class="flex items-center gap-3">
              ${ord.productImage ? `<img src="${ord.productImage}" class="w-10 h-10 object-cover rounded-lg flex-shrink-0 border">` : ''}
              <div class="flex-grow">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-900">${ord.fullname}</span>
                  <span class="text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColor}">${statusLabel}</span>
                </div>
                <p class="text-slate-600">${ord.productTitle} x${ord.quantity}</p>
                <p class="text-[10px] text-slate-400">Email: ${ord.email}</p>
              </div>
            </div>
            
            <div class="flex items-center gap-1.5 pt-1 border-t border-slate-100">
              <button onclick="updateOrderStatus('${ord.id}', 'accepted')" class="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition">
                Accepter
              </button>
              <button onclick="updateOrderStatus('${ord.id}', 'rejected')" class="flex-1 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[10px] transition">
                Refuser
              </button>
              <button onclick="deleteNotification('${ord.id}', event)" class="p-1 text-slate-400 hover:text-red-500 rounded-lg text-xs transition" title="Supprimer">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        `;
      });
    }
  } else {
    if (navAdminBtn) navAdminBtn.classList.add('hidden');
    if (adminNotifWrapper) adminNotifWrapper.classList.add('hidden');
    if (currentView === 'admin') {
      currentView = 'home';
    }
  }

  if (selectMenu) {
    selectMenu.innerHTML = `<option value="" disabled selected>-- Choisir catégorie / catalogue --</option>`;
    if (categories.length) {
      selectMenu.innerHTML += `<optgroup label="Catégories">`;
      categories.forEach(cat => {
        selectMenu.innerHTML += `<option value="category:${cat.id}">${cat.name}</option>`;
      });
      selectMenu.innerHTML += `</optgroup>`;
    }
    if (catalogues.length) {
      selectMenu.innerHTML += `<optgroup label="Catalogues">`;
      catalogues.forEach(cat => {
        selectMenu.innerHTML += `<option value="catalogue:${cat.id}">${cat.name}</option>`;
      });
      selectMenu.innerHTML += `</optgroup>`;
    }
  }

  if (viewAdmin) viewAdmin.classList.add('hidden');
  if (viewCategoriesGrid) viewCategoriesGrid.classList.add('hidden');
  if (viewSingleCategory) viewSingleCategory.classList.add('hidden');
  if (viewSingleCatalogue) viewSingleCatalogue.classList.add('hidden');
  if (viewProductDetails) viewProductDetails.classList.add('hidden');

  if (currentView === 'admin' && isAdminRole) {
    if (viewAdmin) viewAdmin.classList.remove('hidden');
    const adminOrdersContainer = document.getElementById('admin-orders-container');
    if (adminOrdersContainer) {
      adminOrdersContainer.innerHTML = orders.length ? '' : `<p class="text-xs text-slate-400">Aucune commande reçue.</p>`;
      orders.forEach(ord => {
        let badgeClass = "bg-amber-100 text-amber-700";
        let badgeText = "⏳ En attente";
        if (ord.status === 'accepted') {
          badgeClass = "bg-emerald-100 text-emerald-700";
          badgeText = "✅ Acceptée";
        } else if (ord.status === 'rejected') {
          badgeClass = "bg-red-100 text-red-700";
          badgeText = "❌ Refusée";
        }

        adminOrdersContainer.innerHTML += `
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div class="flex items-center gap-4">
              ${ord.productImage ? `<img src="${ord.productImage}" class="w-14 h-14 object-cover rounded-xl border border-slate-200">` : ''}
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <p class="font-bold text-slate-900">${ord.productTitle}</p>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${badgeClass}">${badgeText}</span>
                </div>
                <p class="text-slate-600">Client: <b>${ord.fullname}</b> (${ord.email}) | Tel: ${ord.phone}</p>
                <p class="text-slate-400 text-[10px]">Catégorie: ${ord.categoryName} | Quantité: ${ord.quantity} | ${ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : ''}</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button onclick="updateOrderStatus('${ord.id}', 'accepted')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition">
                Accepter
              </button>
              <button onclick="updateOrderStatus('${ord.id}', 'rejected')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition">
                Refuser
              </button>
              <button onclick="deleteNotification('${ord.id}', event)" class="px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 font-bold rounded-lg text-xs transition">
                Supprimer
              </button>
            </div>
          </div>
        `;
      });
    }
  } else if (currentView === 'single-category' && activeCategoryViewId) {
    if (viewSingleCategory) viewSingleCategory.classList.remove('hidden');
    const cat = categories.find(c => c.id === activeCategoryViewId);
    if (cat) {
      document.getElementById('category-details-header').innerHTML = `<h4 class="font-bold text-sm text-slate-900">${cat.name}</h4>`;
      let postsHTML = '';

      cat.posts.forEach(p => {
        postsHTML += `
          <div onclick="openProductDetails('${cat.id}', '${p.id}', 'category')" class="product-tile cursor-pointer relative bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition" title="${p.title.replace(/"/g, '&quot;')}">
            <img src="${p.image}" alt="${p.title.replace(/"/g, '&quot;')}" loading="lazy" class="w-full h-48 object-cover">
            <div class="p-4 space-y-1">
              <h5 class="font-bold text-sm text-slate-900">${p.title}</h5>
              <p class="text-xs text-slate-500 line-clamp-2">${p.description || ''}</p>
            </div>

            ${isAdminRole ? `
              <div class="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm p-1 rounded-xl shadow-md border border-slate-100 z-10">
                <button onclick="openEditProductModal('category', '${cat.id}', '${p.id}', event)" class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition flex items-center justify-center text-xs" title="Modifier">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="deletePost('category', '${cat.id}', '${p.id}', event)" class="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition flex items-center justify-center text-xs" title="Supprimer">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });

      const container = document.getElementById('category-products-container');
      if (container) {
        container.innerHTML = `
          ${isAdminRole ? `
            <div class="flex justify-end mb-4">
              <button onclick="openQuickAddProduct('${cat.id}')" class="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-emerald-700 transition flex items-center gap-2">
                <i class="fa-solid fa-plus"></i> Ajouter un produit
              </button>
            </div>
          ` : ''}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            ${postsHTML || `<p class="col-span-full text-xs text-slate-400 text-center py-8">${t.noProducts}</p>`}
          </div>
        `;
      }
    }
  } else if (currentView === 'single-catalogue' && activeCategoryViewId) {
    if (viewSingleCatalogue) viewSingleCatalogue.classList.remove('hidden');
    const catalogue = catalogues.find(c => c.id === activeCategoryViewId);
    if (catalogue) {
      document.getElementById('catalogue-banner-header').innerHTML = `
        <div class="relative rounded-3xl overflow-hidden h-48 sm:h-64 border border-slate-200">
          <img src="${catalogue.image}" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent flex flex-col justify-end p-6 text-white">
            <h3 class="text-2xl font-black">${catalogue.name}</h3>
            <p class="text-xs font-semibold text-emerald-300">${formatCatalogueDateRange(catalogue.dateFrom, catalogue.dateTo)}</p>
          </div>
        </div>
      `;

      let postsHTML = '';

      catalogue.posts.forEach(p => {
        postsHTML += `
          <div onclick="openProductDetails('${catalogue.id}', '${p.id}', 'catalogue')" class="product-tile cursor-pointer relative bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition" title="${p.title.replace(/"/g, '&quot;')}">
            <img src="${p.image}" alt="${p.title.replace(/"/g, '&quot;')}" loading="lazy" class="w-full h-48 object-cover">
            <div class="p-4 space-y-1">
              <h5 class="font-bold text-sm text-slate-900">${p.title}</h5>
              <p class="text-xs text-slate-500 line-clamp-2">${p.description || ''}</p>
            </div>

            ${isAdminRole ? `
              <div class="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm p-1 rounded-xl shadow-md border border-slate-100 z-10">
                <button onclick="openEditProductModal('catalogue', '${catalogue.id}', '${p.id}', event)" class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition flex items-center justify-center text-xs" title="Modifier">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="deletePost('catalogue', '${catalogue.id}', '${p.id}', event)" class="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition flex items-center justify-center text-xs" title="Supprimer">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });

      const container = document.getElementById('catalogue-products-container');
      if (container) {
        container.innerHTML = `
          ${isAdminRole ? `
            <div class="flex justify-end mb-4">
              <button onclick="openQuickAddCatalogueProduct('${catalogue.id}')" class="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-emerald-700 transition flex items-center gap-2">
                <i class="fa-solid fa-plus"></i> Ajouter un produit au catalogue
              </button>
            </div>
          ` : ''}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            ${postsHTML || `<p class="col-span-full text-xs text-slate-400 text-center py-8">${t.noProducts}</p>`}
          </div>
        `;
      }
    }
  } else if (currentView === 'product-details' && activeProductId && activeCategoryViewId) {
    if (viewProductDetails) viewProductDetails.classList.remove('hidden');
    const container = findContainer(activeProductSource, activeCategoryViewId);
    const prod = container ? container.posts.find(p => p.id === activeProductId) : null;

    if (prod) {
      document.getElementById('detail-product-image').src = prod.image;
      document.getElementById('detail-product-title').innerText = prod.title;
      document.getElementById('detail-product-desc').innerText = prod.description || '';
    }
  } else {
    if (viewCategoriesGrid) viewCategoriesGrid.classList.remove('hidden');

    const cataloguesContainer = document.getElementById('catalogues-container');
    if (cataloguesContainer) {
      cataloguesContainer.innerHTML = catalogues.length ? '' : `<p class="text-xs text-slate-400 text-center py-4">Aucun catalogue actif pour le moment.</p>`;

      catalogues.forEach(cat => {
        cataloguesContainer.innerHTML += `
          <div onclick="openCataloguePage('${cat.id}')" class="group relative rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer h-56 bg-slate-900">
            <img src="${cat.image}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent flex flex-col justify-end p-6 text-white">
              <h4 class="text-xl font-black">${cat.name}</h4>
              <p class="text-xs text-emerald-400 font-bold mb-1">${formatCatalogueDateRange(cat.dateFrom, cat.dateTo)}</p>
              <p class="text-xs text-slate-300">${cat.posts.length} produit(s)</p>
            </div>

            ${isAdminRole ? `
              <div class="absolute top-4 right-4 flex items-center gap-2 z-20">
                <button onclick="openEditCatalogueModal('${cat.id}', event)" class="w-8 h-8 rounded-xl bg-white/90 text-emerald-600 hover:bg-emerald-600 hover:text-white transition flex items-center justify-center text-xs shadow-md">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="deleteCatalogue('${cat.id}', event)" class="w-8 h-8 rounded-xl bg-white/90 text-rose-600 hover:bg-rose-600 hover:text-white transition flex items-center justify-center text-xs shadow-md">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });
    }

    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
      postsContainer.innerHTML = categories.length ? '' : `<p class="col-span-full text-xs text-slate-400 text-center py-8">${t.noCategories}</p>`;

      categories.forEach(cat => {
        postsContainer.innerHTML += `
          <div onclick="openCategoryPage('${cat.id}')" class="group relative bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between">
            ${isAdminRole ? `
              <div class="absolute top-4 right-4 flex items-center gap-1.5 z-20">
                <button onclick="openEditCategoryModal('${cat.id}', event)" class="w-8 h-8 rounded-xl bg-white/90 text-emerald-600 hover:bg-emerald-600 hover:text-white transition flex items-center justify-center text-xs shadow-md">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="deleteCategory('${cat.id}', event)" class="w-8 h-8 rounded-xl bg-white/90 text-rose-600 hover:bg-rose-600 hover:text-white transition flex items-center justify-center text-xs shadow-md">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            ` : ''}

            <div class="space-y-4">
              <div class="h-40 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                ${cat.image ? `<img src="${cat.image}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">` : `<div class="w-full h-full flex items-center justify-center text-slate-300"><i class="fa-solid fa-image text-3xl"></i></div>`}
              </div>
              <div>
                <h4 class="font-black text-slate-900 text-base">${cat.name}</h4>
                <p class="text-xs text-slate-400 font-semibold">${cat.posts.length} produit(s)</p>
              </div>
            </div>

            <div class="pt-4">
              <span class="w-full py-2.5 bg-slate-50 group-hover:bg-emerald-600 text-slate-700 group-hover:text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
                ${t.view} <i class="fa-solid fa-arrow-right text-[10px]"></i>
              </span>
            </div>
          </div>
        `;
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof loadData === 'function') {
    await loadData();
  }
  renderApp();
});
