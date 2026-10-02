<?php
/**
 * Security, CORS, Authentication & WordPress Hardening
 */

if (!defined('ABSPATH')) {
    exit;
}

// ─── 1. CORS Headers & Preflight Handling ─────────────────────────
add_action('init', function () {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? rtrim($_SERVER['HTTP_ORIGIN'], '/') : '';
    
    if (in_array($origin, BRANDELIER_ALLOWED_ORIGINS, true)) {
        header("Access-Control-Allow-Origin: $origin");
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, X-Brandelier-Key, X-Requested-With");
        header("Access-Control-Allow-Credentials: true");
    }

    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        status_header(200);
        exit;
    }
});

// ─── 2. REST API Master Lockdown ──────────────────────────────────
add_filter('rest_authentication_errors', function ($result) {
    if (is_wp_error($result)) {
        return $result;
    }

    // Allow logged-in CMS administrators / editors
    if (is_user_logged_in()) {
        return $result;
    }

    $rest_route = $GLOBALS['wp']->query_vars['rest_route'] ?? '';
    if (empty($rest_route) && isset($_SERVER['REQUEST_URI'])) {
        $rest_route = $_SERVER['REQUEST_URI'];
    }

    // Allow our public form endpoints (which perform origin + token validation)
    if (
        strpos($rest_route, '/brandelier/v1/apply') !== false ||
        strpos($rest_route, '/brandelier/v1/contact') !== false
    ) {
        return $result;
    }

    // Allow authorized Astro queries carrying the private API Key
    $incoming_key = $_SERVER['HTTP_X_BRANDELIER_KEY'] ?? '';
    if (!empty($incoming_key) && hash_equals(BRANDELIER_API_SECRET, $incoming_key)) {
        return $result;
    }

    return new WP_Error(
        'brandelier_access_denied',
        'Direct access to cms.brandelier.in endpoints is restricted to authorized applications.',
        ['status' => 403]
    );
});

// ─── 3. Block User Enumeration ────────────────────────────────────
add_filter('rest_endpoints', function ($endpoints) {
    if (!is_user_logged_in()) {
        unset($endpoints['/wp/v2/users']);
        unset($endpoints['/wp/v2/users/(?P<id>[\d]+)']);
    }
    return $endpoints;
});

// ─── 4. General WordPress Hardening ───────────────────────────────
add_filter('xmlrpc_enabled', '__return_false');
remove_action('wp_head', 'wp_generator');
add_filter('the_generator', '__return_empty_string');

// ─── 5. Mail Failure Logger ───────────────────────────────────────
add_action('wp_mail_failed', function ($wp_error) {
    error_log('[Brandelier API wp_mail_failed] ' . $wp_error->get_error_message());
});

// ─── 6. Shared Security Helpers ───────────────────────────────────
function brandelier_validate_origin(): bool {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? rtrim($_SERVER['HTTP_ORIGIN'], '/') : '';
    $referer = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '';

    if (empty($origin) && empty($referer)) {
        return true; // Direct internal call
    }

    foreach (BRANDELIER_ALLOWED_ORIGINS as $allowed) {
        if ($origin === $allowed || strpos($referer, $allowed) === 0) {
            return true;
        }
    }
    return false;
}

function brandelier_validate_token($token): bool {
    return (!empty($token) && hash_equals(BRANDELIER_FORM_TOKEN, (string) $token));
}

function brandelier_check_rate_limit(string $action_prefix, int $max = 5, int $seconds = 600): bool {
    $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    $transient_key = 'bnd_' . $action_prefix . '_' . md5($ip);
    $attempts = (int) get_transient($transient_key);

    if ($attempts >= $max) {
        return false;
    }
    set_transient($transient_key, $attempts + 1, $seconds);
    return true;
}
