/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  FolderKanban,
  Instagram,
  LayoutDashboard,
  Layers,
  Menu,
  Plus,
  Settings,
  Shirt,
  Sparkles,
  X,
} from 'lucide-react';

import {
  AIMode,
  CataloguePagePlate,
  CatalogueProduct,
  GeneratedShootImage,
  InstagramPostDraft,
  NavigationTab,
  ShootConfiguration,
  StudioProject,
  StudioRuntimeStatus,
  StudioShoot,
} from './types/studio';

import {
  DEFAULT_SHOOT_CONFIG,
  INITIAL_GENERATED_IMAGES,
  INITIAL_POST_DRAFTS,
  INITIAL_PRODUCTS,
  INITIAL_PROJECTS,
  INITIAL_SHOOTS,
} from './data/mockStudioData';

import {
  analyzeProductGarmentApi,
  createAndStartShootApi,
  deleteGeneratedImageApi,
  deleteInstagramPostApi,
  fetchBootstrapState,
  manualExtractProductFromPage,
  RegenerateImageOverrides,
  regenerateSingleImageApi,
  saveInstagramPostApi,
  setRuntimeAiMode,
  uploadCatalogueToServer,
} from './services/studioApi';

import { DashboardView } from './components/views/DashboardView';
import { NewProjectView } from './components/views/NewProjectView';
import { ProductWorkspaceView } from './components/views/ProductWorkspaceView';
import { GenerationStateView } from './components/views/GenerationStateView';
import { ShootGalleryView } from './components/views/ShootGalleryView';
import { InstagramPostBuilderView } from './components/views/InstagramPostBuilderView';
import { LibraryView } from './components/views/LibraryView';
import { SettingsView } from './components/views/SettingsView';
import { CompareModal } from './components/common/CompareModal';
import { ConfirmDialog } from './components/common/ConfirmDialog';

export default function App() {
  // Navigation & Responsive Sidebar State
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core Studio Data State (Hydrated from Backend Repository with Instant Seed)
  const [projects, setProjects] = useState<StudioProject[]>(INITIAL_PROJECTS);
  const [products, setProducts] = useState<CatalogueProduct[]>(INITIAL_PRODUCTS);
  const [shoots, setShoots] = useState<StudioShoot[]>(INITIAL_SHOOTS);
  const [generatedImages, setGeneratedImages] = useState<GeneratedShootImage[]>(
    INITIAL_GENERATED_IMAGES
  );
  const [postDrafts, setPostDrafts] = useState<InstagramPostDraft[]>(
    INITIAL_POST_DRAFTS
  );
  const [cataloguePages, setCataloguePages] = useState<CataloguePagePlate[]>(
    INITIAL_PROJECTS[0]?.pages || []
  );
  const [runtimeStatus, setRuntimeStatus] =
    useState<StudioRuntimeStatus | null>(null);

  // Active Workflow Context
  const [newProjectTitle, setNewProjectTitle] = useState(
    "Winter Festive '26 — Zardozi & Organza Edit"
  );
  const [activeProduct, setActiveProduct] = useState<CatalogueProduct>(
    INITIAL_PRODUCTS[0]
  );
  const [shootConfig, setShootConfig] =
    useState<ShootConfiguration>(DEFAULT_SHOOT_CONFIG);
  const [activeShoot, setActiveShoot] = useState<StudioShoot | null>(null);
  const [isAnalyzingGarment, setIsAnalyzingGarment] = useState(false);

  // Modals & Notifications
  const [modalImage, setModalImage] = useState<GeneratedShootImage | null>(null);
  const [modalMode, setModalMode] = useState<'compare' | 'prompt'>('compare');
  const [imageToDelete, setImageToDelete] =
    useState<GeneratedShootImage | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  // Hydrate persistent studio state from backend on mount
  useEffect(() => {
    let mounted = true;
    fetchBootstrapState()
      .then((data) => {
        if (!mounted) return;
        if (data.projects?.length) {
          setProjects(data.projects);
          if (data.projects[0]?.pages?.length) {
            setCataloguePages(data.projects[0].pages);
          }
        }
        if (data.products?.length) {
          setProducts(data.products);
          setActiveProduct((prev) => {
            const matched = data.products.find(
              (p: CatalogueProduct) => p.id === prev.id
            );
            return matched || data.products[0];
          });
        }
        if (data.shoots?.length) setShoots(data.shoots);
        if (data.generatedImages?.length)
          setGeneratedImages(data.generatedImages);
        if (data.postDrafts?.length) setPostDrafts(data.postDrafts);
        if (data.runtime) setRuntimeStatus(data.runtime);
      })
      .catch(() => {
        // Fallback to initial seed data if server is initializing
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Keep activeProduct synchronized when products array updates
  useEffect(() => {
    const updated = products.find((p) => p.id === activeProduct.id);
    if (updated && updated !== activeProduct) {
      setActiveProduct(updated);
    }
  }, [products, activeProduct]);

  // Navigation helper
  const navigateTo = (tab: NavigationTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1A. Catalogue / Garment Upload (Real files or Instant Sample)
  const handleUploadCatalogue = async (
    sourceType: 'Catalogue PDF' | 'Garment Images',
    files?: File[],
    fallbackFileNames?: string[]
  ) => {
    const projectId = `proj-${Date.now()}`;
    const result = await uploadCatalogueToServer({
      projectId,
      projectName: newProjectTitle || 'Untitled Seasonal Collection',
      sourceType,
      files,
      fallbackFileNames,
    });

    setProjects((prev) => [
      result.project,
      ...prev.filter((p) => p.id !== result.project.id),
    ]);
    setProducts((prev) => [...result.products, ...prev]);
    if (result.pages?.length) {
      setCataloguePages(result.pages);
    }
    if (result.products[0]) {
      setActiveProduct(result.products[0]);
    }

    const displayFile =
      files?.[0]?.name || fallbackFileNames?.[0] || sourceType;
    triggerToast(
      `Extracted ${result.products.length} garment pieces from ${displayFile}`
    );
  };

  // 1B. Manual Page Crop Fallback (Phase 2B)
  const handleManualExtractProduct = async (payload: {
    name: string;
    sku: string;
    category: string;
    fabricDetails: string;
    sourcePage: number;
    croppedDataUrl: string;
  }) => {
    const targetProjectId = projects[0]?.id || 'proj-autumn-festive';
    const createdProduct = await manualExtractProductFromPage(
      targetProjectId,
      payload
    );
    setProducts((prev) => [createdProduct, ...prev]);
    setActiveProduct(createdProduct);
    triggerToast(
      `Extracted custom garment crop "${createdProduct.name}" from Page ${payload.sourcePage}`
    );
  };

  // 2. Toggle Product Selection in New Project
  const handleToggleProductSelection = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleSelectAllProducts = (selected: boolean) => {
    setProducts((prev) => prev.map((p) => ({ ...p, selected })));
  };

  // 3. Open Product Workspace & Structured Garment Analysis (Phase 2C)
  const handleOpenProductStudio = (product: CatalogueProduct) => {
    setActiveProduct(product);
    navigateTo('workspace');
  };

  const handleAnalyzeGarment = async (productId: string) => {
    setIsAnalyzingGarment(true);
    try {
      const res = await analyzeProductGarmentApi(productId);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? res.product : p))
      );
      if (activeProduct.id === productId) {
        setActiveProduct(res.product);
      }
      triggerToast(`Garment vision analysis complete for ${res.product.sku}`);
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : 'Garment analysis failed'
      );
    } finally {
      setIsAnalyzingGarment(false);
    }
  };

  // 4. Trigger Shoot Generation -> Generation State Screen -> Results Gallery (Phase 2D, 2E, 2F)
  const handleStartGenerateShoot = async () => {
    try {
      const createdShoot = await createAndStartShootApi(
        activeProduct.id,
        shootConfig
      );
      setShoots((prev) => [createdShoot, ...prev]);
      setActiveShoot(createdShoot);
      navigateTo('generating');
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : 'Failed to start shoot generation'
      );
    }
  };

  const handleShootUpdated = (updatedShoot: StudioShoot) => {
    setActiveShoot(updatedShoot);
    setShoots((prev) =>
      prev.map((s) => (s.id === updatedShoot.id ? updatedShoot : s))
    );
  };

  const handleCompleteGeneration = async (completedShoot: StudioShoot) => {
    try {
      const refreshed = await fetchBootstrapState();
      setProjects(refreshed.projects);
      setProducts(refreshed.products);
      setShoots(refreshed.shoots);
      setGeneratedImages(refreshed.generatedImages);
      setActiveShoot(null);

      navigateTo('shoot-gallery');
      const frameCount =
        completedShoot.images?.length || shootConfig.numberOfImages;
      triggerToast(
        `Generated ${frameCount} editorial frames for ${activeProduct.sku}`
      );
    } catch {
      if (completedShoot.images?.length) {
        setGeneratedImages((prev) => [
          ...completedShoot.images,
          ...prev.map((img) => ({ ...img, selectedForPost: false })),
        ]);
      }
      setActiveShoot(null);
      navigateTo('shoot-gallery');
    }
  };

  const handleRetryInMockMode = async () => {
    try {
      const updatedRuntime = await setRuntimeAiMode('mock');
      setRuntimeStatus(updatedRuntime);
      const createdShoot = await createAndStartShootApi(
        activeProduct.id,
        shootConfig
      );
      setShoots((prev) => [createdShoot, ...prev]);
      setActiveShoot(createdShoot);
      triggerToast('Switched to Mock Mode and restarted shoot generation');
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : 'Failed to retry shoot'
      );
    }
  };

  // 5. Shoot Gallery Image Actions & Full Regeneration (Phase 2H)
  const handleToggleSelectImageForPost = (imageId: string) => {
    setGeneratedImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? { ...img, selectedForPost: !img.selectedForPost }
          : img
      )
    );
  };

  const handleSelectAllImagesForPost = (selected: boolean) => {
    setGeneratedImages((prev) =>
      prev.map((img) => ({ ...img, selectedForPost: selected }))
    );
  };

  const handleRegenerateSingleImage = async (
    imageId: string,
    overrides: RegenerateImageOverrides = {}
  ) => {
    setGeneratedImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? {
              ...img,
              status: 'Regenerating',
              promptNotes: overrides.promptNotes || img.promptNotes,
            }
          : img
      )
    );

    try {
      const updated = await regenerateSingleImageApi(imageId, overrides);
      setGeneratedImages((prev) =>
        prev.map((img) => (img.id === imageId ? updated : img))
      );
      if (modalImage?.id === imageId) {
        setModalImage(updated);
      }
      triggerToast(
        `Frame re-rendered (${updated.shotType} · ${updated.style})`
      );
    } catch (err) {
      setGeneratedImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, status: 'Ready' } : img
        )
      );
      triggerToast(
        err instanceof Error ? err.message : 'Regeneration request failed'
      );
    }
  };

  const handleSavePromptEdit = (
    imageId: string,
    overrides: RegenerateImageOverrides
  ) => {
    handleRegenerateSingleImage(imageId, overrides);
  };

  const handleConfirmDeleteImage = async () => {
    if (!imageToDelete) return;
    const targetId = imageToDelete.id;
    setGeneratedImages((prev) => prev.filter((img) => img.id !== targetId));
    setImageToDelete(null);
    await deleteGeneratedImageApi(targetId).catch(() => {});
    triggerToast('Rejected frame removed from shoot gallery');
  };

  // 6. Carousel Reordering & Saving Instagram Post Draft (Phase 2I)
  const handleUpdateCarouselIds = (orderedIds: string[]) => {
    setGeneratedImages((prev) => {
      const selectedMap = new Set(orderedIds);
      const updated = prev.map((img) => ({
        ...img,
        selectedForPost: selectedMap.has(img.id),
      }));
      const selectedList = orderedIds
        .map((id) => updated.find((u) => u.id === id))
        .filter((item): item is GeneratedShootImage => Boolean(item));
      const unselectedList = updated.filter((u) => !selectedMap.has(u.id));
      return [...selectedList, ...unselectedList];
    });
  };

  const handleSavePostDraft = async (
    draftData: Omit<InstagramPostDraft, 'id' | 'updatedAt'>
  ) => {
    try {
      const savedDraft = await saveInstagramPostApi({
        ...draftData,
        projectId: activeProduct.projectId,
      });
      setPostDrafts((prev) => [savedDraft, ...prev]);
      triggerToast('Instagram 4:5 carousel draft saved to Project Library');
    } catch {
      const fallbackDraft: InstagramPostDraft = {
        ...draftData,
        id: `post-${Date.now()}`,
        updatedAt: 'Just now',
      };
      setPostDrafts((prev) => [fallbackDraft, ...prev]);
      triggerToast('Instagram 4:5 carousel draft saved');
    }
  };

  const handleDeletePostDraft = async (draftId: string) => {
    setPostDrafts((prev) => prev.filter((d) => d.id !== draftId));
    await deleteInstagramPostApi(draftId).catch(() => {});
    triggerToast('Post draft removed');
  };

  const handleToggleAIMode = async (mode: AIMode) => {
    try {
      const updatedRuntime = await setRuntimeAiMode(mode);
      setRuntimeStatus(updatedRuntime);
      triggerToast(
        `Switched studio runtime to AI_MODE=${updatedRuntime.aiMode.toUpperCase()}`
      );
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : 'Could not switch AI mode'
      );
    }
  };

  const selectedCarouselImages = generatedImages.filter(
    (img) => img.selectedForPost
  );

  // Sidebar Navigation Configuration matching specification
  const studioNavItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'projects',
      label: 'Projects',
      icon: FolderKanban,
      count: projects.length,
    },
    { id: 'products', label: 'Products', icon: Shirt, count: products.length },
    { id: 'shoots', label: 'Shoots', icon: Camera, count: shoots.length },
    { id: 'posts', label: 'Posts', icon: Instagram, count: postDrafts.length },
  ];

  const workflowSteps: Array<{ id: NavigationTab; label: string }> = [
    { id: 'new-project', label: '01. Catalogue' },
    { id: 'workspace', label: '02. Configure Shoot' },
    { id: 'shoot-gallery', label: '03. Shoot Gallery' },
    { id: 'post-builder', label: '04. Instagram Post' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#141413] flex flex-col">
      {/* Top Bar Contract: 3 Zones (Single Brand Wordmark — 4 Workflow Nav Links — Primary Action) */}
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E2DFD7] px-4 lg:px-8 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Title (single text element wordmark) + Mobile menu button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle studio navigation"
            className="lg:hidden p-2 text-[#141413] hover:bg-[#FAF9F5]"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('dashboard');
            }}
            className="font-editorial text-2xl font-semibold tracking-tight text-[#141413] whitespace-nowrap"
          >
            Atelier Noor
          </a>
        </div>

        {/* Zone 2: 4-5 Single-Line Workflow Links */}
        <nav
          aria-label="Studio workflow stages"
          className="hidden md:flex items-center gap-6 text-xs font-medium text-[#57554E]"
        >
          {workflowSteps.map((step) => {
            const isActive = activeTab === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => navigateTo(step.id)}
                className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'text-[#141413] border-[#141413] font-semibold'
                    : 'border-transparent hover:text-[#141413]'
                }`}
              >
                {step.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('workspace')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#141413] bg-[#FAF9F5] border border-[#D6D3C9] hover:border-[#141413] transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Product Studio
          </button>
          <button
            type="button"
            onClick={() => navigateTo('new-project')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        </div>
      </header>

      {/* Main Layout: Sidebar (250px) + Main Content Viewport */}
      <div className="flex-1 flex">
        {/* Desktop & Mobile Sidebar */}
        <aside
          className={`${
            mobileMenuOpen
              ? 'fixed inset-y-0 left-0 top-16 z-40 block'
              : 'hidden'
          } lg:block w-64 shrink-0 bg-white border-r border-[#E2DFD7] flex flex-col justify-between p-5`}
        >
          <div className="space-y-8">
            {/* Group 1: Studio */}
            <div>
              <span className="px-3 text-[11px] font-mono text-[#78756C] block mb-2">
                Studio
              </span>
              <ul className="space-y-1">
                {studioNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => navigateTo(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-[#141413] text-white'
                            : 'text-[#57554E] hover:text-[#141413] hover:bg-[#FAF9F5]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </span>
                        {typeof item.count === 'number' && (
                          <span
                            className={`font-mono text-[11px] tabular-nums ${
                              isActive ? 'text-[#D6D3C9]' : 'text-[#78756C]'
                            }`}
                          >
                            {item.count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Group 2: Workspace */}
            <div>
              <span className="px-3 text-[11px] font-mono text-[#78756C] block mb-2">
                Workspace
              </span>
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() => navigateTo('new-project')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      activeTab === 'new-project'
                        ? 'bg-[#141413] text-white'
                        : 'text-[#57554E] hover:text-[#141413] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Project</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateTo('workspace')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      activeTab === 'workspace' || activeTab === 'generating'
                        ? 'bg-[#141413] text-white'
                        : 'text-[#57554E] hover:text-[#141413] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="truncate">
                      Product Workspace ({activeProduct.sku})
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateTo('shoot-gallery')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      activeTab === 'shoot-gallery'
                        ? 'bg-[#141413] text-white'
                        : 'text-[#57554E] hover:text-[#141413] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Shoot Gallery</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigateTo('post-builder')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      activeTab === 'post-builder'
                        ? 'bg-[#141413] text-white'
                        : 'text-[#57554E] hover:text-[#141413] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Instagram className="w-4 h-4" />
                      <span>Instagram Post Builder</span>
                    </span>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        activeTab === 'post-builder'
                          ? 'text-[#D6D3C9]'
                          : 'text-[#78756C]'
                      }`}
                    >
                      {selectedCarouselImages.length}
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Group 3: Settings */}
          <div className="pt-6 border-t border-[#E6E4DD]">
            <button
              type="button"
              onClick={() => navigateTo('settings')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-[#141413] text-white'
                  : 'text-[#57554E] hover:text-[#141413] hover:bg-[#FAF9F5]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </span>
              {runtimeStatus && (
                <span
                  className={`font-mono text-[10px] uppercase ${
                    activeTab === 'settings'
                      ? 'text-[#D6D3C9]'
                      : 'text-[#78756C]'
                  }`}
                >
                  {runtimeStatus.aiMode}
                </span>
              )}
            </button>
          </div>
        </aside>

        {/* Main Workspace Viewport */}
        <main className="flex-1 min-w-0 p-6 lg:p-10 max-w-[1360px] mx-auto w-full">
          {activeTab === 'dashboard' && (
            <DashboardView
              projects={projects}
              products={products}
              generatedImages={generatedImages}
              postDrafts={postDrafts}
              onNavigate={navigateTo}
              onSelectProductForStudio={handleOpenProductStudio}
              onOpenProject={() => navigateTo('projects')}
              onCompareImage={(img) => {
                setModalImage(img);
                setModalMode('compare');
              }}
              onOpenPostBuilderWithImage={(img) => {
                if (!img.selectedForPost) {
                  handleToggleSelectImageForPost(img.id);
                }
                navigateTo('post-builder');
              }}
            />
          )}

          {activeTab === 'new-project' && (
            <NewProjectView
              detectedProducts={products}
              cataloguePages={cataloguePages}
              projectName={newProjectTitle}
              onProjectNameChange={setNewProjectTitle}
              onUploadCatalogue={handleUploadCatalogue}
              onManualExtractProduct={handleManualExtractProduct}
              onToggleProductSelection={handleToggleProductSelection}
              onSelectAllProducts={handleSelectAllProducts}
              onGenerateContentForProduct={handleOpenProductStudio}
            />
          )}

          {activeTab === 'workspace' && (
            <ProductWorkspaceView
              product={activeProduct}
              allProducts={products}
              config={shootConfig}
              isAnalyzingGarment={isAnalyzingGarment}
              onSelectProduct={setActiveProduct}
              onChangeConfig={setShootConfig}
              onGenerateShoot={handleStartGenerateShoot}
              onAnalyzeGarment={handleAnalyzeGarment}
              onBackToCatalogue={() => navigateTo('new-project')}
            />
          )}

          {activeTab === 'generating' && (
            <GenerationStateView
              product={activeProduct}
              config={shootConfig}
              activeShoot={activeShoot}
              onShootUpdated={handleShootUpdated}
              onComplete={handleCompleteGeneration}
              onRetryInMockMode={handleRetryInMockMode}
              onCancel={() => navigateTo('workspace')}
            />
          )}

          {activeTab === 'shoot-gallery' && (
            <ShootGalleryView
              images={generatedImages}
              activeProduct={activeProduct}
              onToggleSelectForPost={handleToggleSelectImageForPost}
              onSelectAllForPost={handleSelectAllImagesForPost}
              onCompareImage={(img) => {
                setModalImage(img);
                setModalMode('compare');
              }}
              onEditPrompt={(img) => {
                setModalImage(img);
                setModalMode('prompt');
              }}
              onRegenerateImage={(imgId) => handleRegenerateSingleImage(imgId)}
              onDeleteImageRequest={(img) => setImageToDelete(img)}
              onOpenPostBuilder={() => navigateTo('post-builder')}
              onBackToWorkspace={() => navigateTo('workspace')}
            />
          )}

          {activeTab === 'post-builder' && (
            <InstagramPostBuilderView
              selectedImages={selectedCarouselImages}
              allGeneratedImages={generatedImages}
              activeProduct={activeProduct}
              onUpdateCarouselIds={handleUpdateCarouselIds}
              onSaveDraft={handleSavePostDraft}
              onBackToGallery={() => navigateTo('shoot-gallery')}
            />
          )}

          {(activeTab === 'projects' ||
            activeTab === 'products' ||
            activeTab === 'shoots' ||
            activeTab === 'posts') && (
            <LibraryView
              activeSubTab={activeTab}
              projects={projects}
              products={products}
              shoots={shoots}
              generatedImages={generatedImages}
              postDrafts={postDrafts}
              onSwitchSubTab={(sub) => navigateTo(sub)}
              onNavigate={navigateTo}
              onSelectProductForStudio={handleOpenProductStudio}
              onOpenShootInGallery={(shoot) => {
                const prod = products.find((p) => p.id === shoot.productId);
                if (prod) setActiveProduct(prod);
                navigateTo('shoot-gallery');
              }}
              onOpenPostBuilder={() => navigateTo('post-builder')}
              onDeletePostDraft={handleDeletePostDraft}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              runtimeStatus={runtimeStatus}
              onToggleAIMode={handleToggleAIMode}
            />
          )}
        </main>
      </div>

      {/* Garment Compare & Art Direction / Regeneration Modal */}
      <CompareModal
        image={modalImage}
        initialMode={modalMode}
        onClose={() => setModalImage(null)}
        onSavePromptEdit={handleSavePromptEdit}
      />

      {/* Delete / Reject Image Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(imageToDelete)}
        title="Reject & Remove Editorial Frame?"
        description={
          imageToDelete
            ? `This will remove the "${imageToDelete.shotType}" plate (${imageToDelete.productSku}) from your shoot gallery and any active Instagram carousel selection.`
            : ''
        }
        confirmLabel="Remove Frame"
        cancelLabel="Keep Frame"
        variant="danger"
        onConfirm={handleConfirmDeleteImage}
        onCancel={() => setImageToDelete(null)}
      />

      {/* Subtle Studio Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-[#141413] text-[#FAF9F5] px-4 py-3 text-xs font-medium shadow-lg flex items-center gap-2.5 border border-white/10"
        >
          <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
