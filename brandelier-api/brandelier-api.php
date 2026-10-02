<?php
/**
 * Plugin Name: Brandelier Suite - API Gateway & Integrations
 * Plugin URI:  https://brandelier.in
 * Description: Modular gateway connecting brandelier.in with cms.brandelier.in — Security, Elementor Pro Submissions, HireZoot Applications, and Rank Math SEO.
 * Version:     3.0.0
 * Author:      Brandelier
 * Author URI:  https://brandelier.in
 * Text Domain: brandelier-api
 */

if (!defined('ABSPATH')) {
    exit;
}

// ─── Constants & Configuration ────────────────────────────────────
define('BRANDELIER_PLUGIN_VERSION', '3.0.0');
define('BRANDELIER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BRANDELIER_PLUGIN_URL', plugin_dir_url(__FILE__));

if (!defined('BRANDELIER_API_SECRET')) {
    define('BRANDELIER_API_SECRET', 'bnd_sec_7f9c4e2a8d1b6e5f3c0a4e7d9b2a1c8f5e6d3a2b1c0e9f8a7b6c5d4e3f2a1b0c');
}

if (!defined('BRANDELIER_FORM_TOKEN')) {
    define('BRANDELIER_FORM_TOKEN', 'bnd_form_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d');
}

if (!defined('BRANDELIER_ALLOWED_ORIGINS')) {
    define('BRANDELIER_ALLOWED_ORIGINS', [
        'https://brandelier.in',
        'https://www.brandelier.in',
        'http://localhost:4321',
        'http://localhost:3000',
    ]);
}

// ─── Load Modules ─────────────────────────────────────────────────
require_once BRANDELIER_PLUGIN_DIR . 'includes/security.php';
require_once BRANDELIER_PLUGIN_DIR . 'includes/elementor-pro.php';
require_once BRANDELIER_PLUGIN_DIR . 'includes/hirezoot-jobs.php';
require_once BRANDELIER_PLUGIN_DIR . 'includes/rank-math-seo.php';
