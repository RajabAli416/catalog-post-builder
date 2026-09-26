import React, { useEffect, useState } from 'react';
import { Columns, Sliders, X, Sparkles, Check } from 'lucide-react';
import {
  BackgroundType,
  GeneratedShootImage,
  ShootStyleId,
  ShotPoseType,
} from '../../types/studio';
import { RegenerateImageOverrides } from '../../services/studioApi';
import { FashionImage } from './FashionImage';

interface CompareModalProps {
  image: GeneratedShootImage | null;
  onClose: () => void;
  onSavePromptEdit?: (
    imageId: string,
    overrides: RegenerateImageOverrides
  ) => void;
  initialMode?: 'compare' | 'prompt';
}

const ALL_POSES: ShotPoseType[] = [
  'Full body',
  '3/4 standing',
  'Walking',
  'Seated',
  'Detail portrait',
  'Back/side angle',
];

const ALL_STYLES: ShootStyleId[] = [
  'Luxury Editorial',
  'Minimal Studio',
  'Outdoor Lifestyle',
  'Boutique Catalogue',
  'Festive',
  'Modern Pakistani Fashion',
];

const ALL_BACKGROUNDS: BackgroundType[] = [
  'Studio',
  'Luxury interior',
  'Minimal architectural',
  'Outdoor',
  'Custom',
];

export const CompareModal: React.FC<CompareModalProps> = ({
  image,
  onClose,
  onSavePromptEdit,
  initialMode = 'compare',
}) => {
  const [activeTab, setActiveTab] = useState<'compare' | 'prompt'>(initialMode);
  const [promptText, setPromptText] = useState(image?.promptNotes || '');
  const [shotType, setShotType] = useState<ShotPoseType>(
    image?.shotType || 'Full body'
  );
  const [style, setStyle] = useState<ShootStyleId>(
    image?.style || 'Luxury Editorial'
  );
  const [background, setBackground] = useState<BackgroundType>(
    image?.background || 'Minimal architectural'
  );
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (image) {
      setActiveTab(initialMode);
      setPromptText(image.promptNotes || '');
      setShotType(image.shotType);
      setStyle(image.style);
      setBackground(image.background);
    }
  }, [image, initialMode]);

  if (!image) return null;

  const handleApplyPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSavePromptEdit) {
      onSavePromptEdit(image.id, {
        promptNotes: promptText,
        shotType,
        style,
        background,
      });
      setSavedNotice(true);
      setTimeout(() => {
        setSavedNotice(false);
        onClose();
      }, 450);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[2px] p-4 md:p-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-5xl bg-[#FAF9F5] border border-[#E2DFD7] shadow-2xl overflow-hidden my-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E4DD] bg-white">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#6E6B62]">
              <span className="font-mono">{image.productSku}</span>
              <span aria-hidden="true">·</span>
              <span>{image.shotType}</span>
              <span aria-hidden="true">·</span>
              <span>{image.style}</span>
            </div>
            <h3 className="font-editorial text-2xl font-semibold text-[#141413] mt-0.5">
              {image.productName}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#F2F0E8] p-1 border border-[#E2DFD7]">
              <button
                type="button"
                onClick={() => setActiveTab('compare')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'compare'
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#6E6B62] hover:text-[#141413]'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                Garment Comparison
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('prompt')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'prompt'
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#6E6B62] hover:text-[#141413]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Regenerate & Edit Parameters
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close viewer"
              className="p-2 text-[#6E6B62] hover:text-[#141413] border border-transparent hover:border-[#E2DFD7] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {activeTab === 'compare' ? (
          <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left: Original Catalogue Garment */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[#141413]">
                  01. Source Catalogue Garment Reference
                </span>
                <span className="text-xs font-mono text-[#6E6B62]">
                  Original Input
                </span>
              </div>
              <div className="border border-[#E2DFD7] bg-white p-3">
                <FashionImage
                  src={image.garmentReferenceUrl}
                  alt={`Original garment ${image.productName}`}
                  aspectClass="aspect-[4/5]"
                  cropVariant="full"
                />
              </div>
              <p className="mt-3 text-xs text-[#6E6B62] leading-relaxed">
                Preserved attributes: neckline zardozi geometry, sleeve border proportions, and authentic silk sheen.
              </p>
            </div>

            {/* Right: Generated Editorial Output */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[#141413]">
                  02. Generated Editorial Photograph
                </span>
                <span className="text-xs font-mono text-[#6E6B62]">
                  {image.shotType} · {image.aspectRatio}
                </span>
              </div>
              <div className="border border-[#E2DFD7] bg-white p-3">
                <FashionImage
                  src={image.imageUrl}
                  alt={`Generated editorial ${image.productName}`}
                  aspectClass="aspect-[4/5]"
                  cropVariant={image.cropVariant}
                />
              </div>
              <p className="mt-3 text-xs text-[#6E6B62] leading-relaxed">
                Model: {image.modelSummary} · Setting: {image.background}
              </p>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleApplyPrompt}
            className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8"
          >
            <div className="md:col-span-5 space-y-3">
              <div className="border border-[#E2DFD7] bg-white p-3">
                <FashionImage
                  src={image.imageUrl}
                  alt={image.productName}
                  aspectClass="aspect-[4/5]"
                  cropVariant={image.cropVariant}
                />
              </div>
              <div className="p-3 bg-white border border-[#E2DFD7] flex items-center gap-3">
                <div className="w-10 h-12 shrink-0 border border-[#E2DFD7] overflow-hidden">
                  <FashionImage
                    src={image.garmentReferenceUrl}
                    alt="Garment reference"
                    aspectClass="w-full h-full"
                  />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-mono text-[#141413]">
                    Garment Reference Attached
                  </span>
                  <span className="block text-[11px] text-[#6E6B62] truncate">
                    Original plate + structured analysis locked
                  </span>
                </div>
              </div>
            </div>

            <div className="md:col-span-7 flex flex-col justify-between">
              <div className="space-y-5">
                <div>
                  <h4 className="font-editorial text-2xl font-semibold text-[#141413]">
                    Regenerate Shot & Refine Direction
                  </h4>
                  <p className="mt-1 text-sm text-[#57554E]">
                    Regenerate the same shot or modify the pose, shoot style, background environment, and art direction prompt. The garment reference remains attached automatically.
                  </p>
                </div>

                {/* Phase 2H Controls: Pose, Style, Background */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label
                      htmlFor="regen-pose-select"
                      className="block text-xs font-medium text-[#141413] mb-1.5"
                    >
                      Shot / Pose
                    </label>
                    <select
                      id="regen-pose-select"
                      value={shotType}
                      onChange={(e) =>
                        setShotType(e.target.value as ShotPoseType)
                      }
                      className="w-full bg-white border border-[#D6D3C9] px-3 py-2 text-xs text-[#141413] focus:outline-none focus:border-[#141413]"
                    >
                      {ALL_POSES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="regen-style-select"
                      className="block text-xs font-medium text-[#141413] mb-1.5"
                    >
                      Shoot Style
                    </label>
                    <select
                      id="regen-style-select"
                      value={style}
                      onChange={(e) =>
                        setStyle(e.target.value as ShootStyleId)
                      }
                      className="w-full bg-white border border-[#D6D3C9] px-3 py-2 text-xs text-[#141413] focus:outline-none focus:border-[#141413]"
                    >
                      {ALL_STYLES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="regen-bg-select"
                      className="block text-xs font-medium text-[#141413] mb-1.5"
                    >
                      Background
                    </label>
                    <select
                      id="regen-bg-select"
                      value={background}
                      onChange={(e) =>
                        setBackground(e.target.value as BackgroundType)
                      }
                      className="w-full bg-white border border-[#D6D3C9] px-3 py-2 text-xs text-[#141413] focus:outline-none focus:border-[#141413]"
                    >
                      {ALL_BACKGROUNDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="prompt-direction-input"
                    className="block text-xs font-medium text-[#141413] mb-2"
                  >
                    Editorial Direction & Prompt Notes
                  </label>
                  <textarea
                    id="prompt-direction-input"
                    rows={4}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    className="w-full bg-white border border-[#D6D3C9] p-3.5 text-sm text-[#141413] focus:outline-none focus:border-[#141413] leading-relaxed"
                    placeholder="Describe lighting, camera angle, model expression, and background nuances..."
                  />
                </div>

                <div>
                  <span className="block text-xs text-[#6E6B62] mb-2">
                    Quick Art Direction Modifiers
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Softer golden-hour rim light',
                      'Closer focus on neckline zardozi',
                      'More architectural limestone shadow',
                      'Subtle wind movement in dupatta',
                    ].map((modifier) => (
                      <button
                        key={modifier}
                        type="button"
                        onClick={() =>
                          setPromptText((prev) =>
                            prev.includes(modifier)
                              ? prev
                              : `${prev.replace(/\.$/, '')}. ${modifier}.`
                          )
                        }
                        className="px-3 py-1.5 text-xs bg-white border border-[#E2DFD7] text-[#57554E] hover:text-[#141413] hover:border-[#141413] transition-colors whitespace-nowrap"
                      >
                        + {modifier}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-[#E6E4DD] flex items-center justify-between">
                <span className="text-xs text-[#6E6B62]">
                  Master Garment Instruction & Reference Image automatically included
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-xs font-medium text-[#141413] bg-white border border-[#D6D3C9] hover:bg-[#F2F0E8] transition-colors whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap"
                  >
                    {savedNotice ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Re-rendering Frame...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Regenerate Shot
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
