import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  AspectRatioType,
  BackgroundType,
  CatalogueProduct,
  ShootConfiguration,
  ShotPoseType,
} from '../../types/studio';
import { SHOOT_STYLE_PRESETS } from '../../data/studioDefaults';
import { FashionImage } from '../common/FashionImage';

interface ProductWorkspaceViewProps {
  product: CatalogueProduct;
  projectName?: string;
  allProducts: CatalogueProduct[];
  config: ShootConfiguration;
  isAnalyzingGarment?: boolean;
  onSelectProduct: (product: CatalogueProduct) => void;
  onAnalyzeGarment: (productId: string) => void;
  onChangeConfig: (nextConfig: ShootConfiguration) => void;
  onGenerateShoot: () => void;
  onBackToCatalogue: () => void;
}

const FRAMING_POSES: ShotPoseType[] = [
  'Full body',
  '3/4 standing',
  'Walking',
  'Seated',
  'Detail portrait',
  'Back/side angle',
];

const DETAIL_POSES: ShotPoseType[] = [
  'Sleeve close-up',
  'Neckline close-up',
  'Embroidery close-up',
  'Print / pattern close-up',
  'Dupatta close-up',
  'Fabric texture',
  'Cuff / border detail',
  'Trouser detail',
];

const ALL_BACKGROUNDS: BackgroundType[] = [
  'Studio',
  'Luxury interior',
  'Minimal architectural',
  'Outdoor',
  'Custom',
];

const ALL_ASPECT_RATIOS: AspectRatioType[] = [
  'Instagram Portrait 4:5',
  'Square 1:1',
  'Story 9:16',
];

export const ProductWorkspaceView: React.FC<ProductWorkspaceViewProps> = ({
  product,
  projectName,
  allProducts,
  config,
  isAnalyzingGarment = false,
  onSelectProduct,
  onAnalyzeGarment,
  onChangeConfig,
  onGenerateShoot,
  onBackToCatalogue,
}) => {
  const [zoomReference, setZoomReference] = useState(false);
  const [expandAnalysis, setExpandAnalysis] = useState(true);

  // Automatically trigger structured garment analysis when a newly uploaded product is selected without analysis
  useEffect(() => {
    if (!product.garmentAnalysis && !isAnalyzingGarment) {
      onAnalyzeGarment(product.id);
    }
  }, [product.id, product.garmentAnalysis, isAnalyzingGarment, onAnalyzeGarment]);

  const togglePose = (pose: ShotPoseType) => {
    const exists = config.poses.includes(pose);
    if (exists && config.poses.length === 1) {
      return;
    }
    const nextPoses = exists
      ? config.poses.filter((p) => p !== pose)
      : [...config.poses, pose];
    onChangeConfig({
      ...config,
      poses: nextPoses,
      numberOfImages: nextPoses.length,
    });
  };

  const analysis = product.garmentAnalysis;

  return (
    <div className="space-y-8 pb-16">
      {/* Top Workspace Header */}
      <div className="border-b border-line pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToCatalogue}
            className="p-2 bg-white border border-line-strong text-ink hover:border-ink transition-colors"
            aria-label="Back to products"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>{projectName || 'Product Workspace'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{product.name}</span>
            </div>
            <h1 className="font-editorial text-2xl md:text-3xl font-semibold text-ink">
              {product.name}
            </h1>
          </div>
        </div>

        {/* Product Switcher & Top CTA */}
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="workspace-product-switcher" className="sr-only">
            Switch active garment
          </label>
          <select
            id="workspace-product-switcher"
            value={product.id}
            onChange={(e) => {
              const found = allProducts.find((p) => p.id === e.target.value);
              if (found) onSelectProduct(found);
            }}
            className="bg-white border border-line-strong px-3.5 py-2 text-xs font-medium text-ink focus:outline-none focus:border-ink"
          >
            {allProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onGenerateShoot}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Shoot ({config.poses.length}{' '}
            {config.poses.length === 1 ? 'Frame' : 'Frames'})
          </button>
        </div>
      </div>

      {/* Main Split Layout: Large Garment Reference Left (5 cols) + Controls Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: Large Garment Reference Plate + Structured Garment Analysis (Phase 2C) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
          <div className="bg-white border border-line p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-line">
              <div className="flex items-center gap-2 text-xs text-ink font-medium">
                <span>Garment Reference Plate</span>
                <span aria-hidden="true" className="text-muted">·</span>
                <span className="font-mono text-muted">{product.sku}</span>
              </div>
              <button
                type="button"
                onClick={() => setZoomReference((z) => !z)}
                className="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors whitespace-nowrap"
              >
                {zoomReference ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    Fit Frame
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    Inspect Embroidery
                  </>
                )}
              </button>
            </div>

            <FashionImage
              src={product.garmentImageUrl}
              alt={product.name}
              aspectClass="aspect-[3/4]"
              cropVariant={zoomReference ? 'three-quarter' : 'full'}
            />

            <div className="mt-4 pt-4 border-t border-line space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Textile & Craft</span>
                <span className="text-ink font-medium text-right">
                  {product.fabricDetails}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Multimodal Conditioning</span>
                <span className="text-ink font-mono text-[11px]">
                  Reference Image + Vision JSON Attached
                </span>
              </div>
            </div>
          </div>

          {/* Phase 2C: Structured Gemini Garment Analysis Panel */}
          <div className="bg-white border border-line p-4 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setExpandAnalysis((prev) => !prev)}
                className="flex items-center gap-2 text-left"
              >
                <span className="text-xs font-medium text-ink">
                  Structured Garment Analysis
                </span>
                {expandAnalysis ? (
                  <ChevronUp className="w-3.5 h-3.5 text-muted" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-muted" />
                )}
              </button>

              <button
                type="button"
                disabled={isAnalyzingGarment}
                onClick={() => onAnalyzeGarment(product.id)}
                className="flex items-center gap-1.5 text-[11px] font-mono text-muted hover:text-ink disabled:opacity-50 transition-colors"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isAnalyzingGarment ? 'animate-spin' : ''}`}
                />
                {isAnalyzingGarment ? 'Analyzing...' : 'Re-Analyze'}
              </button>
            </div>

            {isAnalyzingGarment ? (
              <div className="py-6 flex flex-col items-center justify-center text-center bg-canvas border border-line">
                <Loader2 className="w-4 h-4 text-ink animate-spin mb-2" />
                <span className="text-xs text-ink font-medium">
                  Extracting garment geometry, colors & embroidery...
                </span>
              </div>
            ) : analysis && expandAnalysis ? (
              <div className="space-y-2.5 pt-2 border-t border-line text-xs">
                <div className="grid grid-cols-1 gap-2 bg-canvas p-3 border border-line">
                  <div>
                    <span className="text-[10px] font-mono text-muted block">
                      SHIRT / KAMEEZ & SILHOUETTE
                    </span>
                    <span className="text-ink">{analysis.shirtKameezDesign}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-muted block">
                      TROUSERS / DUPATTA
                    </span>
                    <span className="text-ink">{analysis.trousersShawlDupatta}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-muted block">
                      DOMINANT & ACCENT PALETTE
                    </span>
                    <span className="text-ink">
                      {analysis.dominantColors.join(', ')} · {analysis.secondaryColors.join(', ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-muted block">
                      EMBROIDERY, NECKLINE & SLEEVES
                    </span>
                    <span className="text-ink">
                      {analysis.embroidery} · {analysis.neckline} · {analysis.sleeves}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-muted block">
                      IMMUTABLE GARMENT LOCKS
                    </span>
                    <ul className="mt-0.5 space-y-0.5 text-muted">
                      {analysis.immutableElements.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Raw Catalogue Excerpt Note */}
          <div className="bg-white border border-line p-4">
            <span className="block text-[11px] font-mono text-muted mb-1">
              Detected Catalogue Line-Sheet Spec
            </span>
            <p className="text-xs text-muted font-mono leading-relaxed">
              {product.rawCatalogueText}
            </p>
          </div>
        </div>

        {/* RIGHT: Studio Generation Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* 01. MODEL CONFIGURATION */}
          <section className="bg-white border border-line p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-ink">
                  01. Model Casting & Styling
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Configure South Asian editorial talent parameters and subtle styling details
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-ink font-medium">
                <UserCheck className="w-3.5 h-3.5" />
                <span>AI-Generated Model</span>
              </div>
            </div>

            {/* Primary Fixed / Core Identity Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-canvas border border-line">
                <span className="block text-[11px] text-muted">Model Type</span>
                <span className="mt-1 block text-xs font-medium text-ink">
                  AI-Generated Editorial Talent
                </span>
              </div>
              <div className="p-3.5 bg-canvas border border-line">
                <span className="block text-[11px] text-muted">Gender</span>
                <span className="mt-1 block text-xs font-medium text-ink">
                  {config.model.gender}
                </span>
              </div>
              <div className="p-3.5 bg-canvas border border-line">
                <span className="block text-[11px] text-muted">Model Style</span>
                <span className="mt-1 block text-xs font-medium text-ink">
                  {config.model.modelStyle}
                </span>
              </div>
            </div>

            {/* Age Range & Model Persona */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="model-persona-select"
                  className="block text-xs font-medium text-ink mb-2"
                >
                  Studio Face / Look Preset
                </label>
                <select
                  id="model-persona-select"
                  value={config.model.personaName}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      model: { ...config.model, personaName: e.target.value },
                    })
                  }
                  className="w-full bg-canvas border border-line-strong px-3.5 py-2.5 text-xs text-ink focus:outline-none focus:border-ink"
                >
                  <option value="Ayla Raza (Lahore Editorial)">
                    Ayla Raza — Lahore Couture Editorial
                  </option>
                  <option value="Meher Shah (Karachi Minimalist)">
                    Meher Shah — Karachi Contemporary Minimalist
                  </option>
                  <option value="Zoya Tariq (Islamabad Festive)">
                    Zoya Tariq — Classic South Asian Bridal/Festive
                  </option>
                  <option value="Noor Jehan (Global Diaspora)">
                    Noor Jehan — Global South Asian Runway
                  </option>
                </select>
              </div>

              <div>
                <span className="block text-xs font-medium text-ink mb-2">
                  Age Range
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['20–24', '25–29', '30–35'] as const).map((age) => (
                    <button
                      key={age}
                      type="button"
                      onClick={() =>
                        onChangeConfig({
                          ...config,
                          model: { ...config.model, ageRange: age },
                        })
                      }
                      className={`py-2 px-3 text-xs font-mono tabular-nums border transition-colors whitespace-nowrap ${
                        config.model.ageRange === age
                          ? 'bg-ink text-white border-ink'
                          : 'bg-canvas text-ink border-line-strong hover:border-ink'
                      }`}
                    >
                      {age} yrs
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Minimal Appearance Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label
                  htmlFor="skin-tone-select"
                  className="block text-xs font-medium text-ink mb-1.5"
                >
                  Complexion Undertone
                </label>
                <select
                  id="skin-tone-select"
                  value={config.model.skinComplexion}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      model: {
                        ...config.model,
                        skinComplexion: e.target.value as ShootConfiguration['model']['skinComplexion'],
                      },
                    })
                  }
                  className="w-full bg-canvas border border-line-strong px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
                >
                  <option value="Warm Olive">Warm Olive</option>
                  <option value="Golden Honey">Golden Honey</option>
                  <option value="Rich Caramel">Rich Caramel</option>
                  <option value="Porcelain Ivory">Porcelain Ivory</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="hair-styling-select"
                  className="block text-xs font-medium text-ink mb-1.5"
                >
                  Hair Styling
                </label>
                <select
                  id="hair-styling-select"
                  value={config.model.hairStyling}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      model: {
                        ...config.model,
                        hairStyling: e.target.value as ShootConfiguration['model']['hairStyling'],
                      },
                    })
                  }
                  className="w-full bg-canvas border border-line-strong px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
                >
                  <option value="Sleek Center-Part Bun">Sleek Center-Part Bun</option>
                  <option value="Soft Editorial Waves">Soft Editorial Waves</option>
                  <option value="Traditional Braided">Traditional Braided</option>
                  <option value="Minimal Pulled Back">Minimal Pulled Back</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="styling-accent-select"
                  className="block text-xs font-medium text-ink mb-1.5"
                >
                  Jewelry Restraint
                </label>
                <select
                  id="styling-accent-select"
                  value={config.model.stylingAccent}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      model: {
                        ...config.model,
                        stylingAccent: e.target.value as ShootConfiguration['model']['stylingAccent'],
                      },
                    })
                  }
                  className="w-full bg-canvas border border-line-strong px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
                >
                  <option value="Minimal Gold Studs">Minimal Gold Studs</option>
                  <option value="Heritage Jhumkas">Heritage Jhumkas</option>
                  <option value="Sculptural Cuff">Sculptural Cuff</option>
                  <option value="No Jewelry">No Jewelry (Pure Garment)</option>
                </select>
              </div>
            </div>
          </section>

          {/* 02. SHOOT STYLE PRESETS */}
          <section className="bg-white border border-line p-6 space-y-4">
            <div className="border-b border-line pb-3">
              <h2 className="font-editorial text-2xl font-semibold text-ink">
                02. Shoot Style Direction
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Select the photographic mood and lighting treatment for this garment
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {SHOOT_STYLE_PRESETS.map((preset) => {
                const isSelected = config.shootStyle === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onChangeConfig({ ...config, shootStyle: preset.id })
                    }
                    className={`text-left p-4 border transition-colors flex flex-col justify-between ${
                      isSelected
                        ? 'bg-ink text-white border-ink'
                        : 'bg-canvas text-ink border-line-strong hover:border-ink'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-editorial text-xl font-semibold">
                          {preset.title}
                        </span>
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      </div>
                      <p
                        className={`mt-1 text-xs leading-relaxed ${
                          isSelected ? 'text-line-strong' : 'text-muted'
                        }`}
                      >
                        {preset.subtitle}
                      </p>
                    </div>
                    <span
                      className={`mt-3 pt-2 border-t text-[11px] font-mono block ${
                        isSelected
                          ? 'border-white/15 text-faint'
                          : 'border-line text-faint'
                      }`}
                    >
                      {preset.lightingNote}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 03. POSE / SHOTS (MULTI-SELECT) */}
          <section className="bg-white border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-ink">
                  03. Pose & Camera Framing
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Each selected angle becomes one picture.
                </p>
              </div>
              <span className="text-xs font-mono text-muted tabular-nums">
                {config.poses.length} selected
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-medium text-ink mb-2">Framing</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {FRAMING_POSES.map((pose) => {
                    const active = config.poses.includes(pose);
                    return (
                      <button
                        key={pose}
                        type="button"
                        onClick={() => togglePose(pose)}
                        className={`p-3.5 border text-left transition-colors flex items-center justify-between gap-2 ${
                          active
                            ? 'bg-ink text-white border-ink'
                            : 'bg-canvas text-ink border-line-strong hover:border-ink'
                        }`}
                      >
                        <span className="text-xs font-medium">{pose}</span>
                        <div
                          className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                            active
                              ? 'border-white bg-white text-ink'
                              : 'border-faint'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-medium text-ink mb-2">Detail shots</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {DETAIL_POSES.map((pose) => {
                    const active = config.poses.includes(pose);
                    return (
                      <button
                        key={pose}
                        type="button"
                        onClick={() => togglePose(pose)}
                        className={`p-3.5 border text-left transition-colors flex items-center justify-between gap-2 ${
                          active
                            ? 'bg-ink text-white border-ink'
                            : 'bg-canvas text-ink border-line-strong hover:border-ink'
                        }`}
                      >
                        <span className="text-xs font-medium">{pose}</span>
                        <div
                          className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                            active
                              ? 'border-white bg-white text-ink'
                              : 'border-faint'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 04. BACKGROUND + 05. ASPECT RATIO + 06. NUMBER OF IMAGES */}
          <section className="bg-white border border-line p-6 space-y-6">
            {/* Background */}
            <div>
              <span className="block font-editorial text-2xl font-semibold text-ink mb-1">
                04. Set & Background Environment
              </span>
              <p className="text-xs text-muted mb-3">
                Choose an architectural or studio backdrop that complements the garment palette
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {ALL_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() =>
                      onChangeConfig({ ...config, background: bg })
                    }
                    className={`py-2.5 px-3 text-xs font-medium border transition-colors whitespace-nowrap truncate ${
                      config.background === bg
                        ? 'bg-ink text-white border-ink'
                        : 'bg-canvas text-ink border-line-strong hover:border-ink'
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>

              {config.background === 'Custom' && (
                <div className="mt-3">
                  <label
                    htmlFor="custom-bg-input"
                    className="block text-xs text-muted mb-1.5"
                  >
                    Custom Environment Description
                  </label>
                  <input
                    id="custom-bg-input"
                    type="text"
                    value={config.customBackgroundNote}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        customBackgroundNote: e.target.value,
                      })
                    }
                    placeholder="e.g., Sunlit Mughal sandstone courtyard with travertine arches and soft bougainvillea shadows"
                    className="w-full bg-canvas border border-line-strong px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-ink"
                  />
                </div>
              )}
            </div>

            {/* Aspect Ratio */}
            <div className="pt-5 border-t border-line">
              <span className="block text-xs font-medium text-ink mb-2">
                05. Aspect Ratio
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {ALL_ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() =>
                        onChangeConfig({ ...config, aspectRatio: ratio })
                      }
                      className={`py-2.5 px-3 text-xs font-medium border transition-colors whitespace-nowrap truncate ${
                        config.aspectRatio === ratio
                          ? 'bg-ink text-white border-ink'
                          : 'bg-canvas text-ink border-line-strong hover:border-ink'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
            </div>

            {/* Prominent Generate Shoot Footer CTA */}
            <div className="pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-muted">
                <span className="font-medium text-ink">
                  Ready to compose:
                </span>{' '}
                {config.poses.length}{' '}
                {config.poses.length === 1 ? 'frame' : 'frames'}, one per selected angle · {config.shootStyle} ·{' '}
                {config.aspectRatio}
              </div>

              <button
                type="button"
                onClick={onGenerateShoot}
                className="flex items-center justify-center gap-2.5 px-8 py-3.5 text-sm font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                Generate Shoot ({config.poses.length}{' '}
                {config.poses.length === 1 ? 'Frame' : 'Frames'})
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
