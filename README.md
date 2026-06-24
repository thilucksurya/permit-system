permit-system/

├── index.html              # Entry point — login page

├── css/

│   ├── auth.css            # Authentication page styles

│   └── dashboard.css       # Dashboard and permit management styles

├── js/

│   ├── auth.js             # Authentication logic (login, register, logout)

│   ├── validation.js       # Client-side form validation

│   └── permits.js          # Permit CRUD operations

├── pages/

│   ├── register.html       # User registration

│   ├── forgot-password.html # Password recovery

│   └── dashboard.html      # Main application dashboard

├── sql/

│   └── functions.sql       # PL/pgSQL stored functions

├── db/

│   └── schema.sql          # Database schema and RLS policies

└── .gitignore


---

## 🚀 Local Setup

**Prerequisites:** A modern web browser and a Supabase account (free tier is sufficient).

**Step 1 — Clone the repository**
```bash
git clone https://github.com/thilucksurya/permit-system.git
cd permit-system
```

**Step 2 — Configure Supabase**
1. Create a project at [supabase.com](https://supabase.com)
2. Run the schema from `db/schema.sql` in the Supabase SQL editor
3. Run the stored functions from `sql/functions.sql`
4. Copy your Project URL and anon key

**Step 3 — Add environment config**

Create `js/config.js`:
```javascript
const SUPABASE_URL = 'your-project-url';
const SUPABASE_KEY = 'your-anon-key';
```

**Step 4 — Open locally**
```bash
# Use any local server — e.g., VS Code Live Server
# Or open index.html directly in browser
```

---

## 📌 Key Technical Decisions

**Why PL/pgSQL stored functions instead of client-side validation only?**
Client-side validation can be bypassed via browser dev tools or direct API calls. Enforcing business rules at the PostgreSQL layer via stored functions makes the data integrity guarantees unconditional — regardless of how the API is called.

**Why JAMstack for a permit management system?**
Static hosting (GitHub Pages) is zero-cost, infinitely scalable, and has no server maintenance overhead. Supabase provides the managed backend with built-in auth and PostgreSQL, making this a production-viable architecture for small to medium logistics operations.

---

## 👤 Author

**Thiluck Surya S**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://linkedin.com/in/thiluck-surya-s)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/thilucksurya)
[![Email](https://img.shields.io/badge/Email-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:thiluckmath20@nct.ac.in)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
