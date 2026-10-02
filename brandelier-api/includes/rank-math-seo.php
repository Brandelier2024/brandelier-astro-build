<?php
/**
 * Rank Math SEO REST API Exposer
 * Exposes Rank Math titles, descriptions, canonicals, Open Graph, and Twitter metadata in the WordPress REST API.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    $post_types = ['post', 'page', 'awsm_job_openings'];

    foreach ($post_types as $type) {
        // Expose structured Rank Math SEO object
        register_rest_field($type, 'rank_math_seo', [
            'get_callback' => 'brandelier_get_rank_math_seo',
            'schema'       => [
                'description' => 'Rank Math SEO metadata',
                'type'        => 'object',
            ],
        ]);

        // Expose raw rendered HTML head meta tags
        register_rest_field($type, 'rank_math_head', [
            'get_callback' => 'brandelier_get_rank_math_head',
            'schema'       => [
                'description' => 'Complete rendered HTML meta tags from Rank Math',
                'type'        => 'string',
            ],
        ]);
    }
});

function brandelier_get_rank_math_seo($post_arr) {
    $post_id = $post_arr['id'];

    $title       = get_post_meta($post_id, 'rank_math_title', true);
    $description = get_post_meta($post_id, 'rank_math_description', true);
    $canonical   = get_post_meta($post_id, 'rank_math_canonical_url', true);
    $robots      = get_post_meta($post_id, 'rank_math_robots', true);
    $focus_kw    = get_post_meta($post_id, 'rank_math_focus_keyword', true);

    $og_title    = get_post_meta($post_id, 'rank_math_facebook_title', true);
    $og_desc     = get_post_meta($post_id, 'rank_math_facebook_description', true);
    $og_image    = get_post_meta($post_id, 'rank_math_facebook_image', true);

    $tw_title    = get_post_meta($post_id, 'rank_math_twitter_title', true);
    $tw_desc     = get_post_meta($post_id, 'rank_math_twitter_description', true);
    $tw_image    = get_post_meta($post_id, 'rank_math_twitter_image', true);

    if (empty($title)) {
        $title = get_the_title($post_id) . ' | ' . get_bloginfo('name');
    }
    if (empty($canonical)) {
        $canonical = get_permalink($post_id);
    }
    if (empty($og_title)) {
        $og_title = $title;
    }
    if (empty($og_desc)) {
        $og_desc = $description;
    }

    return [
        'title'               => $title,
        'description'         => $description,
        'canonical'           => $canonical,
        'focus_keyword'       => $focus_kw,
        'robots'              => is_array($robots) ? implode(', ', $robots) : $robots,
        'og_title'            => $og_title,
        'og_description'      => $og_desc,
        'og_image'            => $og_image,
        'twitter_title'       => $tw_title ?: $og_title,
        'twitter_description' => $tw_desc ?: $og_desc,
        'twitter_image'       => $tw_image ?: $og_image,
    ];
}

function brandelier_get_rank_math_head($post_arr) {
    if (!class_exists('RankMath')) {
        return '';
    }

    $post_id = $post_arr['id'];
    global $post;
    $post = get_post($post_id);
    setup_postdata($post);

    ob_start();
    do_action('rank_math/head');
    $head = ob_get_clean();
    wp_reset_postdata();

    return $head;
}
