# Brandelier Suite - WordPress API Plugin

A modular, lightweight WordPress plugin built specifically to connect **brandelier.in** (Astro frontend) with **cms.brandelier.in** (WordPress backend).

## File Structure

```
brandelier-api/
├── brandelier-api.php          # Main entry point & configuration constants
├── README.md                   # Plugin documentation
└── includes/
    ├── security.php            # CORS headers, REST master lockdown, rate limiters, honeypot
    ├── elementor-pro.php       # Contact form endpoint (/contact), Elementor Submissions & email triggers
    ├── hirezoot-jobs.php       # Job applications endpoint (/apply), resume uploads & email triggers
    └── rank-math-seo.php       # Exposes Rank Math SEO meta & rendered tags to REST API
```

## How to Install / Update in WordPress

### Option A: Upload via WordPress Admin
1. Zip the `brandelier-api` folder into `brandelier-api.zip`.
2. Go to your WordPress Admin dashboard: **Plugins → Add New → Upload Plugin**.
3. Choose `brandelier-api.zip` and click **Install Now**, then **Activate Plugin**.

### Option B: Copy via Hostinger File Manager / FTP
1. Open Hostinger File Manager or connect via FTP.
2. Navigate to: `public_html/wp-content/plugins/`
3. Upload the entire `brandelier-api/` directory so it lives at:
   `public_html/wp-content/plugins/brandelier-api/`
4. Go to **WordPress Admin → Plugins** and ensure **Brandelier Suite - API Gateway & Integrations** is active.

## Endpoints Provided

- `POST /wp-json/brandelier/v1/contact`:
  Saves submissions into Elementor Pro Submissions (`Elementor` → `Submissions`) and sends admin notification (`Info@brandelier.in`) and visitor auto-responder emails.
- `POST /wp-json/brandelier/v1/apply`:
  Saves job applications into HireZoot / WP Job Openings, uploads the resume, and triggers both Applicant and Admin notification emails with resume attachment.
- `GET /wp-json/wp/v2/posts`, `GET /wp-json/wp/v2/pages`, `GET /wp-json/wp/v2/awsm_job_openings`:
  Includes the `rank_math_seo` field and `rank_math_head` HTML tags.
