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
  LogOut,
  Menu,
  Plus,
  Settings,
  Shirt,
  Sparkles,
  X,
} from 'lucide-react';

import {
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

import { DEFAULT_SHOOT_CONFIG } from './data/studioDefaults';

import {
  analyzeProductGarmentApi,
  createAndStartShootApi,
  deleteGeneratedImageApi,
  deleteInstagramPostApi,
  fetchBootstrapState,
  createProjectOnServer,
  manualExtractProductFromPage,
  RegenerateImageOverrides,
  regenerateSingleImageApi,
  saveInstagramPostApi,
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
import { LoginView } from './components/views/LoginView';
import { supabase } from './lib/supabaseClient';

export default function App() {
  // Navigation & Responsive Sidebar State
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [shoots, setShoots] = useState<StudioShoot[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedShootImage[]>([]);
  const [postDrafts, setPostDrafts] = useState<InstagramPostDraft[]>([]);
  const [cataloguePages, setCataloguePages] = useState<CataloguePagePlate[]>([]);
  const [runtimeStatus, setRuntimeStatus] =
    useState<StudioRuntimeStatus | null>(null);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null | undefined>(undefined);

  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createProjectName, setCreateProjectName] = useState('');
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [activeProduct, setActiveProduct] = useState<CatalogueProduct | null>(null);
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

  const clearStudio = () => {
    setProjects([]);
    setProducts([]);
    setShoots([]);
    setGeneratedImages([]);
    setPostDrafts([]);
    setCataloguePages([]);
    setActiveProduct(null);
    setActiveShoot(null);
    setActiveProjectId(null);
    setCreateProjectOpen(false);
    setRuntimeStatus(null);
    setActiveTab('dashboard');
  };

  useEffect(() => {
    if (!supabase) {
      setSessionEmail(null);
      return;
    }
    const client = supabase;
    let mounted = true;
    client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSessionEmail(data.session?.user.email ?? null);
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
      if (!session) clearStudio();
    });
    const onSignedOut = () => {
      void client.auth.signOut();
    };
    window.addEventListener('studio:signed-out', onSignedOut);
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
      window.removeEventListener('studio:signed-out', onSignedOut);
    };
  }, []);

  // Hydrate persistent studio state from backend after sign-in
  useEffect(() => {
    if (!sessionEmail) return;
    let mounted = true;
    fetchBootstrapState()
      .then((data) => {
        if (!mounted) return;
        if (data.projects?.length) {
          setProjects(data.projects);
        }
        setProducts(data.products || []);
        setActiveProduct((prev) => {
          if (!data.products?.length) return null;
          const matched = prev
            ? data.products.find((p: CatalogueProduct) => p.id === prev.id)
            : null;
          return matched || data.products[0];
        });
        if (data.shoots?.length) setShoots(data.shoots);
        if (data.generatedImages?.length)
          setGeneratedImages(data.generatedImages);
        if (data.postDrafts?.length) setPostDrafts(data.postDrafts);
        if (data.runtime) setRuntimeStatus(data.runtime);
        setStudioError(null);
      })
      .catch(() => {
        setStudioError(
          'The studio API is not responding. Redeploy after this update so /api is served with the site.'
        );
      });
    return () => {
      mounted = false;
    };
  }, [sessionEmail]);

  // Keep activeProduct synchronized when products array updates
  useEffect(() => {
    if (!activeProduct) return;
    const updated = products.find((p) => p.id === activeProduct.id);
    if (updated && updated !== activeProduct) {
      setActiveProduct(updated);
    }
  }, [products, activeProduct]);

  // Navigation helper
  const navigateTo = (tab: NavigationTab) => {
    setCreateProjectOpen(false);
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeProject = projects.find((project) => project.id === activeProjectId) || null;

  const startCreateProject = () => {
    setCreateProjectName('');
    setCreateProjectError(null);
    setCreateProjectOpen(true);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      navigateTo('projects');
      return;
    }
    setActiveProjectId(project.id);
    setNewProjectTitle(project.name);
    setCataloguePages(project.pages || []);
    setCreateProjectOpen(false);
    navigateTo('new-project');
  };

  const openCatalogue = () => {
    if (activeProject) {
      setCataloguePages(activeProject.pages || []);
      setNewProjectTitle(activeProject.name);
      navigateTo('new-project');
      return;
    }
    navigateTo('projects');
  };

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = createProjectName.trim();
    if (!name) {
      setCreateProjectError('Name the collection before creating it.');
      return;
    }
    setIsCreatingProject(true);
    setCreateProjectError(null);
    try {
      const project = await createProjectOnServer(name);
      setProjects((prev) => [project, ...prev.filter((item) => item.id !== project.id)]);
      setActiveProjectId(project.id);
      setNewProjectTitle(project.name);
      setCataloguePages([]);
      setCreateProjectOpen(false);
      navigateTo('new-project');
      triggerToast(`Created ${project.name}`);
    } catch (err: unknown) {
      setCreateProjectError(
        err instanceof Error ? err.message : 'Could not create the project.'
      );
    } finally {
      setIsCreatingProject(false);
    }
  };

  // 1A. Catalogue / Garment Upload into the open project
  const handleUploadCatalogue = async (
    sourceType: 'Catalogue PDF' | 'Garment Images',
    files?: File[]
  ) => {
    if (!activeProjectId) {
      throw new Error('Create a project before uploading a PDF or garment photos.');
    }
    if (!files || files.length === 0) {
      throw new Error('Choose a catalogue PDF or garment images to upload.');
    }
    const result = await uploadCatalogueToServer({
      projectId: activeProjectId,
      projectName: newProjectTitle || activeProject?.name || 'Untitled Collection',
      sourceType,
      files,
    });

    setProjects((prev) => [
      result.project,
      ...prev.filter((p) => p.id !== result.project.id),
    ]);
    setProducts((prev) => {
      const incomingIds = new Set(result.products.map((product) => product.id));
      return [...result.products, ...prev.filter((product) => !incomingIds.has(product.id))];
    });
    setNewProjectTitle(result.project.name);
    if (result.pages?.length) {
      setCataloguePages(result.pages);
    }
    if (result.products[0]) {
      setActiveProduct(result.products[0]);
    }

    const displayFile = files[0]?.name || sourceType;
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
    if (!activeProjectId) {
      throw new Error('Open a project before cropping a page.');
    }
    const createdProduct = await manualExtractProductFromPage(
      activeProjectId,
      payload
    );
    setProducts((prev) => [createdProduct, ...prev]);
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              productIds: [
                createdProduct.id,
                ...project.productIds.filter((id) => id !== createdProduct.id),
              ],
              coverImageUrl: project.coverImageUrl || createdProduct.referenceImage,
            }
          : project
      )
    );
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
    setProducts((prev) =>
      prev.map((product) =>
        activeProjectId && product.projectId === activeProjectId
          ? { ...product, selected }
          : product
      )
    );
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
      if (activeProduct?.id === productId) {
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
    if (!activeProduct) return;
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
        `Generated ${frameCount} editorial frames for ${activeProduct?.sku || 'this garment'}`
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

  const handleRetryShoot = async () => {
    if (!activeProduct) return;
    try {
      const createdShoot = await createAndStartShootApi(
        activeProduct.id,
        shootConfig
      );
      setShoots((prev) => [createdShoot, ...prev]);
      setActiveShoot(createdShoot);
      triggerToast('Restarted live Gemini shoot generation');
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
    if (!activeProduct) return;
    try {
      const savedDraft = await saveInstagramPostApi({
        ...draftData,
        projectId: activeProduct.projectId,
      });
      setPostDrafts((prev) => [savedDraft, ...prev]);
      triggerToast('Instagram 4:5 carousel draft saved to Project Library');
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : 'Could not save the Instagram draft'
      );
    }
  };

  const handleDeletePostDraft = async (draftId: string) => {
    setPostDrafts((prev) => prev.filter((d) => d.id !== draftId));
    await deleteInstagramPostApi(draftId).catch(() => {});
    triggerToast('Post draft removed');
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

  if (sessionEmail === undefined) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] text-[#57554E] flex items-center justify-center text-sm">
        Loading studio…
      </div>
    );
  }

  if (!sessionEmail) {
    return <LoginView onSignedIn={setSessionEmail} />;
  }

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
            const isActive = !createProjectOpen && activeTab === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => (step.id === 'new-project' ? openCatalogue() : navigateTo(step.id))}
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
            onClick={startCreateProject}
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
                    onClick={startCreateProject}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      createProjectOpen
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
                      Product Workspace{activeProduct ? ` (${activeProduct.sku})` : ''}
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
                  {runtimeStatus.hasGeminiApiKey ? 'LIVE' : 'NO KEY'}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                void supabase?.auth.signOut();
              }}
              className="mt-1 w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-[#57554E] hover:text-[#141413] hover:bg-[#FAF9F5] transition-colors whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              <span className="truncate">Sign out{sessionEmail ? ` (${sessionEmail})` : ''}</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace Viewport */}
        <main className="flex-1 min-w-0 p-6 lg:p-10 max-w-[1360px] mx-auto w-full">
          {studioError && (
            <div className="mb-6 border border-[#DC2626] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
              {studioError}
            </div>
          )}
          {runtimeStatus && !runtimeStatus.hasGeminiApiKey && (
            <div className="mb-6 border border-[#141413] bg-[#FAF9F5] px-4 py-3 text-sm text-[#141413]">
              Add <span className="font-mono">GEMINI_API_KEY</span> in the Vercel project environment variables, then redeploy. Generation stays on the live Gemini API.
            </div>
          )}
          {runtimeStatus?.storageMode === 'ephemeral' && (
            <div className="mb-6 border border-[#141413] bg-[#FAF9F5] px-4 py-3 text-sm text-[#141413]">
              Create a Vercel Blob store under Storage so uploads and generated images persist. Redeploy after the store is connected.
            </div>
          )}
          {createProjectOpen && (
            <form
              onSubmit={handleCreateProject}
              className="max-w-xl border border-[#E2DFD7] bg-white p-8 space-y-6"
            >
              <div>
                <div className="text-xs text-[#6E6B62] mb-1.5">Studio / New project</div>
                <h1 className="font-editorial text-3xl font-semibold text-[#141413]">
                  Name this collection
                </h1>
                <p className="mt-2 text-sm text-[#57554E]">
                  Create the project first. PDF and garment photo uploads happen inside it.
                </p>
              </div>
              <div>
                <label
                  htmlFor="create-project-name"
                  className="block text-xs font-medium text-[#141413] mb-2"
                >
                  Collection name
                </label>
                <input
                  id="create-project-name"
                  type="text"
                  value={createProjectName}
                  onChange={(event) => setCreateProjectName(event.target.value)}
                  placeholder="e.g., Winter Festive '26"
                  className="w-full bg-[#FAF9F5] border border-[#D6D3C9] px-4 py-2.5 text-sm text-[#141413] focus:outline-none focus:border-[#141413]"
                  autoFocus
                />
              </div>
              {createProjectError && (
                <p className="text-xs text-[#991B1B]">{createProjectError}</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isCreatingProject}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isCreatingProject ? 'Creating…' : 'Create project'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateProjectOpen(false)}
                  className="px-4 py-2.5 text-xs font-medium text-[#141413] bg-white border border-[#D6D3C9] hover:border-[#141413] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {!createProjectOpen && activeTab === 'dashboard' && (
            <DashboardView
              projects={projects}
              products={products}
              generatedImages={generatedImages}
              postDrafts={postDrafts}
              onNavigate={navigateTo}
              onCreateProject={startCreateProject}
              onUploadMore={openCatalogue}
              onSelectProductForStudio={handleOpenProductStudio}
              onOpenProject={openProject}
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

          {!createProjectOpen && activeTab === 'new-project' && activeProject && (
            <NewProjectView
              detectedProducts={products.filter((product) => product.projectId === activeProject.id)}
              cataloguePages={cataloguePages}
              projectName={newProjectTitle || activeProject.name}
              onProjectNameChange={setNewProjectTitle}
              onUploadCatalogue={handleUploadCatalogue}
              onManualExtractProduct={handleManualExtractProduct}
              onToggleProductSelection={handleToggleProductSelection}
              onSelectAllProducts={handleSelectAllProducts}
              onGenerateContentForProduct={handleOpenProductStudio}
            />
          )}

          {!createProjectOpen && activeTab === 'new-project' && !activeProject && (
            <div className="border border-[#E2DFD7] bg-white p-8">
              <h1 className="font-editorial text-3xl font-semibold text-[#141413]">
                Open a project first
              </h1>
              <p className="mt-2 text-sm text-[#57554E]">
                Create a project, then upload a PDF or garment photos.
              </p>
              <button
                type="button"
                onClick={startCreateProject}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Project
              </button>
            </div>
          )}

          {!createProjectOpen && activeTab === 'workspace' && activeProduct && (
            <ProductWorkspaceView
              product={activeProduct}
              allProducts={products}
              config={shootConfig}
              isAnalyzingGarment={isAnalyzingGarment}
              onSelectProduct={setActiveProduct}
              onChangeConfig={setShootConfig}
              onGenerateShoot={handleStartGenerateShoot}
              onAnalyzeGarment={handleAnalyzeGarment}
              onBackToCatalogue={openCatalogue}
            />
          )}

          {!createProjectOpen && activeTab === 'workspace' && !activeProduct && (
            <div className="border border-[#E2DFD7] bg-white p-8">
              <h1 className="font-editorial text-3xl font-semibold text-[#141413]">
                No garment selected
              </h1>
              <p className="mt-2 text-sm text-[#57554E]">
                Create a project, then upload a PDF or garment photos.
              </p>
            </div>
          )}

          {!createProjectOpen && activeTab === 'generating' && activeProduct && (
            <GenerationStateView
              product={activeProduct}
              config={shootConfig}
              activeShoot={activeShoot}
              onShootUpdated={handleShootUpdated}
              onComplete={handleCompleteGeneration}
              onRetry={handleRetryShoot}
              onCancel={() => navigateTo('workspace')}
            />
          )}

          {!createProjectOpen && activeTab === 'shoot-gallery' && (
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

          {!createProjectOpen && activeTab === 'post-builder' && activeProduct && (
            <InstagramPostBuilderView
              selectedImages={selectedCarouselImages}
              allGeneratedImages={generatedImages}
              activeProduct={activeProduct}
              onUpdateCarouselIds={handleUpdateCarouselIds}
              onSaveDraft={handleSavePostDraft}
              onBackToGallery={() => navigateTo('shoot-gallery')}
            />
          )}

          {!createProjectOpen &&
            (activeTab === 'projects' ||
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
              onCreateProject={startCreateProject}
              onOpenProject={openProject}
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

          {!createProjectOpen && activeTab === 'settings' && (
            <SettingsView runtimeStatus={runtimeStatus} />
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
