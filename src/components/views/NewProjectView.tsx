import React, { useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  Crop,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Square,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { CataloguePagePlate, CatalogueProduct } from '../../types/studio';
import { FashionImage } from '../common/FashionImage';

interface NewProjectViewProps {
  detectedProducts: CatalogueProduct[];
  cataloguePages: CataloguePagePlate[];
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onUploadCatalogue: (
    sourceType: 'Catalogue PDF' | 'Garment Images',
    files?: File[],
    fallbackFileNames?: string[]
  ) => Promise<void>;
  onManualExtractProduct: (payload: {
    name: string;
    sku: string;
    category: string;
    fabricDetails: string;
    sourcePage: number;
    croppedDataUrl: string;
  }) => Promise<void>;
  onToggleProductSelection: (productId: string) => void;
  onSelectAllProducts: (selected: boolean) => void;
  onGenerateContentForProduct: (product: CatalogueProduct) => void;
}

export const NewProjectView: React.FC<NewProjectViewProps> = ({
  detectedProducts,
  cataloguePages,
  projectName,
  onProjectNameChange,
  onUploadCatalogue,
  onManualExtractProduct,
  onToggleProductSelection,
  onSelectAllProducts,
  onGenerateContentForProduct,
}) => {
  const [uploadMode, setUploadMode] = useState<'Catalogue PDF' | 'Garment Images'>(
    'Catalogue PDF'
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStageText, setUploadStageText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    'AtelierNoor_Festive26_Lookbook_Sheet.pdf'
  );

  // Manual Crop / Page Fallback State (Phase 2B)
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const [cropBox, setCropBox] = useState({ x: 8, y: 6, width: 84, height: 86 });
  const [manualName, setManualName] = useState('Zardozi Raw Silk Ensemble (Cropped)');
  const [manualSku, setManualSku] = useState('AN-26-042');
  const [manualCategory, setManualCategory] = useState('Luxury Pret · 2-Piece');
  const [manualFabric, setManualFabric] = useState(
    'Pure Raw Silk · Hand-Cropped from Catalogue Page'
  );
  const [isExtractingManual, setIsExtractingManual] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExecuteUpload = async (
    mode: 'Catalogue PDF' | 'Garment Images',
    files?: File[],
    fallbackNames?: string[]
  ) => {
    setUploadMode(mode);
    setUploadError(null);
    const displayNames =
      files && files.length > 0
        ? files.map((f) => f.name).join(', ')
        : (fallbackNames || ['Catalogue_Upload.pdf']).join(', ');

    setUploadedFileName(displayNames);
    setIsUploading(true);
    setUploadStageText(
      mode === 'Catalogue PDF'
        ? 'Uploading PDF to server & detecting individual garment plates...'
        : 'Uploading garment images & creating product records...'
    );

    try {
      await onUploadCatalogue(mode, files, fallbackNames);
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : 'Failed to upload catalogue.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    handleExecuteUpload(uploadMode, filesArray);
    e.target.value = '';
  };

  const activePage =
    cataloguePages[selectedPageIdx] ||
    cataloguePages[0] || {
      pageNumber: 1,
      imageUrl: detectedProducts[0]?.garmentImageUrl || '',
      label: 'Catalogue Page 01',
    };

  const handleCreateManualCropProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePage.imageUrl) return;
    setIsExtractingManual(true);
    setUploadError(null);

    try {
      // Crop the selected region on an offscreen canvas so the server receives the exact cropped garment image
      const croppedDataUrl = await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const sx = Math.round((cropBox.x / 100) * img.naturalWidth);
          const sy = Math.round((cropBox.y / 100) * img.naturalHeight);
          const sw = Math.max(
            64,
            Math.round((cropBox.width / 100) * img.naturalWidth)
          );
          const sh = Math.max(
            64,
            Math.round((cropBox.height / 100) * img.naturalHeight)
          );
          canvas.width = sw;
          canvas.height = sh;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
          } else {
            resolve(activePage.imageUrl);
          }
        };
        img.onerror = () => resolve(activePage.imageUrl);
        img.src = activePage.imageUrl;
      });

      await onManualExtractProduct({
        name: manualName,
        sku: manualSku,
        category: manualCategory,
        fabricDetails: manualFabric,
        sourcePage: activePage.pageNumber,
        croppedDataUrl,
      });

      setShowManualFallback(false);
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : 'Manual crop extraction failed.'
      );
    } finally {
      setIsExtractingManual(false);
    }
  };

  const selectedProducts = detectedProducts.filter((p) => p.selected);

  return (
    <div className="space-y-10 pb-12">
      {/* Header */}
      <div className="border-b border-[#E6E4DD] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#6E6B62] mb-1.5">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <span>New Project & Garment Extraction</span>
          </div>
          <h1 className="font-editorial text-3xl md:text-4xl font-semibold text-[#141413]">
            Ingest Catalogue or Garment Pieces
          </h1>
          <p className="mt-1.5 text-sm text-[#57554E] max-w-2xl">
            Upload a seasonal line-sheet PDF or individual clothing flat-lays. Studio automatically isolates each garment so you can art-direct model shoots piece by piece.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowManualFallback((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#141413] bg-white border border-[#D6D3C9] hover:border-[#141413] transition-colors whitespace-nowrap"
          >
            <Crop className="w-3.5 h-3.5" />
            {showManualFallback
              ? 'Hide Manual Page Crop'
              : 'Manual Page Crop Fallback'}
          </button>

          {selectedProducts.length > 0 && (
            <button
              type="button"
              onClick={() => onGenerateContentForProduct(selectedProducts[0])}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Configure Shoot for Selected ({selectedProducts.length})
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="bg-[#FEF2F2] border border-[#DC2626] p-4 flex items-center gap-3 text-xs text-[#991B1B]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Project Name + Source Mode Selector */}
      <div className="bg-white border border-[#E2DFD7] p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          <div className="md:col-span-7">
            <label
              htmlFor="project-title-input"
              className="block text-xs font-medium text-[#141413] mb-2"
            >
              Project / Collection Title
            </label>
            <input
              id="project-title-input"
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="e.g., Winter Festive '26 — Velvet & Zardozi Edit"
              className="w-full bg-[#FAF9F5] border border-[#D6D3C9] px-4 py-2.5 text-sm text-[#141413] focus:outline-none focus:border-[#141413]"
            />
          </div>

          <div className="md:col-span-5">
            <span className="block text-xs font-medium text-[#141413] mb-2">
              Ingestion Source Format
            </span>
            <div className="grid grid-cols-2 bg-[#F2F0E8] p-1 border border-[#E2DFD7]">
              <button
                type="button"
                onClick={() => setUploadMode('Catalogue PDF')}
                className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  uploadMode === 'Catalogue PDF'
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#6E6B62] hover:text-[#141413]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Catalogue PDF
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('Garment Images')}
                className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  uploadMode === 'Garment Images'
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#6E6B62] hover:text-[#141413]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Individual Garments
              </button>
            </div>
          </div>
        </div>

        {/* Upload Dropzone / Indeterminate Real Backend State */}
        <input
          ref={fileInputRef}
          type="file"
          accept={
            uploadMode === 'Catalogue PDF'
              ? '.pdf,application/pdf,image/jpeg,image/png,image/webp'
              : 'image/jpeg,image/png,image/webp'
          }
          multiple={uploadMode === 'Garment Images'}
          onChange={handleFileChange}
          className="hidden"
        />

        {isUploading ? (
          <div className="border border-[#141413] bg-[#FAF9F5] p-8 text-center space-y-4">
            <div className="w-10 h-10 mx-auto border border-[#141413] bg-white flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-[#141413] animate-spin" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#6E6B62]">
                <span>EXTRACTING GARMENTS FROM {uploadMode.toUpperCase()}</span>
              </div>
              <p className="font-editorial text-2xl font-semibold text-[#141413] mt-1">
                {uploadStageText}
              </p>
            </div>
            <div className="max-w-md mx-auto h-1.5 bg-[#E6E4DD] overflow-hidden relative">
              <div className="h-full w-1/2 bg-[#141413] animate-pulse mx-auto" />
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-[#C7C3B8] bg-[#FAF9F5] p-8 text-center transition-colors hover:border-[#141413]">
            <div className="w-11 h-11 mx-auto bg-white border border-[#E2DFD7] flex items-center justify-center text-[#141413] mb-3">
              {uploadMode === 'Catalogue PDF' ? (
                <FileText className="w-5 h-5" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </div>
            <h2 className="font-editorial text-2xl font-semibold text-[#141413]">
              {uploadMode === 'Catalogue PDF'
                ? 'Drop your seasonal line-sheet or lookbook PDF'
                : 'Drop flat-lay, ghost-mannequin, or hanger garment photos'}
            </h2>
            <p className="mt-1 text-xs text-[#6E6B62] max-w-lg mx-auto">
              {uploadMode === 'Catalogue PDF'
                ? 'Supports multi-page catalogue PDFs up to 25MB. Extracts embedded garment plates, detects multi-garment spreads, and reads SKU codes.'
                : 'Supports high-resolution PNG, JPG, and WEBP garment files up to 25MB each.'}
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap"
              >
                Upload {uploadMode === 'Catalogue PDF' ? 'PDF File' : 'Garment Images'} from Device
              </button>
              <button
                type="button"
                onClick={() =>
                  handleExecuteUpload(
                    uploadMode,
                    undefined,
                    uploadMode === 'Catalogue PDF'
                      ? ['AtelierNoor_Festive26_Catalogue_Master.pdf']
                      : ['AN-26-031_Emerald_Flatlay.jpg', 'AN-26-034_Ivory_Organza.jpg']
                  )
                }
                className="px-4 py-2.5 text-xs font-medium text-[#141413] bg-white border border-[#D6D3C9] hover:border-[#141413] transition-colors whitespace-nowrap"
              >
                Run Extraction on Sample {uploadMode === 'Catalogue PDF' ? 'Catalogue PDF' : 'Garment Batch'}
              </button>
            </div>

            {uploadedFileName && (
              <div className="mt-4 inline-flex items-center gap-2 text-xs text-[#57554E] font-mono">
                <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Active source: {uploadedFileName}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase 2B: Manual Page Selection & Crop Fallback */}
      {showManualFallback && (
        <section className="bg-white border border-[#141413] p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6E4DD] pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#6E6B62]">
                <span>MANUAL CATALOGUE PAGE FALLBACK</span>
                <span aria-hidden="true">·</span>
                <span>PAGE {activePage.pageNumber}</span>
              </div>
              <h2 className="font-editorial text-2xl font-semibold text-[#141413] mt-0.5">
                Select & Crop Individual Garment from Catalogue Page
              </h2>
              <p className="text-xs text-[#57554E] mt-0.5">
                When a PDF spread contains multiple garments or unconventional layout framing, isolate a specific region below to create a dedicated Product record.
              </p>
            </div>

            {cataloguePages.length > 1 && (
              <div className="flex items-center gap-2">
                {cataloguePages.map((pg, idx) => (
                  <button
                    key={pg.pageNumber}
                    type="button"
                    onClick={() => setSelectedPageIdx(idx)}
                    className={`px-3 py-1.5 text-xs font-mono border transition-colors whitespace-nowrap ${
                      selectedPageIdx === idx
                        ? 'bg-[#141413] text-white border-[#141413]'
                        : 'bg-[#FAF9F5] text-[#141413] border-[#D6D3C9]'
                    }`}
                  >
                    Page 0{pg.pageNumber}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={handleCreateManualCropProduct}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
          >
            {/* Left: Interactive Crop Bounding Preview */}
            <div className="lg:col-span-5 space-y-3">
              <div className="relative border border-[#E2DFD7] bg-[#EFECE4] overflow-hidden aspect-[3/4]">
                <img
                  src={activePage.imageUrl}
                  alt={activePage.label}
                  className="w-full h-full object-cover"
                />
                {/* Highlighted Crop Region Box */}
                <div
                  className="absolute border-2 border-[#141413] bg-white/10 shadow-[0_0_0_9999px_rgba(20,20,19,0.42)] pointer-events-none transition-all duration-150"
                  style={{
                    left: `${cropBox.x}%`,
                    top: `${cropBox.y}%`,
                    width: `${cropBox.width}%`,
                    height: `${cropBox.height}%`,
                  }}
                >
                  <span className="absolute top-1.5 left-1.5 bg-[#141413] text-white px-2 py-0.5 text-[10px] font-mono">
                    {manualSku} Crop Region
                  </span>
                </div>
              </div>
              <p className="text-[11px] font-mono text-[#6E6B62]">
                {activePage.label} · Crop [{cropBox.x}%, {cropBox.y}%, {cropBox.width}% × {cropBox.height}%]
              </p>
            </div>

            {/* Right: Crop Presets, Sliders & Product Metadata */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <span className="block text-xs font-medium text-[#141413] mb-2">
                  Quick Spread Region Presets
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      label: 'Full Center Plate',
                      box: { x: 8, y: 6, width: 84, height: 86 },
                    },
                    {
                      label: 'Left Lookbook Column',
                      box: { x: 5, y: 8, width: 45, height: 84 },
                    },
                    {
                      label: 'Right Lookbook Column',
                      box: { x: 50, y: 8, width: 45, height: 84 },
                    },
                    {
                      label: 'Kurta / Upper Silhouette Focus',
                      box: { x: 12, y: 6, width: 76, height: 65 },
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setCropBox(preset.box)}
                      className="px-3 py-1.5 text-xs bg-[#FAF9F5] border border-[#D6D3C9] text-[#141413] hover:border-[#141413] transition-colors whitespace-nowrap"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fine-tune crop sliders */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF9F5] p-3.5 border border-[#E6E4DD]">
                <div>
                  <label className="block text-[11px] font-mono text-[#6E6B62]">
                    Left X ({cropBox.x}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={cropBox.x}
                    onChange={(e) =>
                      setCropBox({ ...cropBox, x: Number(e.target.value) })
                    }
                    className="w-full accent-[#141413] mt-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-[#6E6B62]">
                    Top Y ({cropBox.y}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={cropBox.y}
                    onChange={(e) =>
                      setCropBox({ ...cropBox, y: Number(e.target.value) })
                    }
                    className="w-full accent-[#141413] mt-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-[#6E6B62]">
                    Width ({cropBox.width}%)
                  </label>
                  <input
                    type="range"
                    min={25}
                    max={100 - cropBox.x}
                    value={cropBox.width}
                    onChange={(e) =>
                      setCropBox({ ...cropBox, width: Number(e.target.value) })
                    }
                    className="w-full accent-[#141413] mt-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-[#6E6B62]">
                    Height ({cropBox.height}%)
                  </label>
                  <input
                    type="range"
                    min={25}
                    max={100 - cropBox.y}
                    value={cropBox.height}
                    onChange={(e) =>
                      setCropBox({ ...cropBox, height: Number(e.target.value) })
                    }
                    className="w-full accent-[#141413] mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#141413] mb-1.5">
                    Garment Name
                  </label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full bg-[#FAF9F5] border border-[#D6D3C9] px-3 py-2 text-xs text-[#141413] focus:outline-none focus:border-[#141413]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#141413] mb-1.5">
                    SKU / Piece Number
                  </label>
                  <input
                    type="text"
                    value={manualSku}
                    onChange={(e) => setManualSku(e.target.value)}
                    className="w-full bg-[#FAF9F5] border border-[#D6D3C9] px-3 py-2 text-xs font-mono text-[#141413] focus:outline-none focus:border-[#141413]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#141413] mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full bg-[#FAF9F5] border border-[#D6D3C9] px-3 py-2 text-xs text-[#141413] focus:outline-none focus:border-[#141413]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#141413] mb-1.5">
                    Textile / Embroidery Note
                  </label>
                  <input
                    type="text"
                    value={manualFabric}
                    onChange={(e) => setManualFabric(e.target.value)}
                    className="w-full bg-[#FAF9F5] border border-[#D6D3C9] px-3 py-2 text-xs text-[#141413] focus:outline-none focus:border-[#141413]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E6E4DD] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowManualFallback(false)}
                  className="px-4 py-2 text-xs font-medium text-[#57554E] hover:text-[#141413]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExtractingManual}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {isExtractingManual ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Cropping Garment...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Extract Cropped Garment to Products
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Detected Products Grid */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E4DD] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-editorial text-2xl font-semibold text-[#141413]">
                Detected Catalogue Garments
              </h2>
              <span className="text-xs font-mono text-[#6E6B62] tabular-nums">
                ({detectedProducts.length} pieces isolated)
              </span>
            </div>
            <p className="text-xs text-[#6E6B62] mt-0.5">
              Select pieces to include in your campaign or launch the Product Workspace directly on any garment.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                onSelectAllProducts(selectedProducts.length < detectedProducts.length)
              }
              className="px-3.5 py-2 text-xs font-medium text-[#141413] bg-white border border-[#D6D3C9] hover:border-[#141413] transition-colors whitespace-nowrap"
            >
              {selectedProducts.length === detectedProducts.length
                ? 'Deselect All'
                : 'Select All Pieces'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {detectedProducts.map((product) => {
            const isSelected = product.selected;
            const pageNum = product.sourcePage || product.detectedPage || 1;
            return (
              <article
                key={product.id}
                className={`bg-white border transition-colors flex flex-col justify-between ${
                  isSelected ? 'border-[#141413]' : 'border-[#E2DFD7]'
                }`}
              >
                <div>
                  {/* Image container with selection toggle header */}
                  <div className="p-3 border-b border-[#E6E4DD] flex items-center justify-between bg-[#FAF9F5]">
                    <button
                      type="button"
                      onClick={() => onToggleProductSelection(product.id)}
                      className="flex items-center gap-2 text-xs font-medium text-[#141413] hover:opacity-80 transition-opacity whitespace-nowrap"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#141413]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#78756C]" />
                      )}
                      <span>{isSelected ? 'Selected for Shoot' : 'Not Selected'}</span>
                    </button>

                    <span className="text-xs font-mono text-[#6E6B62] tabular-nums">
                      {product.sku} · p.0{pageNum}
                    </span>
                  </div>

                  <div
                    onClick={() => onToggleProductSelection(product.id)}
                    className="cursor-pointer p-4 bg-white"
                  >
                    <FashionImage
                      src={product.garmentImageUrl}
                      alt={product.name}
                      aspectClass="aspect-[3/4]"
                      cropVariant="full"
                    />
                  </div>

                  <div className="px-5 pb-4">
                    <div className="flex items-center gap-1.5 text-xs text-[#6E6B62]">
                      <span>{product.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {product.generatedCount} shots
                      </span>
                    </div>
                    <h3 className="mt-1 font-editorial text-2xl font-semibold text-[#141413]">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-xs text-[#57554E] leading-relaxed">
                      {product.fabricDetails}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-3 border-t border-[#E6E4DD] flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleProductSelection(product.id)}
                    className="px-3 py-2 text-xs font-medium text-[#57554E] hover:text-[#141413] transition-colors whitespace-nowrap"
                  >
                    {isSelected ? 'Remove Selection' : 'Select Piece'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onGenerateContentForProduct(product)}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Content
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
