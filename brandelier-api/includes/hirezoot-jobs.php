<?php
/**
 * HireZoot / WP Job Openings Integration & Application Notifications
 */

if (!defined('ABSPATH')) {
    exit;
}

// ─── 1. Register REST Route ───────────────────────────────────────
add_action('rest_api_init', function () {
    register_rest_route('brandelier/v1', '/apply', [
        'methods'             => ['POST', 'GET'],
        'callback'            => 'brandelier_handle_application',
        'permission_callback' => '__return_true',
    ]);
});

// ─── 2. Application Submission Handler ────────────────────────────
function brandelier_handle_application(WP_REST_Request $request) {
    if ($request->get_method() === 'GET') {
        return new WP_REST_Response([
            'status'  => 'active',
            'message' => 'Brandelier Application Gateway is active and secured. Submissions accepted via POST only.',
        ], 200);
    }

    if (!brandelier_validate_origin()) {
        return new WP_REST_Response(['success' => false, 'message' => 'Unauthorized origin.'], 403);
    }

    if (!empty($request->get_param('brandelier_hp_catch'))) {
        return new WP_REST_Response(['success' => true, 'message' => 'Application received.'], 200);
    }

    if (!brandelier_validate_token($request->get_param('form_token'))) {
        return new WP_REST_Response(['success' => false, 'message' => 'Invalid or expired session. Please refresh and try again.'], 403);
    }

    if (!brandelier_check_rate_limit('apply', 5, 600)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Too many submissions from your connection. Please wait 10 minutes before trying again.',
        ], 429);
    }

    $name   = sanitize_text_field($request->get_param('awsm_applicant_name'));
    $email  = sanitize_email($request->get_param('awsm_applicant_email'));
    $phone  = sanitize_text_field($request->get_param('awsm_applicant_phone'));
    $letter = sanitize_textarea_field($request->get_param('awsm_applicant_letter'));
    $job_id = absint($request->get_param('jid'));
    $ip     = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');

    $errors = [];
    if (empty($name))                        $errors[] = 'Full name is required.';
    if (empty($email) || !is_email($email))  $errors[] = 'A valid email is required.';
    if (empty($phone))                       $errors[] = 'Phone number is required.';
    if (empty($letter))                      $errors[] = 'Bio / cover message is required.';
    if (empty($job_id))                      $errors[] = 'Job ID is missing.';

    if (!empty($errors)) {
        return new WP_REST_Response(['success' => false, 'message' => implode(' ', $errors)], 400);
    }

    $job = get_post($job_id);
    if (!$job || $job->post_type !== 'awsm_job_openings') {
        return new WP_REST_Response(['success' => false, 'message' => 'Invalid job listing.'], 400);
    }

    $job_title = html_entity_decode(get_the_title($job_id));

    $app_id = wp_insert_post([
        'post_type'   => 'awsm_job_application',
        'post_status' => 'publish',
        'post_title'  => $name . ' — ' . $job_title,
        'post_parent' => $job_id,
    ]);

    if (is_wp_error($app_id)) {
        return new WP_REST_Response(['success' => false, 'message' => 'Could not save application. Please try again.'], 500);
    }

    update_post_meta($app_id, 'awsm_job_id',           $job_id);
    update_post_meta($app_id, 'awsm_apply_for',        $job_title);
    update_post_meta($app_id, 'awsm_applicant_ip',     $ip);
    update_post_meta($app_id, 'awsm_applicant_name',   $name);
    update_post_meta($app_id, 'awsm_applicant_email',  $email);
    update_post_meta($app_id, 'awsm_applicant_phone',  $phone);
    update_post_meta($app_id, 'awsm_applicant_letter', $letter);
    update_post_meta($app_id, 'awsm_application_viewed', '0');

    $attach_id = 0;
    $file_url  = '';
    $files = $request->get_file_params();

    if (!empty($files['awsm_file'])) {
        $uploaded_file = $files['awsm_file'];
        $file_type = wp_check_filetype(basename($uploaded_file['name']));

        if (!in_array($file_type['ext'], ['pdf', 'doc', 'docx'], true) || $uploaded_file['size'] > 10 * 1024 * 1024) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Invalid resume file type or file exceeds 10 MB.',
            ], 400);
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $_FILES['awsm_file'] = $uploaded_file;
        $attach_id = media_handle_upload('awsm_file', $app_id);

        if (!is_wp_error($attach_id)) {
            update_post_meta($app_id, 'awsm_attachment_id', $attach_id);
            $file_url = wp_get_attachment_url($attach_id);
            update_post_meta($app_id, 'awsm_attachment_file', $file_url);
        } else {
            $attach_id = 0;
        }
    }

    do_action('awsm_job_application_submitted', $app_id);

    $mail_status = brandelier_trigger_hirezoot_notifications(
        $app_id,
        $job_id,
        $job_title,
        $name,
        $email,
        $phone,
        $letter,
        $attach_id,
        $file_url
    );

    return new WP_REST_Response([
        'success'        => true,
        'message'        => 'Application submitted successfully!',
        'application_id' => $app_id,
        'mail_status'    => $mail_status,
    ], 200);
}

// ─── 3. Notification Dispatcher (Applicant & Admin) ───────────────
function brandelier_trigger_hirezoot_notifications($app_id, $job_id, $job_title, $name, $email, $phone, $letter, $attach_id, $file_url) {
    $attachment_file = $attach_id ? get_attached_file($attach_id) : '';

    $applicant_details = [
        'awsm_job_id'           => $job_id,
        'awsm_apply_for'        => $job_title,
        'awsm_applicant_ip'     => isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field($_SERVER['REMOTE_ADDR']) : '',
        'awsm_applicant_name'   => $name,
        'awsm_applicant_email'  => $email,
        'awsm_applicant_phone'  => $phone,
        'awsm_applicant_letter' => $letter,
        'awsm_attachment_id'    => $attach_id,
        'application_id'        => $app_id,
    ];

    $sent = ['applicant' => false, 'admin' => false];

    $on_applicant_sent = function() use (&$sent) { $sent['applicant'] = true; };
    $on_admin_sent     = function() use (&$sent) { $sent['admin'] = true; };
    add_action('awsm_job_applicant_mail_sent', $on_applicant_sent);
    add_action('awsm_job_admin_mail_sent',     $on_admin_sent);

    // Try HireZoot native method via reflection
    if (class_exists('AWSM_Job_Openings_Form')) {
        if (defined('AWSM_JOBS_PLUGIN_DIR')) {
            $mc_file = AWSM_JOBS_PLUGIN_DIR . '/inc/class-awsm-job-openings-mail-customizer.php';
            if (file_exists($mc_file)) {
                require_once $mc_file;
            }
        }
        $form_instance = AWSM_Job_Openings_Form::init();
        if (method_exists($form_instance, 'notification_email')) {
            try {
                $refMethod = new \ReflectionMethod('AWSM_Job_Openings_Form', 'notification_email');
                $refMethod->setAccessible(true);
                $refMethod->invoke($form_instance, $applicant_details);
            } catch (\Throwable $e) {
                error_log('[Brandelier API] Native notification invocation note: ' . $e->getMessage());
            }
        }
    }

    $company_name = get_option('awsm_job_company_name') ?: get_option('blogname', 'Brandelier');
    $admin_site_email = get_option('admin_email');
    $hr_email = get_option('awsm_hr_email_address') ?: $admin_site_email;

    $tags = [
        '{applicant}'        => $name,
        '{applicant-name}'   => $name,
        '{application-id}'   => $app_id,
        '{applicant-email}'  => $email,
        '{applicant-phone}'  => $phone,
        '{job-id}'           => $job_id,
        '{job-title}'        => $job_title,
        '{applicant-cover}'  => nl2br($letter),
        '{applicant-resume}' => !empty($file_url) ? esc_url($file_url) : 'No file uploaded',
        '{company_name}'     => $company_name,
        '{company-name}'     => $company_name,
        '{admin_email}'      => $admin_site_email,
        '{admin-email}'      => $admin_site_email,
        '{hr_email}'         => $hr_email,
        '{hr-email}'         => $hr_email,
    ];

    $email_tag_names  = ['{admin-email}', '{hr-email}', '{applicant-email}', '{default-from-email}'];
    $email_tag_values = [$admin_site_email, $hr_email, $email, $admin_site_email];

    // ── A. Applicant Notification ("Application Received - Applicant Notification")
    $applicant_ack = get_option('awsm_jobs_acknowledgement');
    if (!$sent['applicant'] && $applicant_ack === 'acknowledgement') {
        $from_email = get_option('awsm_jobs_from_email_notification');
        if (empty($from_email) || $from_email === '{default-from-email}') {
            $from_email = $admin_site_email;
        }
        $reply_to = get_option('awsm_jobs_reply_to_notification');
        $reply_to = str_replace($email_tag_names, $email_tag_values, (string) $reply_to);
        $cc       = get_option('awsm_jobs_hr_notification');
        $cc       = str_replace($email_tag_names, $email_tag_values, (string) $cc);

        $raw_subject = get_option('awsm_jobs_notification_subject') ?: 'Application Received: {job-title} - {company-name}';
        $raw_content = get_option('awsm_jobs_notification_content') ?: "Hi {applicant},\n\nThank you for applying for the {job-title} position at {company-name}. We have successfully received your application.\n\nOur hiring team will review your application and be in touch soon.\n\nBest regards,\n{company-name}";

        $subject = str_replace(array_keys($tags), array_values($tags), $raw_subject);
        $content = str_replace(array_keys($tags), array_values($tags), $raw_content);
        if (!preg_match('/<[a-z][^>]*>/i', $content)) {
            $content = nl2br($content);
        }

        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            sprintf('From: %s <%s>', $company_name, $from_email),
        ];
        if (!empty($reply_to)) $headers[] = 'Reply-To: ' . $reply_to;
        if (!empty($cc))       $headers[] = 'Cc: ' . $cc;

        $applicant_sent = wp_mail($email, $subject, $content, $headers);
        if ($applicant_sent) {
            $sent['applicant'] = true;
            update_post_meta($app_id, 'awsm_application_mails', [[
                'send_by'      => 0,
                'mail_date'    => current_time('mysql'),
                'cc'           => $cc,
                'subject'      => $subject,
                'mail_content' => $content,
            ]]);
        }
    }

    // ── B. Admin Notification ("Application Received - Admin Notification")
    $admin_enabled = get_option('awsm_jobs_enable_admin_notification');
    if (!$sent['admin'] && $admin_enabled === 'enable') {
        $admin_from_email = get_option('awsm_jobs_admin_from_email_notification');
        if (empty($admin_from_email) || $admin_from_email === '{default-from-email}') {
            $admin_from_email = $admin_site_email;
        }
        $admin_to = get_option('awsm_jobs_admin_to_notification');
        if (empty($admin_to)) {
            $admin_to = $hr_email ?: $admin_site_email;
        } else {
            $admin_to = str_replace($email_tag_names, $email_tag_values, (string) $admin_to);
        }

        $admin_reply_to = get_option('awsm_jobs_admin_reply_to_notification', '{applicant-email}');
        $admin_reply_to = str_replace($email_tag_names, $email_tag_values, (string) $admin_reply_to);
        $admin_cc       = get_option('awsm_jobs_admin_hr_notification');
        $admin_cc       = str_replace($email_tag_names, $email_tag_values, (string) $admin_cc);

        $raw_admin_subject = get_option('awsm_jobs_admin_notification_subject') ?: 'New Application Received: {job-title} - {applicant}';
        $raw_admin_content = get_option('awsm_jobs_admin_notification_content') ?: "Hi Team,\n\nA new application has been submitted for {job-title}.\n\nCandidate Details:\n- Name: {applicant}\n- Email: {applicant-email}\n- Phone: {applicant-phone}\n- Resume Link: {applicant-resume}\n\nCover Letter / Bio:\n{applicant-cover}\n\nReview this application in your WordPress Admin.";

        $admin_subject = str_replace(array_keys($tags), array_values($tags), $raw_admin_subject);
        $admin_content = str_replace(array_keys($tags), array_values($tags), $raw_admin_content);
        if (!preg_match('/<[a-z][^>]*>/i', $admin_content)) {
            $admin_content = nl2br($admin_content);
        }

        $admin_headers = [
            'Content-Type: text/html; charset=UTF-8',
            sprintf('From: %s <%s>', $company_name, $admin_from_email),
        ];
        if (!empty($admin_reply_to)) $admin_headers[] = 'Reply-To: ' . $admin_reply_to;
        if (!empty($admin_cc))       $admin_headers[] = 'Cc: ' . $admin_cc;

        $admin_attachments = [];
        if (!empty($attachment_file) && file_exists($attachment_file)) {
            $admin_attachments[] = $attachment_file;
        }

        $admin_sent = wp_mail($admin_to, $admin_subject, $admin_content, $admin_headers, $admin_attachments);
        if ($admin_sent) {
            $sent['admin'] = true;
        }
    }

    remove_action('awsm_job_applicant_mail_sent', $on_applicant_sent);
    remove_action('awsm_job_admin_mail_sent',     $on_admin_sent);

    return $sent;
}
