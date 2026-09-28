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
  onCreateProject: () => void;
  onUploadMore: () => void;
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
  onCreateProject,
  onUploadMore,
  onSelectProductForStudio,
  onOpenProject,
  onCompareImage,
  onOpenPostBuilderWithImage,
}) => {
  const recentImages = generatedImages.slice(0, 4);

  return (
    <div className="space-y-12 pb-12">
      {/* Studio Hero Header & Quick Action */}
      <section className="border-b border-line pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            <span>Editorial Campaign Studio</span>
            <span aria-hidden="true">·</span>
            <span>Autumn / Festive Season</span>
          </div>
          <h1 className="font-editorial text-3xl md:text-4xl font-semibold text-ink tracking-tight">
            Transform flat catalogue garments into editorial lookbooks.
          </h1>
          <p className="mt-2.5 text-sm md:text-[15px] text-muted leading-relaxed">
            Create a project, upload a catalogue or garment photos, then turn them into a shoot and a post.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {products[0] && (
            <button
              type="button"
              onClick={() => onSelectProductForStudio(products[0])}
              className="px-4 py-2.5 text-xs font-medium text-ink bg-white border border-line-strong hover:border-ink transition-colors whitespace-nowrap"
            >
              Resume Active Garment ({products[0].sku})
            </button>
          )}
          <button
            type="button"
            onClick={onCreateProject}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        </div>
      </section>

      {/* Restrained Studio Metrics Strip (Tabular Numerals, Single-Elevation) */}
      <section aria-label="Studio overview counts" className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-line divide-y lg:divide-y-0 lg:divide-x divide-line">
        <div className="p-6">
          <span className="text-xs text-muted">Catalogue Products</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-editorial text-3xl font-semibold text-ink tabular-nums">
              {products.length}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="text-xs text-muted hover:text-ink underline underline-offset-4 whitespace-nowrap"
            >
              View catalogue
            </button>
          </div>
          <p className="mt-1 text-xs text-faint">
            Extracted from PDFs & flat-lays
          </p>
        </div>

        <div className="p-6">
          <span className="text-xs text-muted">Active Lookbook Projects</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-editorial text-3xl font-semibold text-ink tabular-nums">
              {projects.length}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs text-muted hover:text-ink underline underline-offset-4 whitespace-nowrap"
            >
              All projects
            </button>
          </div>
          <p className="mt-1 text-xs text-faint">
            Seasonal collections in production
          </p>
        </div>

        <div className="p-6">
          <span className="text-xs text-muted">Generated Editorial Plates</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-editorial text-3xl font-semibold text-ink tabular-nums">
              {generatedImages.length}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('shoot-gallery')}
              className="text-xs text-muted hover:text-ink underline underline-offset-4 whitespace-nowrap"
            >
              Open gallery
            </button>
          </div>
          <p className="mt-1 text-xs text-faint">
            4:5 portrait & studio frames
          </p>
        </div>

        <div className="p-6">
          <span className="text-xs text-muted">Instagram Post Drafts</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-editorial text-3xl font-semibold text-ink tabular-nums">
              {postDrafts.length}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('posts')}
              className="text-xs text-muted hover:text-ink underline underline-offset-4 whitespace-nowrap"
            >
              Manage drafts
            </button>
          </div>
          <p className="mt-1 text-xs text-faint">
            Carousels with original copy
          </p>
        </div>
      </section>

      {/* Recent Generated Images Showcase */}
      <section className="space-y-5">
        <div className="flex items-end justify-between border-b border-line pb-3">
          <div>
            <h2 className="font-editorial text-2xl font-semibold text-ink">
              Recent Editorial Output
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Latest AI-photographed lookbook frames across active garment lines
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('shoot-gallery')}
            className="flex items-center gap-1.5 text-xs font-medium text-ink hover:underline underline-offset-4 whitespace-nowrap"
          >
            View Shoot Gallery
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {recentImages.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-4 border border-line bg-white p-8">
              <h3 className="font-editorial text-2xl font-semibold text-ink">
                No editorial frames yet
              </h3>
              <p className="mt-2 text-sm text-muted">
                Upload a catalogue or garment photo to generate a real shoot.
              </p>
            </div>
          )}
          {recentImages.map((img) => (
            <article
              key={img.id}
              className="group bg-white border border-line flex flex-col justify-between transition-colors hover:border-ink"
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
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-white/95 text-ink text-xs font-medium hover:bg-white transition-colors whitespace-nowrap"
                      >
                        <Columns className="w-3.5 h-3.5" />
                        Compare
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenPostBuilderWithImage(img)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-accent text-on-accent text-xs font-medium hover:bg-accent-hover transition-colors whitespace-nowrap"
                      >
                        <Instagram className="w-3.5 h-3.5" />
                        Build Post
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {/* Unboxed metadata with typographic separators */}
                  <div className="flex items-center gap-1.5 text-[11px] text-muted truncate">
                    <span className="font-mono">{img.productSku}</span>
                    <span aria-hidden="true">·</span>
                    <span>{img.shotType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{img.style}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-medium text-ink truncate">
                    {img.productName}
                  </h3>
                  <p className="mt-1 text-xs text-faint truncate">
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
          <div className="flex items-end justify-between border-b border-line pb-3">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-ink">
                Recent Catalogue Projects
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Uploaded line sheets and garment batches
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs font-medium text-ink hover:underline underline-offset-4 whitespace-nowrap"
            >
              All Projects
            </button>
          </div>

          <div className="bg-white border border-line divide-y divide-line">
            {projects.length === 0 && (
              <div className="p-6 text-sm text-muted">
                No projects yet. Create a project, then upload a PDF or garment photos.
              </div>
            )}
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-canvas transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-16 shrink-0 border border-line overflow-hidden">
                    <FashionImage
                      src={project.coverImageUrl}
                      alt={project.name}
                      aspectClass="w-full h-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="font-mono">{project.seasonCode}</span>
                      <span aria-hidden="true">·</span>
                      <span>{project.sourceFileName ? project.sourceType : 'No uploads yet'}</span>
                      <span aria-hidden="true">·</span>
                      <span>Updated {project.updatedAt}</span>
                    </div>
                    <h3 className="text-base font-medium text-ink mt-0.5">
                      {project.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-faint tabular-nums">
                      <span>{project.productIds.length} detected garments</span>
                      <span aria-hidden="true">·</span>
                      <span>{project.shootIds.length} editorial shoots</span>
                      {project.sourceFileName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[11px] truncate max-w-[200px]">
                            {project.sourceFileName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="px-3.5 py-2 text-xs font-medium text-ink bg-white border border-line-strong hover:border-ink transition-colors whitespace-nowrap"
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
          <div className="flex items-end justify-between border-b border-line pb-3">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-ink">
                Catalogue Garments
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Select a piece to configure a new editorial shoot
              </p>
            </div>
            <button
              type="button"
              onClick={onUploadMore}
              className="text-xs font-medium text-ink hover:underline underline-offset-4 whitespace-nowrap"
            >
              + Upload More
            </button>
          </div>

          <div className="bg-white border border-line divide-y divide-line">
            {products.length === 0 && (
              <div className="p-6 text-sm text-muted">
                No garments extracted yet.
              </div>
            )}
            {products.slice(0, 3).map((product) => (
              <div
                key={product.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-canvas transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-15 shrink-0 border border-line overflow-hidden">
                    <FashionImage
                      src={product.garmentImageUrl}
                      alt={product.name}
                      aspectClass="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      <span className="font-mono">{product.sku}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{product.category}</span>
                    </div>
                    <h4 className="text-sm font-medium text-ink truncate mt-0.5">
                      {product.name}
                    </h4>
                    <p className="text-xs text-faint tabular-nums mt-0.5">
                      {product.generatedCount} editorial frames generated
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectProductForStudio(product)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap shrink-0"
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
