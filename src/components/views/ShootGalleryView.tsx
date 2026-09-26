import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckSquare,
  Columns,
  Download,
  Instagram,
  Loader2,
  RefreshCw,
  Sliders,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import {
  CatalogueProduct,
  GeneratedShootImage,
  ShotPoseType,
} from '../../types/studio';
import { FashionImage } from '../common/FashionImage';

interface ShootGalleryViewProps {
  images: GeneratedShootImage[];
  activeProduct: CatalogueProduct | null;
  onToggleSelectForPost: (imageId: string) => void;
  onSelectAllForPost: (selected: boolean) => void;
  onCompareImage: (image: GeneratedShootImage) => void;
  onEditPrompt: (image: GeneratedShootImage) => void;
  onRegenerateImage: (imageId: string) => void;
  onDeleteImageRequest: (image: GeneratedShootImage) => void;
  onOpenPostBuilder: () => void;
  onBackToWorkspace: () => void;
}

export const ShootGalleryView: React.FC<ShootGalleryViewProps> = ({
  images,
  activeProduct,
  onToggleSelectForPost,
  onSelectAllForPost,
  onCompareImage,
  onEditPrompt,
  onRegenerateImage,
  onDeleteImageRequest,
  onOpenPostBuilder,
  onBackToWorkspace,
}) => {
  const [poseFilter, setPoseFilter] = useState<'ALL' | ShotPoseType>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ACTIVE' | 'ALL'>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const scopedImages =
    scopeFilter === 'ACTIVE' && activeProduct
      ? images.filter((img) => img.productId === activeProduct.id)
      : images;

  const filteredImages =
    poseFilter === 'ALL'
      ? scopedImages
      : scopedImages.filter((img) => img.shotType === poseFilter);

  const selectedImages = images.filter((img) => img.selectedForPost);

  const handleDownloadPlate = (img: GeneratedShootImage) => {
    setDownloadingId(img.id);
    const link = document.createElement('a');
    link.href = img.imageUrl;
    link.download = `${img.productSku}_${img.shotType.replace(/\s+/g, '_')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadingId(null), 600);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Bar */}
      <div className="border-b border-[#E6E4DD] pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBackToWorkspace}
            className="mt-1 p-2 bg-white border border-[#D6D3C9] text-[#141413] hover:border-[#141413] transition-colors"
            aria-label="Back to workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-[#6E6B62]">
              <span>Results & Contact Sheet</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {filteredImages.length} frames displayed
              </span>
            </div>
            <h1 className="font-editorial text-3xl md:text-4xl font-semibold text-[#141413] mt-0.5">
              Editorial Shoot Gallery
            </h1>
            <p className="mt-1 text-sm text-[#57554E]">
              Inspect garment fidelity against the original flat-lay, refine individual camera prompts, and select frames for your Instagram carousel.
            </p>
          </div>
        </div>

        {/* Primary Post Builder Action */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBackToWorkspace}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#141413] bg-white border border-[#D6D3C9] hover:border-[#141413] transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Configure New Shoot
          </button>

          <button
            type="button"
            onClick={onOpenPostBuilder}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap"
          >
            <Instagram className="w-3.5 h-3.5" />
            Instagram Post Builder ({selectedImages.length} selected)
          </button>
        </div>
      </div>

      {/* Interactive Filter & Batch Selection Bar */}
      <div className="bg-white border border-[#E2DFD7] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {activeProduct && (
            <div className="flex items-center bg-[#F2F0E8] p-1 border border-[#E2DFD7] mr-2">
              <button
                type="button"
                onClick={() => setScopeFilter('ALL')}
                className={`px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  scopeFilter === 'ALL'
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#6E6B62] hover:text-[#141413]'
                }`}
              >
                All Shoots ({images.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('ACTIVE')}
                className={`px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  scopeFilter === 'ACTIVE'
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#6E6B62] hover:text-[#141413]'
                }`}
              >
                {activeProduct.sku} Only
              </button>
            </div>
          )}

          {/* Shot Type Filter Buttons */}
          {(
            [
              'ALL',
              'Full body',
              '3/4 standing',
              'Detail portrait',
              'Walking',
              'Seated',
              'Back/side angle',
            ] as const
          ).map((pose) => (
            <button
              key={pose}
              type="button"
              onClick={() => setPoseFilter(pose)}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap ${
                poseFilter === pose
                  ? 'bg-[#141413] text-white border-[#141413]'
                  : 'bg-[#FAF9F5] text-[#57554E] border-[#E2DFD7] hover:text-[#141413]'
              }`}
            >
              {pose === 'ALL' ? 'All Angles' : pose}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
          <button
            type="button"
            onClick={() =>
              onSelectAllForPost(selectedImages.length < filteredImages.length)
            }
            className="text-xs font-medium text-[#141413] hover:underline underline-offset-4 whitespace-nowrap"
          >
            {selectedImages.length >= filteredImages.length && filteredImages.length > 0
              ? 'Clear Carousel Selection'
              : 'Select All for Carousel'}
          </button>
        </div>
      </div>

      {/* Contact Sheet Grid */}
      {filteredImages.length === 0 ? (
        <div className="bg-white border border-[#E2DFD7] p-12 text-center space-y-4">
          <p className="font-editorial text-2xl text-[#141413]">
            No editorial frames match this shot angle filter.
          </p>
          <p className="text-xs text-[#6E6B62]">
            Reset the angle filter or return to the Product Workspace to generate additional poses.
          </p>
          <button
            type="button"
            onClick={() => setPoseFilter('ALL')}
            className="px-4 py-2 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors"
          >
            Show All Generated Frames
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredImages.map((img) => {
            const isRegenerating = img.status === 'Regenerating';
            return (
              <article
                key={img.id}
                className={`bg-white border transition-colors flex flex-col justify-between ${
                  img.selectedForPost ? 'border-[#141413]' : 'border-[#E2DFD7]'
                }`}
              >
                <div>
                  {/* Card Top Selection & Status Bar */}
                  <div className="px-4 py-3 border-b border-[#E6E4DD] bg-[#FAF9F5] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleSelectForPost(img.id)}
                      className="flex items-center gap-2 text-xs font-medium text-[#141413] hover:opacity-80 transition-opacity whitespace-nowrap"
                    >
                      {img.selectedForPost ? (
                        <CheckSquare className="w-4 h-4 text-[#141413]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#78756C]" />
                      )}
                      <span>
                        {img.selectedForPost ? 'In IG Carousel' : 'Select for Post'}
                      </span>
                    </button>

                    {/* Clean unboxed status text */}
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#6E6B62]">
                      <span>{img.productSku}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          img.status === 'Regenerating'
                            ? 'text-[#D97706]'
                            : 'text-[#16A34A]'
                        }
                      >
                        {img.status}
                      </span>
                    </div>
                  </div>

                  {/* Main Editorial Image Plate */}
                  <div className="relative p-4 bg-white">
                    {isRegenerating ? (
                      <div className="aspect-[4/5] bg-[#FAF9F5] border border-[#E6E4DD] flex flex-col items-center justify-center p-6 text-center">
                        <Loader2 className="w-6 h-6 text-[#141413] animate-spin mb-3" />
                        <p className="font-editorial text-xl text-[#141413]">
                          Re-composing {img.shotType} frame...
                        </p>
                        <span className="mt-1 text-xs font-mono text-[#6E6B62]">
                          Preserving garment embroidery & drape
                        </span>
                      </div>
                    ) : (
                      <FashionImage
                        src={img.imageUrl}
                        alt={`${img.productName} — ${img.shotType}`}
                        aspectClass="aspect-[4/5]"
                        cropVariant={img.cropVariant}
                      />
                    )}
                  </div>

                  {/* Subtle Unboxed Metadata Block */}
                  <div className="px-5 pb-4 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#141413] font-medium">
                      <span>{img.shotType}</span>
                      <span aria-hidden="true" className="text-[#78756C]">·</span>
                      <span>{img.style}</span>
                      <span aria-hidden="true" className="text-[#78756C]">·</span>
                      <span className="font-mono text-[11px] text-[#6E6B62]">
                        {img.aspectRatio}
                      </span>
                    </div>

                    <p className="text-xs text-[#57554E] truncate">
                      Model: {img.modelSummary}
                    </p>

                    <p className="text-[11px] text-[#78756C] line-clamp-2 leading-relaxed">
                      {img.promptNotes}
                    </p>
                  </div>
                </div>

                {/* Action Bar: Compare, Edit Prompt, Regenerate, Download, Add to IG, Delete */}
                <div className="px-4 py-3 border-t border-[#E6E4DD] bg-[#FAF9F5] space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onCompareImage(img)}
                      className="flex items-center justify-center gap-1.5 py-2 px-2 bg-white border border-[#D6D3C9] text-xs font-medium text-[#141413] hover:border-[#141413] transition-colors whitespace-nowrap"
                    >
                      <Columns className="w-3.5 h-3.5" />
                      Compare
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditPrompt(img)}
                      className="flex items-center justify-center gap-1.5 py-2 px-2 bg-white border border-[#D6D3C9] text-xs font-medium text-[#141413] hover:border-[#141413] transition-colors whitespace-nowrap"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      Edit Prompt
                    </button>

                    <button
                      type="button"
                      disabled={isRegenerating}
                      onClick={() => onRegenerateImage(img.id)}
                      className="flex items-center justify-center gap-1.5 py-2 px-2 bg-white border border-[#D6D3C9] text-xs font-medium text-[#141413] hover:border-[#141413] disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`}
                      />
                      Regenerate
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!img.selectedForPost) {
                          onToggleSelectForPost(img.id);
                        }
                        onOpenPostBuilder();
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium text-[#141413] hover:underline underline-offset-4 whitespace-nowrap"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      Send to Instagram Post
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDownloadPlate(img)}
                        aria-label="Download image"
                        title="Download high-res plate"
                        className="p-1.5 text-[#57554E] hover:text-[#141413] transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteImageRequest(img)}
                        aria-label="Reject and delete image"
                        title="Reject image"
                        className="p-1.5 text-[#57554E] hover:text-[#991B1B] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {downloadingId === img.id && (
                    <p className="text-[11px] font-mono text-[#16A34A]">
                      Exporting 4:5 editorial plate...
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
