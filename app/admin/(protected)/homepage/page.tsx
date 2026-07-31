'use client';

import { useEffect, useState } from 'react';
import { 
  Plus, Trash2, Edit2, ChevronUp, ChevronDown, 
  Image as ImageIcon, Loader2, Eye, Save, X, Layout
} from 'lucide-react';
import Image from 'next/image';
import PageContainer from '@/components/admin/PageContainer';
import PageHeader from '@/components/admin/PageHeader'; // Assuming this component exists or I should use the direct layout
import SectionCard from '@/components/admin/SectionCard';
import AccessControl from '@/components/admin/AccessControl';
import { useToast } from '@/components/ToastProvider';

interface BannerSlide {
  id: string;
  title: string;
  subtitle?: string;
  ctaText: string;
  ctaLink: string;
  imageUrl?: string;
  bgColor: string;
  textColor: string;
  enabled: boolean;
  displayOrder: number;
}

export default function HomepagePageContent() {
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlide, setEditingSlide] = useState<string | null>(null);
  const [showSlideForm, setShowSlideForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [slideForm, setSlideForm] = useState<Partial<BannerSlide>>({
    title: '',
    subtitle: '',
    ctaText: 'Shop Now',
    ctaLink: '/products',
    bgColor: 'bg-neutral-900',
    textColor: 'text-white',
    enabled: true,
    displayOrder: 0,
  });

  const { showToast } = useToast();

  useEffect(() => {
    fetchBannerSlides();
  }, []);

  const fetchBannerSlides = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/banner-slides');
      if (res.ok) {
        const data = await res.json();
        const validSlides = data.filter((slide: BannerSlide) => slide && slide.id);
        setBannerSlides(validSlides.sort((a: BannerSlide, b: BannerSlide) => a.displayOrder - b.displayOrder));
      }
    } catch (error) {
      console.error('Error fetching banner slides:', error);
      showToast('Failed to load slides', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSlide = async () => {
    if (!slideForm.title) {
      showToast('Title is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const url = editingSlide 
        ? `/api/admin/banner-slides/${editingSlide}`
        : '/api/admin/banner-slides';
      
      const method = editingSlide ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slideForm),
      });

      if (res.ok) {
        await fetchBannerSlides();
        setShowSlideForm(false);
        setEditingSlide(null);
        resetForm();
        showToast(`Slide ${editingSlide ? 'updated' : 'created'} successfully`, 'success');
      } else {
        throw new Error('Failed to save slide');
      }
    } catch (error) {
      console.error('Error saving slide:', error);
      showToast('Failed to save slide', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlide = async (id: string) => {
    if (!confirm('Are you sure you want to delete this slide?')) return;

    try {
      const res = await fetch(`/api/admin/banner-slides/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchBannerSlides();
        showToast('Slide deleted', 'success');
      }
    } catch (error) {
      console.error('Error deleting slide:', error);
      showToast('Failed to delete slide', 'error');
    }
  };

  const handleMoveSlide = async (id: string, direction: 'up' | 'down') => {
    const index = bannerSlides.findIndex(s => s.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= bannerSlides.length) return;

    const newSlides = [...bannerSlides];
    const temp = newSlides[index];
    newSlides[index] = newSlides[newIndex];
    newSlides[newIndex] = temp;

    // Update display orders locally first for snap
    const updatedSlides = newSlides.map((slide, idx) => ({
      ...slide,
      displayOrder: idx
    }));
    
    setBannerSlides(updatedSlides);

    // Sync with server
    try {
      await fetch('/api/admin/banner-slides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: updatedSlides }),
      });
    } catch (error) {
      console.error('Error reordering slides:', error);
      showToast('Failed to save order', 'error');
      fetchBannerSlides(); // Revert on error
    }
  };

  const openEdit = (slide: BannerSlide) => {
    setSlideForm(slide);
    setEditingSlide(slide.id);
    setShowSlideForm(true);
  };

  const resetForm = () => {
    setSlideForm({
      title: '',
      subtitle: '',
      ctaText: 'Shop Now',
      ctaLink: '/products',
      bgColor: 'bg-neutral-900',
      textColor: 'text-white',
      enabled: true,
      displayOrder: bannerSlides.length,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <AccessControl allowedRoles={['head_admin', 'admin', 'editor']}>
      <PageContainer className="max-w-[1200px] px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-light tracking-tight text-neutral-900">Homepage</h1>
          <p className="text-neutral-500 font-light mt-2">Manage your homepage hero slider.</p>
        </div>

        <SectionCard
          title="Hero Slides"
          className="border-none shadow-sm bg-white"
          action={
            <button
              onClick={() => {
                resetForm();
                setEditingSlide(null);
                setShowSlideForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-full text-sm font-medium hover:bg-neutral-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Slide
            </button>
          }
        >
          {bannerSlides.length === 0 ? (
            <div className="text-center py-12 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
              <ImageIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500 font-medium">No slides yet</p>
              <p className="text-neutral-400 text-sm mt-1">Create your first hero slide to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bannerSlides.map((slide, index) => (
                <div 
                  key={slide.id}
                  className="group flex flex-col sm:flex-row items-center gap-6 p-4 bg-white border border-neutral-100 rounded-2xl hover:shadow-md transition-all duration-200"
                >
                  {/* Preview */}
                  <div className={`w-full sm:w-48 h-28 shrink-0 rounded-xl overflow-hidden relative ${!slide.imageUrl ? slide.bgColor : ''}`}>
                    {slide.imageUrl ? (
                      <Image 
                        src={slide.imageUrl} 
                        alt={slide.title} 
                        fill 
                        className="object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${slide.textColor}`}>
                        <span className="text-xs font-medium opacity-50">No Image</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                      <h3 className="font-medium text-neutral-900 truncate">{slide.title}</h3>
                      {!slide.enabled && (
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] rounded-full font-medium">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-500 truncate mb-3">{slide.subtitle || 'No subtitle'}</p>
                    <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-neutral-50 border border-neutral-100 text-xs text-neutral-600">
                      {slide.ctaText} → {slide.ctaLink}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-neutral-100 pt-4 sm:pt-0 sm:pl-4 mt-4 sm:mt-0 w-full sm:w-auto justify-center sm:justify-end">
                    <div className="flex flex-row sm:flex-col gap-1">
                      <button 
                        onClick={() => handleMoveSlide(slide.id, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleMoveSlide(slide.id, 'down')}
                        disabled={index === bannerSlides.length - 1}
                        className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="w-px h-8 bg-neutral-200 hidden sm:block mx-1"></div>

                    <button 
                      onClick={() => openEdit(slide)}
                      className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteSlide(slide.id)}
                      className="p-2 text-neutral-400 hover:text-black/55 hover:bg-black/[0.04] rounded-full transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Edit/Create Modal */}
        {showSlideForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="font-medium text-lg text-neutral-900">
                  {editingSlide ? 'Edit Slide' : 'New Slide'}
                </h3>
                <button 
                  onClick={() => setShowSlideForm(false)}
                  className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Image URL</label>
                    <div className="flex gap-2">
                        <input 
                        type="text" 
                        value={slideForm.imageUrl || ''} 
                        onChange={(e) => setSlideForm({...slideForm, imageUrl: e.target.value})}
                        className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                        placeholder="https://..."
                        />
                    </div>
                    {slideForm.imageUrl && (
                        <div className="mt-2 relative w-full h-32 bg-neutral-100 rounded-lg overflow-hidden">
                            <Image src={slideForm.imageUrl} alt="Preview" fill className="object-cover" />
                        </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1.5">Title</label>
                        <input 
                        type="text" 
                        value={slideForm.title} 
                        onChange={(e) => setSlideForm({...slideForm, title: e.target.value})}
                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                        placeholder="Summer Sale"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1.5">Subtitle</label>
                        <input 
                        type="text" 
                        value={slideForm.subtitle || ''} 
                        onChange={(e) => setSlideForm({...slideForm, subtitle: e.target.value})}
                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                        placeholder="Up to 50% off"
                        />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1.5">Button Text</label>
                        <input 
                        type="text" 
                        value={slideForm.ctaText} 
                        onChange={(e) => setSlideForm({...slideForm, ctaText: e.target.value})}
                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                        placeholder="Shop Now"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1.5">Button Link</label>
                        <input 
                        type="text" 
                        value={slideForm.ctaLink} 
                        onChange={(e) => setSlideForm({...slideForm, ctaLink: e.target.value})}
                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                        placeholder="/products"
                        />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1.5">Background Color</label>
                        <select 
                            value={slideForm.bgColor || 'bg-neutral-900'} 
                            onChange={(e) => setSlideForm({...slideForm, bgColor: e.target.value})}
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all cursor-pointer"
                        >
                            <option value="bg-neutral-900">Black</option>
                            <option value="bg-white">White</option>
                            <option value="bg-neutral-100">Gray</option>
                            <option value="bg-black">Black</option>
                            <option value="bg-black">Ink</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1.5">Text Color</label>
                        <select 
                            value={slideForm.textColor || 'text-white'} 
                            onChange={(e) => setSlideForm({...slideForm, textColor: e.target.value})}
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all cursor-pointer"
                        >
                            <option value="text-white">White</option>
                            <option value="text-neutral-900">Black</option>
                        </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                        type="checkbox"
                        checked={slideForm.enabled}
                        onChange={(e) => setSlideForm({ ...slideForm, enabled: e.target.checked })}
                        className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neutral-900"></div>
                        <span className="ml-3 text-sm font-medium text-neutral-700">Active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowSlideForm(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveSlide}
                  disabled={saving}
                  className="px-6 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingSlide ? 'Save Changes' : 'Create Slide'}
                </button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </AccessControl>
  );
}