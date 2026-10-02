<?php
/**
 * Elementor Pro Form Integration, Submissions Storage & Email Notifications
 */

if (!defined('ABSPATH')) {
    exit;
}

// ─── 1. Register Inquiries Post Type (Admin Sidebar) ───────────────
add_action('init', function () {
    register_post_type('brandelier_inquiry', [
        'labels' => [
            'name'               => 'Contact Inquiries',
            'singular_name'      => 'Contact Inquiry',
            'menu_name'          => 'Inquiries',
            'all_items'          => 'All Inquiries',
            'search_items'       => 'Search Inquiries',
            'not_found'          => 'No inquiries found',
            'not_found_in_trash' => 'No inquiries found in Trash',
        ],
        'public'       => false,
        'show_ui'      => true,
        'show_in_menu' => true,
        'menu_position'=> 25,
        'menu_icon'    => 'dashicons-email-alt',
        'supports'     => ['title', 'editor'],
    ]);
});

// Custom Admin Columns for Inquiries List in WordPress Admin
add_filter('manage_brandelier_inquiry_posts_columns', function ($columns) {
    return [
        'cb'              => '<input type="checkbox" />',
        'title'           => 'Subject / Client',
        'client_name'     => 'Name',
        'client_email'    => 'Email',
        'client_phone'    => 'Phone',
        'client_service'  => 'Service',
        'message_snippet' => 'Message Preview',
        'date'            => 'Date',
    ];
});

add_action('manage_brandelier_inquiry_posts_custom_column', function ($column, $post_id) {
    switch ($column) {
        case 'client_name':
            echo esc_html(get_post_meta($post_id, 'client_name', true));
            break;
        case 'client_email':
            $email = get_post_meta($post_id, 'client_email', true);
            echo $email ? sprintf('<a href="mailto:%s" style="font-weight:600; color:#ff2d78;">%s</a>', esc_attr($email), esc_html($email)) : '—';
            break;
        case 'client_phone':
            $phone = get_post_meta($post_id, 'client_phone', true);
            echo $phone ? sprintf('<a href="tel:%s">%s</a>', esc_attr($phone), esc_html($phone)) : '—';
            break;
        case 'client_service':
            $srv = get_post_meta($post_id, 'client_service', true);
            echo sprintf('<span style="background:#f0f0f1; padding:3px 8px; border-radius:4px; font-size:12px;">%s</span>', esc_html($srv ?: 'General'));
            break;
        case 'message_snippet':
            echo esc_html(wp_trim_words(get_post_field('post_content', $post_id), 12));
            break;
    }
}, 10, 2);

// ─── 2. Register REST Route ───────────────────────────────────────
add_action('rest_api_init', function () {
    register_rest_route('brandelier/v1', '/contact', [
        'methods'             => ['POST', 'GET'],
        'callback'            => 'brandelier_handle_contact',
        'permission_callback' => '__return_true',
    ]);
});

// ─── 3. Contact Form Submission Handler ───────────────────────────
function brandelier_handle_contact(WP_REST_Request $request) {
    if ($request->get_method() === 'GET') {
        return new WP_REST_Response([
            'status'  => 'active',
            'message' => 'Brandelier Contact Gateway is active. Submissions accepted via POST only.',
        ], 200);
    }

    if (!brandelier_validate_origin()) {
        return new WP_REST_Response(['success' => false, 'message' => 'Unauthorized origin.'], 403);
    }

    // Honeypot check
    if (!empty($request->get_param('brandelier_hp_catch'))) {
        return new WP_REST_Response(['success' => true, 'message' => 'Message received.'], 200);
    }

    // Token check
    if (!brandelier_validate_token($request->get_param('form_token'))) {
        return new WP_REST_Response(['success' => false, 'message' => 'Invalid or expired session. Please refresh and try again.'], 403);
    }

    // Rate Limiting
    if (!brandelier_check_rate_limit('contact', 5, 600)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Too many messages submitted from your connection. Please wait 10 minutes before trying again.',
        ], 429);
    }

    // Sanitize Inputs
    $name    = sanitize_text_field($request->get_param('name'));
    $email   = sanitize_email($request->get_param('email'));
    $phone   = sanitize_text_field($request->get_param('phone'));
    $service = sanitize_text_field($request->get_param('service'));
    $message = sanitize_textarea_field($request->get_param('message'));
    $ip      = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');

    $errors = [];
    if (empty($name))                       $errors[] = 'Full name is required.';
    if (empty($email) || !is_email($email)) $errors[] = 'A valid email is required.';
    if (empty($message))                    $errors[] = 'Message is required.';

    if (!empty($errors)) {
        return new WP_REST_Response(['success' => false, 'message' => implode(' ', $errors)], 400);
    }

    if (empty($service)) {
        $service = 'General Inquiry';
    }

    // ── A. Save into Elementor Pro Submissions Table ─────────────────
    global $wpdb;
    $e_submissions_table = $wpdb->prefix . 'e_submissions';
    $e_values_table      = $wpdb->prefix . 'e_submissions_values';
    $elementor_saved     = false;
    $submission_id       = null;

    $has_elementor_table = ($wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $e_submissions_table)) === $e_submissions_table);

    if ($has_elementor_table) {
        $wpdb->insert($e_submissions_table, [
            'type'                    => 'form',
            'hash_id'                 => wp_generate_uuid4(),
            'main_meta_id'            => 0,
            'post_id'                 => 0,
            'referer'                 => 'https://brandelier.in/contact-us',
            'referer_title'           => 'Contact Us | Brandelier',
            'element_id'              => 'brandelier_contact_form',
            'form_name'               => 'Contact Us Form',
            'campaign_id'             => '',
            'user_id'                 => 0,
            'user_ip'                 => $ip,
            'user_agent'              => sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? ''),
            'actions_count'           => 1,
            'actions_succeeded_count' => 1,
            'status'                  => 'unread',
            'is_read'                 => 0,
            'created_at_gmt'          => current_time('mysql', 1),
            'updated_at_gmt'          => current_time('mysql', 1),
            'created_at'              => current_time('mysql'),
            'updated_at'              => current_time('mysql'),
        ]);
        $submission_id = $wpdb->insert_id;

        if ($submission_id) {
            $field_data = [
                'name'    => $name,
                'email'   => $email,
                'phone'   => $phone,
                'service' => $service,
                'message' => $message,
            ];
            $main_meta_id = 0;
            foreach ($field_data as $key => $val) {
                $wpdb->insert($e_values_table, [
                    'submission_id' => $submission_id,
                    'key'           => $key,
                    'value'         => $val,
                ]);
                if ($key === 'email' || ($key === 'name' && empty($main_meta_id))) {
                    $main_meta_id = $wpdb->insert_id;
                }
            }
            if ($main_meta_id) {
                $wpdb->update($e_submissions_table, ['main_meta_id' => $main_meta_id], ['id' => $submission_id]);
            }
            $elementor_saved = true;
        }
    }

    // ── B. Save to WordPress Inquiries (Backup) ───────────────────────
    $backup_post_id = wp_insert_post([
        'post_type'   => 'brandelier_inquiry',
        'post_status' => 'publish',
        'post_title'  => $name . ' — ' . $service,
        'post_content'=> $message,
    ]);
    if (!is_wp_error($backup_post_id)) {
        update_post_meta($backup_post_id, 'client_name',    $name);
        update_post_meta($backup_post_id, 'client_email',   $email);
        update_post_meta($backup_post_id, 'client_phone',   $phone);
        update_post_meta($backup_post_id, 'client_service', $service);
        update_post_meta($backup_post_id, 'client_ip',      $ip);
    }

    // ── C. Trigger Email Notifications ────────────────────────────────
    $company_name = get_option('blogname', 'Brandelier');
    $admin_email  = get_option('admin_email');
    $target_email = 'Info@brandelier.in';

    // 1. Admin Alert Email
    $admin_subject = "New Contact Inquiry: {$service} — {$name}";
    $admin_body = "
    <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px; overflow: hidden;'>
        <div style='background: #111; color: #fff; padding: 20px 25px;'>
            <h2 style='margin: 0; font-size: 20px; color: #fff;'>New Contact Inquiry</h2>
            <p style='margin: 5px 0 0; color: #ff2d78; font-size: 14px;'>brandelier.in Contact Form</p>
        </div>
        <div style='padding: 25px;'>
            <table style='width: 100%; border-collapse: collapse;'>
                <tr>
                    <td style='padding: 8px 0; font-weight: bold; width: 140px; color: #555;'>Full Name:</td>
                    <td style='padding: 8px 0; color: #111;'>{$name}</td>
                </tr>
                <tr>
                    <td style='padding: 8px 0; font-weight: bold; color: #555;'>Email:</td>
                    <td style='padding: 8px 0;'><a href='mailto:{$email}' style='color: #ff2d78; text-decoration: none;'>{$email}</a></td>
                </tr>
                <tr>
                    <td style='padding: 8px 0; font-weight: bold; color: #555;'>Phone:</td>
                    <td style='padding: 8px 0;'><a href='tel:{$phone}' style='color: #111; text-decoration: none;'>{$phone}</a></td>
                </tr>
                <tr>
                    <td style='padding: 8px 0; font-weight: bold; color: #555;'>Service:</td>
                    <td style='padding: 8px 0; color: #111;'><strong>{$service}</strong></td>
                </tr>
                <tr>
                    <td style='padding: 12px 0 8px; font-weight: bold; color: #555; vertical-align: top;'>Message:</td>
                    <td style='padding: 12px 0 8px; color: #333; line-height: 1.5;'>" . nl2br($message) . "</td>
                </tr>
            </table>
            <hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;' />
            <p style='font-size: 12px; color: #888; margin: 0;'>
                Submitted on " . current_time('F j, Y, g:i a') . " · Origin: brandelier.in/contact-us
            </p>
        </div>
    </div>
    ";

    $admin_headers = [
        'Content-Type: text/html; charset=UTF-8',
        sprintf('From: %s Website <%s>', $company_name, $admin_email),
        sprintf('Reply-To: %s <%s>', $name, $email),
    ];

    $admin_sent = wp_mail($target_email, $admin_subject, $admin_body, $admin_headers);
    if ($admin_email !== $target_email) {
        wp_mail($admin_email, $admin_subject, $admin_body, $admin_headers);
    }

    // 2. Client Auto-Responder Confirmation
    $visitor_subject = "We received your message — Brandelier";
    $visitor_body = "
    <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px; overflow: hidden;'>
        <div style='background: #111; color: #fff; padding: 25px;'>
            <h1 style='margin: 0; font-size: 22px; color: #fff;'>Thank you for reaching out, {$name}!</h1>
            <p style='margin: 8px 0 0; color: #ff2d78; font-size: 14px;'>Brandelier — Creative Digital Marketing</p>
        </div>
        <div style='padding: 25px;'>
            <p style='font-size: 15px; color: #333;'>
                We have received your inquiry regarding <strong>{$service}</strong>. Our team will review your requirements and get back to you within 24 business hours.
            </p>
            <div style='background: #f8f9fa; border-left: 3px solid #ff2d78; padding: 15px; margin: 20px 0; border-radius: 4px;'>
                <p style='margin: 0; font-size: 13px; color: #555;'><strong>Your Message:</strong></p>
                <p style='margin: 5px 0 0; font-size: 14px; color: #333; font-style: italic;'>" . nl2br($message) . "</p>
            </div>
            <p style='font-size: 14px; color: #555;'>
                If your inquiry is urgent, please call us directly at <a href='tel:+917058670837' style='color: #ff2d78; text-decoration: none;'>+91 70586 70837</a>.
            </p>
            <p style='font-size: 14px; color: #333; margin-top: 25px;'>
                Warm regards,<br />
                <strong>Team Brandelier</strong><br />
                <a href='https://brandelier.in' style='color: #ff2d78; text-decoration: none;'>brandelier.in</a>
            </p>
        </div>
    </div>
    ";

    $visitor_headers = [
        'Content-Type: text/html; charset=UTF-8',
        sprintf('From: %s <%s>', $company_name, $target_email),
    ];

    wp_mail($email, $visitor_subject, $visitor_body, $visitor_headers);

    return new WP_REST_Response([
        'success'           => true,
        'message'           => 'Thank you! Your message has been sent successfully.',
        'elementor_saved'   => $elementor_saved,
        'submission_id'     => $submission_id,
        'admin_mail_sent'   => $admin_sent,
    ], 200);
}
