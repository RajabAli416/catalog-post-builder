import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import {
  CatalogueProduct,
  GeneratedShootImage,
  InstagramPostDraft,
} from '../../types/studio';
import { generateInstagramCopyApi } from '../../services/studioApi';
import { FashionImage } from '../common/FashionImage';
import { CopyButton } from '../common/CopyButton';

interface InstagramPostBuilderViewProps {
  selectedImages: GeneratedShootImage[];
  allGeneratedImages: GeneratedShootImage[];
  activeProduct: CatalogueProduct;
  onUpdateCarouselIds: (nextIds: string[]) => void;
  onSaveDraft: (draft: Omit<InstagramPostDraft, 'id' | 'updatedAt'>) => void;
  onBackToGallery: () => void;
}

const CTA_PRESETS = [
  'Discover the piece via link in bio or request a private studio fitting.',
  'Now available online & at our Lahore and Karachi flagship studios.',
  'Direct message our studio concierge for bespoke measurements & dispatch.',
  'Limited festive edition — explore the full lookbook via link in bio.',
];

export const InstagramPostBuilderView: React.FC<InstagramPostBuilderViewProps> = ({
  selectedImages,
  allGeneratedImages,
  activeProduct,
  onUpdateCarouselIds,
  onSaveDraft,
  onBackToGallery,
}) => {
  const carouselImages =
    selectedImages.length > 0
      ? selectedImages
      : allGeneratedImages.slice(0, 3);

  const [coverImageId, setCoverImageId] = useState<string>(
    carouselImages[0]?.id || ''
  );
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [productTitle, setProductTitle] = useState(activeProduct.name);
  const [shortDescription, setShortDescription] = useState('');
  const [captionTone, setCaptionTone] = useState<
    InstagramPostDraft['captionTone']
  >('Editorial Storytelling');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [customHashtagInput, setCustomHashtagInput] = useState('');
  const [cta, setCta] = useState('');
  const [copyPromptUsed, setCopyPromptUsed] = useState('');
  const [copyError, setCopyError] = useState<string | null>(null);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);

  const orderedCarousel = carouselImages;
  const safeSlideIndex = Math.min(
    activeSlideIndex,
    Math.max(0, orderedCarousel.length - 1)
  );
  const currentPreviewImage = orderedCarousel[safeSlideIndex] || orderedCarousel[0];
  const postText = [productTitle, shortDescription, caption, cta, hashtags.join(' ')]
    .filter((part) => part.trim())
    .join('\n\n');

  const handleMoveSlide = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedCarousel.length) return;
    const ids = orderedCarousel.map((img) => img.id);
    const temp = ids[index];
    ids[index] = ids[targetIndex];
    ids[targetIndex] = temp;
    onUpdateCarouselIds(ids);
    setActiveSlideIndex(targetIndex);
  };

  const handleSetAsCover = (imageId: string) => {
    setCoverImageId(imageId);
    const rest = orderedCarousel
      .filter((img) => img.id !== imageId)
      .map((img) => img.id);
    onUpdateCarouselIds([imageId, ...rest]);
    setActiveSlideIndex(0);
  };

  const handleRemoveFromCarousel = (imageId: string) => {
    if (orderedCarousel.length <= 1) return;
    const nextIds = orderedCarousel
      .filter((img) => img.id !== imageId)
      .map((img) => img.id);
    onUpdateCarouselIds(nextIds);
    if (coverImageId === imageId && nextIds[0]) {
      setCoverImageId(nextIds[0]);
    }
    setActiveSlideIndex(0);
  };

  const handleAddImageToCarousel = (imageId: string) => {
    const currentIds = orderedCarousel.map((img) => img.id);
    if (currentIds.includes(imageId)) return;
    onUpdateCarouselIds([...currentIds, imageId]);
  };

  const handleRegenerateEditorialCopy = async (
    nextTone: InstagramPostDraft['captionTone']
  ) => {
    setCaptionTone(nextTone);
    setIsGeneratingCopy(true);
    try {
      const fresh = await generateInstagramCopyApi({
        productId: activeProduct.id,
        tone: nextTone,
        style: currentPreviewImage?.style || 'Luxury Editorial',
      });
      setProductTitle(fresh.productTitle);
      setShortDescription(fresh.shortDescription);
      setCaption(fresh.caption);
      setHashtags(fresh.hashtags);
      setCta(fresh.cta);
      setCopyPromptUsed(fresh.copyPromptUsed || '');
      setCopyError(null);
    } catch (err) {
      setCopyError(
        err instanceof Error ? err.message : 'Could not generate Instagram copy.'
      );
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  useEffect(() => {
    handleRegenerateEditorialCopy('Editorial Storytelling');
    // Generate real Gemini copy once when this garment opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProduct.id]);

  const handleAddCustomHashtag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customHashtagInput.trim();
    if (!cleaned) return;
    const formatted = cleaned.startsWith('#')
      ? cleaned
      : `#${cleaned.replace(/\s+/g, '')}`;
    if (!hashtags.includes(formatted)) {
      setHashtags([...hashtags, formatted]);
    }
    setCustomHashtagInput('');
  };

  const handleSavePost = () => {
    const ids = orderedCarousel.map((img) => img.id);
    const leadCover = orderedCarousel[0]?.id || coverImageId;
    onSaveDraft({
      projectId: activeProduct.projectId,
      productId: activeProduct.id,
      shootId: currentPreviewImage?.shootId || 'shoot-emerald-01',
      productTitle,
      shortDescription,
      description: shortDescription,
      caption,
      captionTone,
      hashtags,
      cta,
      copyPromptUsed,
      aspectRatio: 'Instagram Portrait 4:5',
      carouselImageIds: ids,
      selectedImages: ids,
      coverImageId: leadCover,
      coverImage: leadCover,
      status: 'Draft',
    });
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };

  const unselectedShootImages = allGeneratedImages.filter(
    (img) => !orderedCarousel.some((c) => c.id === img.id)
  );

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="border-b border-line pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToGallery}
            className="p-2 bg-white border border-line-strong text-ink hover:border-ink transition-colors"
            aria-label="Back to shoot gallery"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>Instagram Campaign Studio</span>
              <span aria-hidden="true">·</span>
              <span>4:5 Editorial Carousel</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{activeProduct.sku}</span>
            </div>
            <h1 className="font-editorial text-3xl font-semibold text-ink">
              Instagram Post Builder
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBackToGallery}
            className="px-4 py-2.5 text-xs font-medium text-ink bg-white border border-line-strong hover:border-ink transition-colors whitespace-nowrap"
          >
            Modify Selected Frames
          </button>
          <button
            type="button"
            onClick={handleSavePost}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap"
          >
            {saveFeedback ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Saved to Post Library
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" />
                Save Draft Post
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Left 5 cols (Live 4:5 Instagram Preview + Carousel Ordering) / Right 7 cols (Copy & Hashtags) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Live Instagram 4:5 Preview & Carousel Sequencer */}
        <div className="lg:col-span-5 space-y-6">
          {/* Simulated Instagram 4:5 Feed Card */}
          <div className="bg-white border border-line max-w-md mx-auto">
            {/* IG Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-line">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-ink text-canvas flex items-center justify-center font-editorial text-sm font-semibold">
                  V
                </div>
                <div>
                  <span className="block text-xs font-semibold text-ink leading-none">
                    @veyra
                  </span>
                  <span className="block text-[11px] text-muted mt-0.5">
                    Lahore · Editorial Lookbook
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-muted tabular-nums">
                {safeSlideIndex + 1} / {orderedCarousel.length}
              </span>
            </div>

            {/* 4:5 Image Frame with Carousel Controls */}
            <div className="relative group">
              {currentPreviewImage && (
                <FashionImage
                  src={currentPreviewImage.imageUrl}
                  alt={productTitle}
                  aspectClass="aspect-[4/5]"
                  cropVariant={currentPreviewImage.cropVariant}
                />
              )}

              {safeSlideIndex === 0 && (
                <div className="absolute top-3 left-3 bg-black/75 text-white px-2.5 py-1 text-[11px] font-mono">
                  Cover Plate · 4:5
                </div>
              )}

              {orderedCarousel.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveSlideIndex((prev) =>
                        prev > 0 ? prev - 1 : orderedCarousel.length - 1
                      )
                    }
                    aria-label="Previous slide"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 text-ink flex items-center justify-center hover:bg-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveSlideIndex((prev) =>
                        prev < orderedCarousel.length - 1 ? prev + 1 : 0
                      )
                    }
                    aria-label="Next slide"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 text-ink flex items-center justify-center hover:bg-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* IG Interaction Bar + Carousel Dots */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-ink">
                  <Heart className="w-5 h-5" />
                  <MessageCircle className="w-5 h-5" />
                  <Send className="w-5 h-5" />
                </div>

                {/* Pagination Dots */}
                <div className="flex items-center gap-1.5">
                  {orderedCarousel.map((slide, idx) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setActiveSlideIndex(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                      className={`h-1.5 transition-all ${
                        idx === safeSlideIndex
                          ? 'w-4 bg-ink'
                          : 'w-1.5 bg-line-strong'
                      }`}
                    />
                  ))}
                </div>

                <Bookmark className="w-5 h-5 text-ink" />
              </div>

              {/* Live Caption Preview */}
              <div className="text-xs text-ink space-y-1.5 leading-relaxed">
                <p>
                  <span className="font-semibold mr-1.5">
                    @veyra
                  </span>
                  <span className="font-medium">{productTitle}</span> —{' '}
                  {shortDescription}
                </p>
                <p className="text-muted whitespace-pre-line line-clamp-4">
                  {caption}
                </p>
                <p className="text-ink font-medium pt-1">{cta}</p>
                <p className="text-muted pt-1">
                  {hashtags.join(' ')}
                </p>
              </div>
            </div>
          </div>

          {/* Carousel Sequencer & Cover Image Selector */}
          <div className="bg-white border border-line p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="font-editorial text-xl font-semibold text-ink">
                  Carousel Sequence & Cover
                </h2>
                <p className="text-xs text-muted">
                  Reorder frames or set the lead cover plate
                </p>
              </div>
              <span className="text-xs font-mono text-muted tabular-nums">
                {orderedCarousel.length} slides
              </span>
            </div>

            <div className="space-y-2.5">
              {orderedCarousel.map((img, index) => (
                <div
                  key={img.id}
                  className={`p-2.5 border flex items-center justify-between gap-3 ${
                    index === safeSlideIndex
                      ? 'border-ink bg-canvas'
                      : 'border-line bg-white'
                  }`}
                >
                  <div
                    onClick={() => setActiveSlideIndex(index)}
                    className="flex items-center gap-3 cursor-pointer min-w-0"
                  >
                    <span className="text-xs font-mono text-muted w-5 tabular-nums">
                      0{index + 1}
                    </span>
                    <div className="w-10 h-12 shrink-0 border border-line overflow-hidden">
                      <FashionImage
                        src={img.imageUrl}
                        alt={img.shotType}
                        aspectClass="w-full h-full"
                        cropVariant={img.cropVariant}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-ink truncate">
                          {img.shotType}
                        </span>
                        {index === 0 && (
                          <span className="text-[11px] font-mono text-muted">
                            · Cover
                          </span>
                        )}
                      </div>
                      <span className="block text-[11px] text-faint truncate">
                        {img.style}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {index !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleSetAsCover(img.id)}
                        title="Set as Cover Image"
                        className="px-2 py-1 text-[11px] font-medium text-ink bg-white border border-line-strong hover:border-ink transition-colors whitespace-nowrap"
                      >
                        Set Cover
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveSlide(index, -1)}
                      aria-label="Move slide earlier"
                      className="p-1.5 text-muted hover:text-ink disabled:opacity-30"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === orderedCarousel.length - 1}
                      onClick={() => handleMoveSlide(index, 1)}
                      aria-label="Move slide later"
                      className="p-1.5 text-muted hover:text-ink disabled:opacity-30"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {orderedCarousel.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCarousel(img.id)}
                        aria-label="Remove slide"
                        className="p-1.5 text-faint hover:text-[#991B1B]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {unselectedShootImages.length > 0 && (
              <div className="pt-3 border-t border-line">
                <span className="block text-xs text-muted mb-2">
                  Add More Frames from Shoot
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {unselectedShootImages.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => handleAddImageToCarousel(img.id)}
                      className="group relative w-14 h-16 shrink-0 border border-line-strong hover:border-ink overflow-hidden"
                      title={`Add ${img.shotType}`}
                    >
                      <FashionImage
                        src={img.imageUrl}
                        alt={img.shotType}
                        aspectClass="w-full h-full"
                        cropVariant={img.cropVariant}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <Plus className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Original Editorial Copy & Hashtag Studio */}
        <div className="lg:col-span-7 space-y-6">
          {/* Original Copy Tone & Generator Panel */}
          <section className="bg-white border border-line p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-ink">
                  01. Original Editorial Copywriting
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Crafted from garment visual traits & shoot mood — never copied verbatim from raw catalogue specs
                </p>
              </div>

              <button
                type="button"
                disabled={isGeneratingCopy}
                onClick={() => handleRegenerateEditorialCopy(captionTone)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-ink bg-canvas border border-line-strong hover:border-ink disabled:opacity-50 transition-colors whitespace-nowrap self-start sm:self-auto"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isGeneratingCopy ? 'animate-spin' : ''}`}
                />
                {isGeneratingCopy ? 'Drafting Copy...' : 'Draft Fresh Variation'}
              </button>
            </div>
            {copyError && (
              <p className="text-xs text-[#991B1B]">{copyError}</p>
            )}

            {/* Tone Selector */}
            <div>
              <span className="block text-xs font-medium text-ink mb-2">
                Editorial Voice Preset
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    'Editorial Storytelling',
                    'Minimalist Luxury',
                    'Festive Heritage',
                    'Boutique Launch',
                  ] as const
                ).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => handleRegenerateEditorialCopy(tone)}
                    className={`py-2 px-3 text-xs font-medium border transition-colors whitespace-nowrap truncate ${
                      captionTone === tone
                        ? 'bg-ink text-white border-ink'
                        : 'bg-canvas text-ink border-line-strong hover:border-ink'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Title & Short Description */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="ig-product-title"
                  className="block text-xs font-medium text-ink mb-1.5"
                >
                  Editorial Product Title
                </label>
                <input
                  id="ig-product-title"
                  type="text"
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  className="w-full bg-canvas border border-line-strong px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
                />
              </div>

              <div>
                <label
                  htmlFor="ig-short-desc"
                  className="block text-xs font-medium text-ink mb-1.5"
                >
                  Short Editorial Lead-In
                </label>
                <textarea
                  id="ig-short-desc"
                  rows={2}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full bg-canvas border border-line-strong p-3 text-sm text-ink focus:outline-none focus:border-ink leading-relaxed"
                />
              </div>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="ig-caption-body"
                    className="text-xs font-medium text-ink"
                  >
                    Instagram Caption Body
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono text-muted tabular-nums">
                      {caption.length} chars
                    </span>
                    <CopyButton text={caption} label="Copy caption" />
                    <CopyButton text={postText} label="Copy post" />
                  </div>
                </div>
                <textarea
                  id="ig-caption-body"
                  rows={6}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-canvas border border-line-strong p-3.5 text-sm text-ink focus:outline-none focus:border-ink leading-relaxed"
                />
                {copyPromptUsed && (
                  <div className="mt-3 rounded-xl border border-line bg-canvas p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-ink">Prompt used</p>
                      <CopyButton text={copyPromptUsed} label="Copy prompt" />
                    </div>
                    <p className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
                      {copyPromptUsed}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Non-verbatim comparison strip */}
            <div className="p-3.5 bg-canvas border border-line text-xs space-y-1">
              <span className="block font-mono text-[11px] text-muted">
                Source Catalogue Raw Spec (Excluded from Caption):
              </span>
              <p className="font-mono text-[11px] text-faint line-through">
                {activeProduct.rawCatalogueText}
              </p>
            </div>
          </section>

          {/* 02. CTA & HASHTAG GENERATOR */}
          <section className="bg-white border border-line p-6 space-y-5">
            <div className="border-b border-line pb-3">
              <h2 className="font-editorial text-2xl font-semibold text-ink">
                02. Call to Action & Curated Hashtags
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Configure conversion messaging and South Asian luxury fashion discovery tags
              </p>
            </div>

            {/* Call to Action */}
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="ig-cta-input"
                  className="block text-xs font-medium text-ink"
                >
                  Call to action
                </label>
                <CopyButton text={cta} label="Copy call to action" />
              </div>
              <input
                id="ig-cta-input"
                type="text"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                className="w-full bg-canvas border border-line-strong px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {CTA_PRESETS.map((presetCta, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCta(presetCta)}
                    className="px-2.5 py-1 text-[11px] bg-canvas border border-line text-muted hover:text-ink hover:border-ink transition-colors truncate max-w-full"
                  >
                    {presetCta}
                  </button>
                ))}
              </div>
            </div>

            {/* Hashtag Set */}
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink">
                  Hashtag Set ({hashtags.length} tags)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton text={hashtags.join(' ')} label="Copy hashtags" />
                  <button
                  type="button"
                  onClick={() =>
                    setHashtags([
                      '#Veyra',
                      '#PakistaniCouture',
                      '#SouthAsianFashion',
                      '#LuxuryPretEdit',
                      '#KarachiFashion',
                      '#LahoreStyle',
                      '#HandcraftedZardozi',
                      '#EditorialCampaign',
                    ])
                  }
                  className="flex items-center gap-1 text-xs text-ink hover:underline underline-offset-4 whitespace-nowrap"
                >
                  <Sparkles className="w-3 h-3" />
                  Refresh Curated Tags
                </button>
                </div>
              </div>

              <div className="p-3.5 bg-canvas border border-line-strong flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setHashtags(hashtags.filter((t) => t !== tag))
                    }
                    title="Click to remove hashtag"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-line text-xs font-mono text-ink hover:border-[#991B1B] hover:text-[#991B1B] transition-colors whitespace-nowrap"
                  >
                    <span>{tag}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddCustomHashtag} className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  value={customHashtagInput}
                  onChange={(e) => setCustomHashtagInput(e.target.value)}
                  placeholder="Add custom hashtag (e.g. FestiveLookbook26)"
                  className="flex-1 bg-canvas border border-line-strong px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-ink bg-white border border-line-strong hover:border-ink transition-colors whitespace-nowrap"
                >
                  + Add Tag
                </button>
              </form>
            </div>

            {/* Bottom Save Bar */}
            <div className="pt-5 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-xs text-muted">
                Aspect Ratio: Instagram Portrait 4:5 (1080 × 1350 px)
              </span>
              <button
                type="button"
                onClick={handleSavePost}
                className="flex items-center justify-center gap-2 px-8 py-3 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap"
              >
                {saveFeedback ? (
                  <>
                    <Check className="w-4 h-4" />
                    Draft Saved to Library
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4" />
                    Save Instagram Post Draft
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
