import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, handleRequireAdminError } from '@/lib/auth/require-admin';

interface BannerSlideDb {
  id: string;
  title: string;
  subtitle?: string | null;
  cta_text: string;
  cta_link: string;
  image_url?: string | null;
  bg_color: string;
  text_color: string;
  enabled: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * GET /api/admin/banner-slides
 * Get all banner slides (admin only - includes disabled slides)
 */
export async function GET() {
  try {
    // Require admin authentication and role (head_admin, admin, or editor)
    await requireAdmin(['head_admin', 'admin', 'editor'])
    
    const supabase = await createClient();

    // Fetch all slides ordered by display_order
    const { data, error } = await supabase
      .from('banner_slides')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch banner slides: ${error.message}`);
    }

    // Map database fields to API response format
    const rows = (data ?? []) as BannerSlideDb[];
    const slides = rows.map((slide) => ({
      id: slide.id,
      title: slide.title,
      subtitle: slide.subtitle,
      ctaText: slide.cta_text,
      ctaLink: slide.cta_link,
      imageUrl: slide.image_url,
      bgColor: slide.bg_color,
      textColor: slide.text_color,
      enabled: slide.enabled,
      displayOrder: slide.display_order,
      createdAt: slide.created_at,
      updatedAt: slide.updated_at,
    }));

    return NextResponse.json(slides);
  } catch (error: any) {
    // Handle requireAdmin errors (401/403)
    if (error.status === 401 || error.status === 403) {
      return handleRequireAdminError(error) as NextResponse;
    }
    
    console.error('Error fetching banner slides:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch banner slides' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/banner-slides
 * Create a new banner slide
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication and role (head_admin, admin, or editor)
    await requireAdmin(['head_admin', 'admin', 'editor'])
    
    const supabase = await createClient();

    const body = await request.json();
    const {
      title,
      subtitle,
      ctaText,
      ctaLink,
      imageUrl,
      bgColor,
      textColor,
      enabled,
      displayOrder,
    } = body;

    // Validate required fields
    if (!title || !ctaText || !ctaLink) {
      return NextResponse.json(
        { error: 'Title, CTA text, and CTA link are required' },
        { status: 400 }
      );
    }

    // Get max display order if not provided
    let order = displayOrder;
    if (order === undefined || order === null) {
      const { data: maxSlide } = await supabase
        .from('banner_slides')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .single();
      
      order = maxSlide ? (maxSlide.display_order || 0) + 1 : 0;
    }

    // Insert new slide
    const { data, error } = await supabase
      .from('banner_slides')
      .insert({
        title,
        subtitle: subtitle || null,
        cta_text: ctaText,
        cta_link: ctaLink,
        image_url: imageUrl || null,
        bg_color: bgColor || 'bg-gray-50',
        text_color: textColor || 'text-gray-900',
        enabled: enabled !== false,
        display_order: order,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create banner slide: ${error.message}`);
    }

    // Map to API format
    const slide = {
      id: data.id,
      title: data.title,
      subtitle: data.subtitle,
      ctaText: data.cta_text,
      ctaLink: data.cta_link,
      imageUrl: data.image_url,
      bgColor: data.bg_color,
      textColor: data.text_color,
      enabled: data.enabled,
      displayOrder: data.display_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json(slide, { status: 201 });
  } catch (error: any) {
    // Handle requireAdmin errors (401/403)
    if (error.status === 401 || error.status === 403) {
      return handleRequireAdminError(error) as NextResponse;
    }
    
    console.error('Error creating banner slide:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create banner slide' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/banner-slides
 * Update multiple slides (for reordering)
 */
export async function PUT(request: NextRequest) {
  try {
    // Require admin authentication and role (head_admin, admin, or editor)
    await requireAdmin(['head_admin', 'admin', 'editor'])
    
    const supabase = await createClient();

    const body = await request.json();
    const { slides } = body;

    if (!Array.isArray(slides)) {
      return NextResponse.json(
        { error: 'Slides must be an array' },
        { status: 400 }
      );
    }

    // Update each slide
    const updates = slides.map((slide: { id: string; title: string; subtitle?: string; ctaText: string; ctaLink: string; imageUrl?: string; bgColor?: string; textColor?: string; enabled?: boolean; displayOrder: number }) => ({
      id: slide.id,
      title: slide.title,
      subtitle: slide.subtitle || null,
      cta_text: slide.ctaText,
      cta_link: slide.ctaLink,
      image_url: slide.imageUrl || null,
      bg_color: slide.bgColor || 'bg-gray-50',
      text_color: slide.textColor || 'text-gray-900',
      enabled: slide.enabled !== false,
      display_order: slide.displayOrder,
    }));

    // Use upsert to update multiple slides
    const { data, error } = await supabase
      .from('banner_slides')
      .upsert(updates, { onConflict: 'id' })
      .select();

    if (error) {
      throw new Error(`Failed to update banner slides: ${error.message}`);
    }

    // Map to API format
    const updatedRows = (data ?? []) as BannerSlideDb[];
    const updatedSlides = updatedRows.map((slide) => ({
      id: slide.id,
      title: slide.title,
      subtitle: slide.subtitle,
      ctaText: slide.cta_text,
      ctaLink: slide.cta_link,
      imageUrl: slide.image_url,
      bgColor: slide.bg_color,
      textColor: slide.text_color,
      enabled: slide.enabled,
      displayOrder: slide.display_order,
      createdAt: slide.created_at,
      updatedAt: slide.updated_at,
    }));

    return NextResponse.json(updatedSlides);
  } catch (error: any) {
    // Handle requireAdmin errors (401/403)
    if (error.status === 401 || error.status === 403) {
      return handleRequireAdminError(error) as NextResponse;
    }
    
    console.error('Error updating banner slides:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update banner slides' },
      { status: 500 }
    );
  }
}
