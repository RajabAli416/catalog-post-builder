import React, { useState } from 'react';
import {
  ArrowUpDown,
  Instagram,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CatalogueProduct,
  GeneratedShootImage,
  InstagramPostDraft,
  StudioProject,
  StudioShoot,
} from '../../types/studio';
import { FashionImage } from '../common/FashionImage';
import { CopyButton } from '../common/CopyButton';

interface LibraryViewProps {
  activeSubTab: 'projects' | 'products' | 'shoots' | 'posts';
  projects: StudioProject[];
  products: CatalogueProduct[];
  shoots: StudioShoot[];
  generatedImages: GeneratedShootImage[];
  postDrafts: InstagramPostDraft[];
  onSwitchSubTab: (tab: 'projects' | 'products' | 'shoots' | 'posts') => void;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
  onSelectProductForStudio: (product: CatalogueProduct) => void;
  onOpenShootInGallery: (shoot: StudioShoot) => void;
  onOpenPostBuilder: () => void;
  onDeletePostDraft: (draftId: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  activeSubTab,
  projects,
  products,
  shoots,
  generatedImages,
  postDrafts,
  onSwitchSubTab,
  onCreateProject,
  onOpenProject,
  onSelectProductForStudio,
  onOpenShootInGallery,
  onOpenPostBuilder,
  onDeletePostDraft,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alpha'>('recent');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const q = searchQuery.trim().toLowerCase();

  // Filtered & sorted lists
  const filteredProjects = projects
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.seasonCode.toLowerCase().includes(q) ||
        p.sourceFileName.toLowerCase().includes(q)
    )
    .sort((a, b) =>
      sortBy === 'alpha'
        ? a.name.localeCompare(b.name)
        : b.createdAt.localeCompare(a.createdAt)
    );

  const filteredProducts = products
    .filter(
      (p) =>
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.fabricDetails.toLowerCase().includes(q)) &&
        (categoryFilter === 'ALL' || p.category.includes(categoryFilter))
    )
    .sort((a, b) =>
      sortBy === 'alpha'
        ? a.name.localeCompare(b.name)
        : b.createdAt.localeCompare(a.createdAt)
    );

  const filteredShoots = shoots
    .filter(
      (s) =>
        !q ||
        s.productName.toLowerCase().includes(q) ||
        s.productSku.toLowerCase().includes(q) ||
        s.config.shootStyle.toLowerCase().includes(q)
    )
    .sort((a, b) =>
      sortBy === 'alpha'
        ? a.productName.localeCompare(b.productName)
        : b.createdAt.localeCompare(a.createdAt)
    );

  const filteredDrafts = postDrafts
    .filter(
      (d) =>
        !q ||
        d.productTitle.toLowerCase().includes(q) ||
        d.caption.toLowerCase().includes(q) ||
        d.hashtags.some((h) => h.toLowerCase().includes(q))
    )
    .sort((a, b) =>
      sortBy === 'alpha'
        ? a.productTitle.localeCompare(b.productTitle)
        : b.id.localeCompare(a.id)
    );

  const findImageById = (id: string) =>
    generatedImages.find((img) => img.id === id) || generatedImages[0];

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="border-b border-line pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <span>Studio Archive</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{activeSubTab}</span>
          </div>
          <h1 className="font-editorial text-3xl md:text-4xl font-semibold text-ink">
            Project & Asset Library
          </h1>
          <p className="mt-1 text-sm text-muted">
            Browse seasonal catalogue projects, extracted garment pieces, completed editorial shoots, and saved Instagram carousel drafts.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateProject}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap self-start md:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          New Project
        </button>
      </div>

      {/* Sub-navigation Tabs + Search + Sort Bar */}
      <div className="bg-white border border-line p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* 4 Library Section Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-wash p-1 border border-line">
          {(
            [
              { id: 'projects', label: `Projects (${projects.length})` },
              { id: 'products', label: `Products (${products.length})` },
              { id: 'shoots', label: `Generated Shoots (${shoots.length})` },
              { id: 'posts', label: `Draft Posts (${postDrafts.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSwitchSubTab(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                activeSubTab === tab.id
                  ? 'bg-white text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search, Filter & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeSubTab}...`}
              className="w-full bg-canvas border border-line-strong pl-8 pr-3 py-1.5 text-xs text-ink focus:outline-none focus:border-ink"
            />
          </div>

          {activeSubTab === 'products' && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by garment category"
              className="bg-canvas border border-line-strong px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-ink"
            >
              <option value="ALL">All Categories</option>
              <option value="Luxury Pret">Luxury Pret</option>
              <option value="Formal Edit">Formal Edit</option>
              <option value="Festive Resort">Festive Resort</option>
            </select>
          )}

          <button
            type="button"
            onClick={() =>
              setSortBy((prev) => (prev === 'recent' ? 'alpha' : 'recent'))
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink bg-canvas border border-line-strong hover:border-ink transition-colors whitespace-nowrap"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort: {sortBy === 'recent' ? 'Newest First' : 'Alphabetical'}
          </button>
        </div>
      </div>

      {activeSubTab === 'projects' && filteredProjects.length === 0 && (
        <div className="bg-white border border-line p-6 text-sm text-muted">
          No projects yet. Create a project, then upload a PDF or garment photos.
        </div>
      )}

      {/* TAB 1: PROJECTS */}
      {activeSubTab === 'projects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((proj) => (
            <article
              key={proj.id}
              className="bg-white border border-line p-6 flex flex-col sm:flex-row gap-6 justify-between hover:border-ink transition-colors"
            >
              <div className="flex gap-5">
                <div className="w-24 h-30 shrink-0 border border-line overflow-hidden">
                  <FashionImage
                    src={proj.coverImageUrl}
                    alt={proj.name}
                    aspectClass="w-full h-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="font-mono">{proj.seasonCode}</span>
                    <span aria-hidden="true">·</span>
                    <span>{proj.sourceFileName ? proj.sourceType : 'No uploads yet'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{proj.createdAt}</span>
                  </div>
                  <h2 className="font-editorial text-2xl font-semibold text-ink">
                    {proj.name}
                  </h2>
                  {proj.sourceFileName && (
                    <p className="text-xs font-mono text-faint">
                      {proj.sourceFileName}
                    </p>
                  )}
                  <div className="pt-2 flex items-center gap-3 text-xs text-muted tabular-nums">
                    <span>{proj.productIds.length} products</span>
                    <span aria-hidden="true">·</span>
                    <span>{proj.shootIds.length} shoots</span>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenProject(proj.id)}
                  className="px-4 py-2 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap"
                >
                  Open Project
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* TAB 2: PRODUCTS */}
      {activeSubTab === 'products' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <article
              key={product.id}
              className="bg-white border border-line flex flex-col justify-between hover:border-ink transition-colors"
            >
              <div>
                <div className="px-4 py-3 border-b border-line bg-canvas flex items-center justify-between text-xs">
                  <span className="font-mono text-ink">{product.sku}</span>
                  <span className="text-muted">{product.category}</span>
                </div>
                <div className="p-4">
                  <FashionImage
                    src={product.garmentImageUrl}
                    alt={product.name}
                    aspectClass="aspect-[3/4]"
                  />
                </div>
                <div className="px-5 pb-4">
                  <h2 className="font-editorial text-2xl font-semibold text-ink">
                    {product.name}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {product.fabricDetails}
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-line bg-canvas flex items-center justify-between">
                <span className="text-xs text-muted tabular-nums">
                  {product.generatedCount} generated plates
                </span>
                <button
                  type="button"
                  onClick={() => onSelectProductForStudio(product)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Open Workspace
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* TAB 3: GENERATED SHOOTS */}
      {activeSubTab === 'shoots' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredShoots.map((shoot) => {
            const leadImg = shoot.images[0];
            return (
              <article
                key={shoot.id}
                className="bg-white border border-line flex flex-col justify-between hover:border-ink transition-colors"
              >
                <div>
                  <div className="px-4 py-3 border-b border-line bg-canvas flex items-center justify-between text-xs text-muted">
                    <span className="font-mono">{shoot.productSku}</span>
                    <span>{shoot.config.shootStyle}</span>
                  </div>
                  <div className="p-4">
                    <FashionImage
                      src={leadImg?.imageUrl || shoot.garmentImageUrl}
                      alt={shoot.productName}
                      aspectClass="aspect-[4/5]"
                      cropVariant={leadImg?.cropVariant}
                    />
                  </div>
                  <div className="px-5 pb-4">
                    <h2 className="font-editorial text-2xl font-semibold text-ink">
                      {shoot.productName}
                    </h2>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted tabular-nums">
                      <span>{shoot.images.length} frames</span>
                      <span aria-hidden="true">·</span>
                      <span>{shoot.config.background}</span>
                      <span aria-hidden="true">·</span>
                      <span>{shoot.createdAt}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-line bg-canvas flex items-center justify-between">
                  <span className="text-xs font-mono text-muted">
                    {shoot.config.aspectRatio}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenShootInGallery(shoot)}
                    className="px-4 py-2 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap"
                  >
                    Inspect Gallery
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* TAB 4: DRAFT INSTAGRAM POSTS */}
      {activeSubTab === 'posts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredDrafts.map((draft) => {
            const coverImg = findImageById(draft.coverImageId);
            return (
              <article
                key={draft.id}
                className="bg-white border border-line p-5 flex flex-col sm:flex-row gap-5 justify-between hover:border-ink transition-colors"
              >
                <div className="flex gap-4">
                  <div className="w-28 h-35 shrink-0 border border-line overflow-hidden">
                    {coverImg && (
                      <FashionImage
                        src={coverImg.imageUrl}
                        alt={draft.productTitle}
                        aspectClass="w-full h-full"
                        cropVariant={coverImg.cropVariant}
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span>{draft.status}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {draft.carouselImageIds.length} slides
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{draft.updatedAt}</span>
                    </div>
                    <h2 className="font-editorial text-2xl font-semibold text-ink">
                      {draft.productTitle}
                    </h2>
                    <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                      {draft.caption}
                    </p>
                    <p className="text-[11px] font-mono text-faint truncate max-w-xs">
                      {draft.hashtags.slice(0, 4).join(' ')}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <CopyButton text={draft.caption} label="Copy caption" />
                      <CopyButton text={draft.hashtags.join(' ')} label="Copy hashtags" />
                      <CopyButton
                        text={[
                          draft.productTitle,
                          draft.shortDescription,
                          draft.caption,
                          draft.cta,
                          draft.hashtags.join(' '),
                        ]
                          .filter((part) => part.trim())
                          .join('\n\n')}
                        label="Copy post"
                      />
                    </div>
                    {draft.copyPromptUsed && (
                      <div className="rounded-xl border border-line bg-canvas p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-ink">Prompt used</p>
                          <CopyButton text={draft.copyPromptUsed} label="Copy prompt" />
                        </div>
                        <p className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
                          {draft.copyPromptUsed}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col justify-between items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDeletePostDraft(draft.id)}
                    aria-label="Delete post draft"
                    className="p-2 text-faint hover:text-[#991B1B] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPostBuilder}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-on-accent bg-accent hover:bg-accent-hover transition-colors whitespace-nowrap"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                    Edit in Post Builder
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
