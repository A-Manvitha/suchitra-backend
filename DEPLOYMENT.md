# 🚀 Suchitra Financial Services — Full Deployment Guide

## Project Architecture

```
suchitra-financial/
├── frontend/          ← React app (your index.jsx)
│   └── src/
│       ├── App.jsx    ← your index__1_.jsx renamed
│       └── api.js     ← provided API service
└── backend/           ← Node.js / Express API
    ├── server.js
    ├── routes/
    ├── models/
    ├── middleware/
    └── utils/
```

---

## PART 1 — Local Development Setup

### Prerequisites
- **Node.js** v18+ — https://nodejs.org
- **MongoDB** v6+ — https://www.mongodb.com/try/download/community
- **Git** — https://git-scm.com

### Step 1: Set up the Backend

```bash
# 1. Enter the backend folder
cd suchitra-backend

# 2. Install dependencies
npm install

# 3. Create your .env file from template
cp .env.example .env

# 4. Edit .env — fill in MongoDB URI, email, JWT secret:
nano .env   # or use VS Code

# 5. Start MongoDB (if running locally)
mongod --dbpath /data/db     # Linux/Mac
# OR install and start the MongoDB service on Windows

# 6. Create the default admin account (run once)
node scripts/seed.js

# 7. Start the backend server
npm run dev        # development (auto-restarts)
# or
npm start          # production
```

Backend will run on: **http://localhost:5000**

### Step 2: Set up the Frontend

```bash
# 1. Create React app (if not done already)
npx create-react-app suchitra-frontend
cd suchitra-frontend

# 2. Copy your index__1_.jsx → src/App.jsx

# 3. Copy the api.js file into src/api.js

# 4. Create .env in frontend root:
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env

# 5. Start the frontend
npm start
```

Frontend will run on: **http://localhost:3000**

---

## PART 2 — Connecting Frontend Forms to Backend

### Contact Page Form (`ContactPage` component)

Replace the `handleSubmit` function:

```js
import api from './api';   // add at top of file

// Inside ContactPage component:
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await api.submitLead({
      name:          form.name,
      phone:         form.phone,
      email:         form.email,
      loanType:      form.loanType,
      message:       form.message,
      source:        "Website",
    });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  } catch (err) {
    alert("Submission failed. Please try again or WhatsApp us.");
  }
};
```

### Services Page Apply Form (`ServicesPage` component)

```js
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await api.submitLead({
      name:          form.name,
      phone:         form.phone,
      email:         form.email || "",
      loanType:      svc.title,
      loanAmount:    parseFloat(form.amount?.replace(/[^0-9]/g, "")) || 0,
      source:        "Website",
    });
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setActive(null); }, 3000);
  } catch (err) {
    alert("Submission failed. Please WhatsApp us.");
  }
};
```

### Admin Dashboard — Real API Integration

Replace `DEMO_LEADS` with real API calls in `AdminPage`:

```js
import api from './api';   // at top

// In AdminPage component:
const [authed, setAuthed] = useState(false);
const [leads, setLeads]   = useState([]);
const [stats, setStats]   = useState({});
const [loading, setLoading] = useState(false);

// Login handler:
const handleLogin = async () => {
  try {
    await api.login("admin@suchitrafinancial.com", pw);
    setAuthed(true);
    loadLeads();
  } catch (err) {
    alert("Invalid credentials");
  }
};

// Load leads:
const loadLeads = async () => {
  setLoading(true);
  try {
    const [leadsData, statsData] = await Promise.all([api.getLeads(), api.getStats()]);
    setLeads(leadsData.leads);
    setStats(statsData.stats);
  } finally {
    setLoading(false);
  }
};

// Update status:
const updateStatus = async (id, status) => {
  await api.updateLeadStatus(id, status);
  setLeads(leads.map(l => l._id === id ? { ...l, status } : l));
  setSelected(null);
};

// Export CSV:
const handleExport = () => api.exportCSV();
```

---

## PART 3 — Production Deployment

### Option A: Deploy on Render.com (Recommended — Free Tier Available)

#### Backend on Render

1. Push backend code to GitHub:
   ```bash
   git init && git add . && git commit -m "Initial backend"
   git remote add origin https://github.com/YOUR_USERNAME/suchitra-backend.git
   git push -u origin main
   ```

2. Go to **render.com** → New → **Web Service**

3. Connect your GitHub repo

4. Settings:
   - **Name**: `suchitra-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. Add **Environment Variables** in Render dashboard:
   ```
   NODE_ENV         = production
   MONGODB_URI      = (your MongoDB Atlas URI)
   JWT_SECRET       = (run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
   ADMIN_EMAIL      = admin@suchitrafinancial.com
   ADMIN_PASSWORD   = YourStrongPassword@123
   EMAIL_SERVICE    = gmail
   EMAIL_USER       = suchitrafinserv@gmail.com
   EMAIL_PASS       = (your Gmail App Password)
   FRONTEND_URL     = https://your-frontend-domain.vercel.app
   ```

6. After deploy, run seed:
   ```
   POST https://suchitra-backend.onrender.com/api/auth/seed
   ```

#### Frontend on Vercel

1. Push frontend to GitHub

2. Go to **vercel.com** → Import Project

3. Add Environment Variable:
   ```
   REACT_APP_API_URL = https://suchitra-backend.onrender.com/api
   ```

4. Deploy → your site will be live at `https://suchitra-financial.vercel.app`

---

### Option B: Deploy on a VPS (DigitalOcean / AWS EC2 / Hetzner)

#### Server Setup (Ubuntu 22.04)

```bash
# 1. Update server
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod && sudo systemctl enable mongod

# 4. Install Nginx
sudo apt install -y nginx

# 5. Install PM2 (process manager)
sudo npm install -g pm2

# 6. Clone and setup backend
git clone https://github.com/YOUR_USERNAME/suchitra-backend.git /var/www/suchitra-backend
cd /var/www/suchitra-backend
npm install --production
cp .env.example .env
nano .env           # fill in real values
node scripts/seed.js
pm2 start server.js --name suchitra-api
pm2 startup && pm2 save

# 7. Build and serve frontend
git clone https://github.com/YOUR_USERNAME/suchitra-frontend.git /var/www/suchitra-frontend
cd /var/www/suchitra-frontend
echo "REACT_APP_API_URL=https://suchitrafinancial.com/api" > .env
npm install && npm run build
```

#### Nginx Configuration

```nginx
# /etc/nginx/sites-available/suchitra

server {
    listen 80;
    server_name suchitrafinancial.com www.suchitrafinancial.com;

    # Frontend (React build)
    root /var/www/suchitra-frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API — proxy to Node.js
    location /api/ {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site and add SSL
sudo ln -s /etc/nginx/sites-available/suchitra /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Free SSL with Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d suchitrafinancial.com -d www.suchitrafinancial.com
```

---

### Option C: MongoDB Atlas (Cloud Database — recommended for production)

1. Go to **mongodb.com/atlas** → Create free cluster
2. Create a database user with a strong password
3. Whitelist IP: `0.0.0.0/0` (or your server's IP)
4. Get your connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/suchitra_financial
   ```
5. Set this as `MONGODB_URI` in your `.env`

---

## PART 4 — API Reference

### Public Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/leads/submit` | Submit loan application from website |
| `POST` | `/api/email/contact` | Send contact form message |
| `GET`  | `/api/health` | Check server/DB status |

### Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Admin login → returns JWT |
| `GET`  | `/api/auth/me` | Get current admin profile |
| `PUT`  | `/api/auth/change-password` | Change admin password |
| `POST` | `/api/auth/seed` | Create first superadmin (run once!) |

### Admin Endpoints (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/api/leads` | List all leads (paginated, filterable) |
| `GET`    | `/api/leads/stats` | Dashboard statistics |
| `GET`    | `/api/leads/:id` | Get single lead |
| `PATCH`  | `/api/leads/:id/status` | Update lead status |
| `PATCH`  | `/api/leads/:id` | Update lead details/notes |
| `DELETE` | `/api/leads/:id` | Soft-delete lead |
| `GET`    | `/api/leads/export/csv` | Download all leads as CSV |

### POST /api/leads/submit — Request Body

```json
{
  "name": "Ramesh Kumar",
  "phone": "9876543210",
  "email": "ramesh@email.com",
  "loanType": "Home Loan",
  "loanAmount": 4500000,
  "monthlyIncome": 85000,
  "existingEMI": 10000,
  "occupation": "Salaried",
  "message": "Looking for home loan under PMAY scheme",
  "source": "Website"
}
```

---

## PART 5 — Email Setup (Gmail)

1. Enable 2-Step Verification on your Gmail account
2. Go to: **Google Account → Security → App passwords**
3. Generate a password for "Mail" + "Windows Computer"
4. Copy the 16-character password → set as `EMAIL_PASS` in `.env`

Emails will be sent:
- **To admin** — on every new lead submission
- **To lead** — acknowledgement (if email provided)
- **To lead** — status update when changed to Approved/Rejected/In Progress

---

## PART 6 — Security Checklist Before Going Live

- [ ] Change default admin password after first login
- [ ] Set a strong random `JWT_SECRET` (64+ chars)
- [ ] Remove or protect the `/api/auth/seed` endpoint
- [ ] Use MongoDB Atlas or enable MongoDB authentication
- [ ] Enable HTTPS/SSL on your domain
- [ ] Set `FRONTEND_URL` in `.env` to your actual domain (not `*`)
- [ ] Set up regular MongoDB backups (Atlas does this automatically)
- [ ] Keep `NODE_ENV=production` in deployment environment

---

## PART 7 — Estimated Costs (Monthly)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel (Frontend) | ✅ Free | — |
| Render (Backend) | ✅ Free (spins down after inactivity) | $7/mo (always-on) |
| MongoDB Atlas | ✅ Free 512MB | $9/mo (dedicated) |
| Domain (`.com`) | — | ~$10/year |
| SSL Certificate | ✅ Free (Let's Encrypt) | — |
| **Total** | **~₹0/month** | **~₹1,400/month** |

---

## PART 8 — Domain Registration (for suchitrafinancial.com)

1. Check availability: **GoDaddy**, **Namecheap**, or **Google Domains**
2. Register `suchitrafinancial.com` (~$10/year)
3. Point DNS to Vercel/Render:
   - Add `CNAME` record for `www` → your Vercel/Render URL
   - Add `A` record for `@` → your server IP (VPS) or Vercel IP

---

*Built for Suchitra Financial Services. Support: suchitrafinserv@gmail.com | +91 99499 03372*
