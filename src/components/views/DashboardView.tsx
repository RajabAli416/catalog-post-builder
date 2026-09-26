import React from 'react';
import {
  ArrowRight,
  Columns,
  FileSpreadsheet,
  FolderOpen,
  Instagram,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  CatalogueProduct,
  GeneratedShootImage,
  InstagramPostDraft,
  NavigationTab,
  StudioProject,
} from '../../types/studio';
import { FashionImage } from '../common/FashionImage';

interface DashboardViewProps {
  projects: StudioProject[];
  products: CatalogueProduct[];
  generatedImages: GeneratedShootImage[];
  postDrafts: InstagramPostDraft[];
  onNavigate: (tab: NavigationTab) => void;
  onSelectProductForStudio: (product: CatalogueProduct) => void;
  onOpenProject: (projectId: string) => void;
  onCompareImage: (image: GeneratedShootImage) => void;
  onOpenPostBuilderWithImage: (image: GeneratedShootImage) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  products,
  generatedImages,
  postDrafts,
  onNavigate,
  onSelectProductForStudio,
  onOpenProject,
  onCompareImage,
  onOpenPostBuilderWithImage,
}) => {
  const recentImages = generatedImages.slice(0, 4);

  return (
    <div className="space-y-12 pb-12">
      {/* Studio Hero Header & Quick Action */}
      <section className="border-b border-[#E6E4DD] pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-[#6E6B62] mb-2">
            <span>Editorial Campaign Studio</span>
            <span aria-hidden="true">·</span>
            <span>Autumn / Festive Season</span>
          </div>
          <h1 className="font-editorial text-3xl md:text-4xl font-semibold text-[#141413] tracking-tight">
            Transform flat catalogue garments into editorial lookbooks.
          </h1>
          <p className="mt-2.5 text-sm md:text-[15px] text-[#57554E] leading-relaxed">
            Upload seasonal line sheets or garment flat-lays, configure South Asian editorial models and architectural lighting, and sequence 4:5 Instagram carousels with original campaign copy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {products[0] && (
            <button
              type="button"
              onClick={() => onSelectProductForStudio(products[0])}
              className="px-4 py-2.5 text-xs font-medium text-[#141413] bg-white border border-[#D6D3C9] hover:border-[#141413] transition-colors whitespace-nowrap"
            >
              Resume Active Garment ({products[0].sku})
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('new-project')}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        </div>
      </section>

      {/* Restrained Studio Metrics Strip (Tabular Numerals, Single-Elevation) */}
      <section aria-label="Studio overview counts" className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-[#E2DFD7] divide-y lg:divide-y-0 lg:divide-x divide-[#E6E4DD]">
        <div className="p-6">
          <span className="text-xs text-[#6E6B62]">Catalogue Products</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-editorial text-3xl font-semibold text-[#141413] tabular-nums">
              {products.length}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="text-xs text-[#57554E] hover:text-[#141413] underline underline-offset-4 whitespace-nowrap"
            >
              View catalogue
            </button>
          </div>
          <p className="mt-1 text-xs text-[#78756C]">
            Extracted from PDFs & flat-lays
          </p>
        </div>

        <div className="p-6">
          <span className="text-xs text-[#6E6B62]">Active Lookbook Projects</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-editorial text-3xl font-semibold text-[#141413] tabular-nums">
              {projects.length}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs text-[#57554E] hover:text-[#141413] underline underline-offset-4 whitespace-nowrap"
            >
              All projects
            </button>
          </div>
          <p className="mt-1 text-xs text-[#78756C]">
            Seasonal collections in production
          </p>
        </div>

        <div className="p-6">
          <span className="text-xs text-[#6E6B62]">Generated Editorial Plates</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-editorial text-3xl font-semibold text-[#141413] tabular-nums">
              {generatedImages.length}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('shoot-gallery')}
              className="text-xs text-[#57554E] hover:text-[#141413] underline underline-offset-4 whitespace-nowrap"
            >
              Open gallery
            </button>
          </div>
          <p className="mt-1 text-xs text-[#78756C]">
            4:5 portrait & studio frames
          </p>
        </div>

        <div className="p-6">
          <span className="text-xs text-[#6E6B62]">Instagram Post Drafts</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-editorial text-3xl font-semibold text-[#141413] tabular-nums">
              {postDrafts.length}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('posts')}
              className="text-xs text-[#57554E] hover:text-[#141413] underline underline-offset-4 whitespace-nowrap"
            >
              Manage drafts
            </button>
          </div>
          <p className="mt-1 text-xs text-[#78756C]">
            Carousels with original copy
          </p>
        </div>
      </section>

      {/* Recent Generated Images Showcase */}
      <section className="space-y-5">
        <div className="flex items-end justify-between border-b border-[#E6E4DD] pb-3">
          <div>
            <h2 className="font-editorial text-2xl font-semibold text-[#141413]">
              Recent Editorial Output
            </h2>
            <p className="text-xs text-[#6E6B62] mt-0.5">
              Latest AI-photographed lookbook frames across active garment lines
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('shoot-gallery')}
            className="flex items-center gap-1.5 text-xs font-medium text-[#141413] hover:underline underline-offset-4 whitespace-nowrap"
          >
            View Shoot Gallery
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {recentImages.map((img) => (
            <article
              key={img.id}
              className="group bg-white border border-[#E2DFD7] flex flex-col justify-between transition-colors hover:border-[#141413]"
            >
              <div>
                <div className="relative overflow-hidden">
                  <FashionImage
                    src={img.imageUrl}
                    alt={`${img.productName} — ${img.shotType}`}
                    aspectClass="aspect-[4/5]"
                    cropVariant={img.cropVariant}
                    className="group-hover:scale-[1.03]"
                  />
                  {/* Hover quick actions */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onCompareImage(img)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-white/95 text-[#141413] text-xs font-medium hover:bg-white transition-colors whitespace-nowrap"
                      >
                        <Columns className="w-3.5 h-3.5" />
                        Compare
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenPostBuilderWithImage(img)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-[#141413] text-white text-xs font-medium hover:bg-[#2C2C2A] transition-colors whitespace-nowrap"
                      >
                        <Instagram className="w-3.5 h-3.5" />
                        Build Post
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {/* Unboxed metadata with typographic separators */}
                  <div className="flex items-center gap-1.5 text-[11px] text-[#6E6B62] truncate">
                    <span className="font-mono">{img.productSku}</span>
                    <span aria-hidden="true">·</span>
                    <span>{img.shotType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{img.style}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-medium text-[#141413] truncate">
                    {img.productName}
                  </h3>
                  <p className="mt-1 text-xs text-[#78756C] truncate">
                    {img.modelSummary}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Split Lower Section: Recent Projects & Catalogue Garments Ready for Shoot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 7 cols: Recent Projects */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-end justify-between border-b border-[#E6E4DD] pb-3">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-[#141413]">
                Recent Catalogue Projects
              </h2>
              <p className="text-xs text-[#6E6B62] mt-0.5">
                Uploaded line sheets and garment batches
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs font-medium text-[#141413] hover:underline underline-offset-4 whitespace-nowrap"
            >
              All Projects
            </button>
          </div>

          <div className="bg-white border border-[#E2DFD7] divide-y divide-[#E6E4DD]">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF9F5] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-16 shrink-0 border border-[#E2DFD7] overflow-hidden">
                    <FashionImage
                      src={project.coverImageUrl}
                      alt={project.name}
                      aspectClass="w-full h-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#6E6B62]">
                      <span className="font-mono">{project.seasonCode}</span>
                      <span aria-hidden="true">·</span>
                      <span>{project.sourceType}</span>
                      <span aria-hidden="true">·</span>
                      <span>Updated {project.updatedAt}</span>
                    </div>
                    <h3 className="text-base font-medium text-[#141413] mt-0.5">
                      {project.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#78756C] tabular-nums">
                      <span>{project.productIds.length} detected garments</span>
                      <span aria-hidden="true">·</span>
                      <span>{project.shootIds.length} editorial shoots</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[11px] truncate max-w-[200px]">
                        {project.sourceFileName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="px-3.5 py-2 text-xs font-medium text-[#141413] bg-white border border-[#D6D3C9] hover:border-[#141413] transition-colors whitespace-nowrap"
                  >
                    Open Project
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right 5 cols: Garment Queue for Immediate Shoot */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-end justify-between border-b border-[#E6E4DD] pb-3">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-[#141413]">
                Catalogue Garments
              </h2>
              <p className="text-xs text-[#6E6B62] mt-0.5">
                Select a piece to configure a new editorial shoot
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('new-project')}
              className="text-xs font-medium text-[#141413] hover:underline underline-offset-4 whitespace-nowrap"
            >
              + Upload More
            </button>
          </div>

          <div className="bg-white border border-[#E2DFD7] divide-y divide-[#E6E4DD]">
            {products.slice(0, 3).map((product) => (
              <div
                key={product.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-[#FAF9F5] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-15 shrink-0 border border-[#E2DFD7] overflow-hidden">
                    <FashionImage
                      src={product.garmentImageUrl}
                      alt={product.name}
                      aspectClass="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#6E6B62]">
                      <span className="font-mono">{product.sku}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{product.category}</span>
                    </div>
                    <h4 className="text-sm font-medium text-[#141413] truncate mt-0.5">
                      {product.name}
                    </h4>
                    <p className="text-xs text-[#78756C] tabular-nums mt-0.5">
                      {product.generatedCount} editorial frames generated
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectProductForStudio(product)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3 h-3" />
                  Studio
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
