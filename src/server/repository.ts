import path from 'path';
import {
  AIMode,
  CatalogueProduct,
  GarmentAnalysis,
  GeneratedShootImage,
  InstagramPostDraft,
  StudioProject,
  StudioShoot,
} from '../types/studio';
import { createEmptyState, getStorageMode, loadStudioState, saveStudioState } from './stateStore';

export interface StudioDatabaseState {
  aiMode: AIMode;
  projects: StudioProject[];
  products: CatalogueProduct[];
  shoots: StudioShoot[];
  generatedImages: GeneratedShootImage[];
  postDrafts: InstagramPostDraft[];
}

/**
 * Abstract Repository Interface (Phase 2A)
 * Designed so Supabase / PostgreSQL can replace the local JSON adapter without changing API routes.
 */
export interface IStudioRepository {
  getState(): Promise<StudioDatabaseState>;
  getAiMode(): Promise<AIMode>;
  setAiMode(mode: AIMode): Promise<AIMode>;

  // Projects
  listProjects(): Promise<StudioProject[]>;
  getProject(id: string): Promise<StudioProject | null>;
  createProject(project: StudioProject): Promise<StudioProject>;
  updateProject(id: string, patch: Partial<StudioProject>): Promise<StudioProject | null>;

  // Products
  listProducts(projectId?: string): Promise<CatalogueProduct[]>;
  getProduct(id: string): Promise<CatalogueProduct | null>;
  createProducts(products: CatalogueProduct[]): Promise<CatalogueProduct[]>;
  updateProduct(id: string, patch: Partial<CatalogueProduct>): Promise<CatalogueProduct | null>;
  saveGarmentAnalysis(productId: string, analysis: GarmentAnalysis): Promise<CatalogueProduct | null>;

  // Shoots
  listShoots(productId?: string): Promise<StudioShoot[]>;
  getShoot(id: string): Promise<StudioShoot | null>;
  createShoot(shoot: StudioShoot): Promise<StudioShoot>;
  updateShoot(id: string, patch: Partial<StudioShoot>): Promise<StudioShoot | null>;

  // Generated Images
  listGeneratedImages(shootId?: string): Promise<GeneratedShootImage[]>;
  getGeneratedImage(id: string): Promise<GeneratedShootImage | null>;
  createGeneratedImage(image: GeneratedShootImage): Promise<GeneratedShootImage>;
  updateGeneratedImage(id: string, patch: Partial<GeneratedShootImage>): Promise<GeneratedShootImage | null>;
  deleteGeneratedImage(id: string): Promise<boolean>;

  // Instagram Posts
  listPosts(): Promise<InstagramPostDraft[]>;
  createPost(post: InstagramPostDraft): Promise<InstagramPostDraft>;
  updatePost(id: string, patch: Partial<InstagramPostDraft>): Promise<InstagramPostDraft | null>;
  deletePost(id: string): Promise<boolean>;
}

const DATA_DIR = path.resolve(process.cwd(), '.studio-data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

export class LocalFileStudioRepository implements IStudioRepository {
  private state: StudioDatabaseState = createEmptyState();
  private hydrated = false;
  private chain: Promise<void> = Promise.resolve();

  private async ensure(): Promise<void> {
    if (getStorageMode() === 'local-disk' && this.hydrated) return;
    this.state = await loadStudioState();
    this.state.aiMode = 'live';
    this.hydrated = true;
  }

  private async commit(): Promise<void> {
    this.state.aiMode = 'live';
    await saveStudioState(this.state);
  }

  private async transaction<T>(write: boolean, fn: () => Promise<T> | T): Promise<T> {
    const run = this.chain.then(async () => {
      await this.ensure();
      const result = await fn();
      if (write) await this.commit();
      return result;
    });
    this.chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async getState(): Promise<StudioDatabaseState> {
    return this.transaction(false, () => this.state);
  }

  async getAiMode(): Promise<AIMode> {
    return this.transaction(false, () => 'live' as AIMode);
  }

  async setAiMode(_mode: AIMode): Promise<AIMode> {
    return this.transaction(true, () => {
      this.state.aiMode = 'live';
      return 'live' as AIMode;
    });
  }

  async listProjects(): Promise<StudioProject[]> {
    return this.transaction(false, () => this.state.projects);
  }

  async getProject(id: string): Promise<StudioProject | null> {
    return this.transaction(false, () => this.state.projects.find((p) => p.id === id) || null);
  }

  async createProject(project: StudioProject): Promise<StudioProject> {
    return this.transaction(true, () => {
      this.state.projects = [project, ...this.state.projects.filter((p) => p.id !== project.id)];
      return project;
    });
  }

  async updateProject(id: string, patch: Partial<StudioProject>): Promise<StudioProject | null> {
    return this.transaction(true, () => {
      const idx = this.state.projects.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      this.state.projects[idx] = {
        ...this.state.projects[idx],
        ...patch,
        updatedAt: patch.updatedAt || 'Just now',
      };
      return this.state.projects[idx];
    });
  }

  async listProducts(projectId?: string): Promise<CatalogueProduct[]> {
    return this.transaction(false, () => {
      if (!projectId) return this.state.products;
      return this.state.products.filter((p) => p.projectId === projectId);
    });
  }

  async getProduct(id: string): Promise<CatalogueProduct | null> {
    return this.transaction(false, () => this.state.products.find((p) => p.id === id) || null);
  }

  async createProducts(newProducts: CatalogueProduct[]): Promise<CatalogueProduct[]> {
    return this.transaction(true, () => {
      this.state.products = [...newProducts, ...this.state.products];
      return newProducts;
    });
  }

  async updateProduct(id: string, patch: Partial<CatalogueProduct>): Promise<CatalogueProduct | null> {
    return this.transaction(true, () => {
      const idx = this.state.products.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      this.state.products[idx] = { ...this.state.products[idx], ...patch };
      return this.state.products[idx];
    });
  }

  async saveGarmentAnalysis(productId: string, analysis: GarmentAnalysis): Promise<CatalogueProduct | null> {
    return this.updateProduct(productId, { garmentAnalysis: analysis });
  }

  async listShoots(productId?: string): Promise<StudioShoot[]> {
    return this.transaction(false, () => {
      if (!productId) return this.state.shoots;
      return this.state.shoots.filter((s) => s.productId === productId);
    });
  }

  async getShoot(id: string): Promise<StudioShoot | null> {
    return this.transaction(false, () => this.state.shoots.find((s) => s.id === id) || null);
  }

  async createShoot(shoot: StudioShoot): Promise<StudioShoot> {
    return this.transaction(true, () => {
      this.state.shoots = [shoot, ...this.state.shoots];
      const proj = this.state.projects.find((p) => p.id === shoot.projectId);
      if (proj && !proj.shootIds.includes(shoot.id)) {
        proj.shootIds.push(shoot.id);
        proj.updatedAt = 'Just now';
      }
      return shoot;
    });
  }

  async updateShoot(id: string, patch: Partial<StudioShoot>): Promise<StudioShoot | null> {
    return this.transaction(true, () => {
      const idx = this.state.shoots.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      this.state.shoots[idx] = { ...this.state.shoots[idx], ...patch };
      return this.state.shoots[idx];
    });
  }

  async listGeneratedImages(shootId?: string): Promise<GeneratedShootImage[]> {
    return this.transaction(false, () => {
      if (!shootId) return this.state.generatedImages;
      return this.state.generatedImages.filter((img) => img.shootId === shootId);
    });
  }

  async getGeneratedImage(id: string): Promise<GeneratedShootImage | null> {
    return this.transaction(
      false,
      () => this.state.generatedImages.find((img) => img.id === id) || null
    );
  }

  async createGeneratedImage(image: GeneratedShootImage): Promise<GeneratedShootImage> {
    return this.transaction(true, () => {
      this.state.generatedImages = [image, ...this.state.generatedImages];
      const shoot = this.state.shoots.find((s) => s.id === image.shootId);
      if (shoot) {
        shoot.images = [image, ...shoot.images.filter((i) => i.id !== image.id)];
      }
      return image;
    });
  }

  async updateGeneratedImage(
    id: string,
    patch: Partial<GeneratedShootImage>
  ): Promise<GeneratedShootImage | null> {
    return this.transaction(true, () => {
      const idx = this.state.generatedImages.findIndex((img) => img.id === id);
      if (idx === -1) return null;
      const updated = { ...this.state.generatedImages[idx], ...patch };
      this.state.generatedImages[idx] = updated;
      const shoot = this.state.shoots.find((s) => s.id === updated.shootId);
      if (shoot) {
        shoot.images = shoot.images.map((i) => (i.id === id ? updated : i));
      }
      return updated;
    });
  }

  async deleteGeneratedImage(id: string): Promise<boolean> {
    return this.transaction(true, () => {
      const target = this.state.generatedImages.find((img) => img.id === id);
      if (!target) return false;
      this.state.generatedImages = this.state.generatedImages.filter((img) => img.id !== id);
      const shoot = this.state.shoots.find((s) => s.id === target.shootId);
      if (shoot) {
        shoot.images = shoot.images.filter((i) => i.id !== id);
      }
      return true;
    });
  }

  async listPosts(): Promise<InstagramPostDraft[]> {
    return this.transaction(false, () => this.state.postDrafts);
  }

  async createPost(post: InstagramPostDraft): Promise<InstagramPostDraft> {
    return this.transaction(true, () => {
      this.state.postDrafts = [post, ...this.state.postDrafts];
      return post;
    });
  }

  async updatePost(
    id: string,
    patch: Partial<InstagramPostDraft>
  ): Promise<InstagramPostDraft | null> {
    return this.transaction(true, () => {
      const idx = this.state.postDrafts.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      this.state.postDrafts[idx] = {
        ...this.state.postDrafts[idx],
        ...patch,
        updatedAt: 'Just now',
      };
      return this.state.postDrafts[idx];
    });
  }

  async deletePost(id: string): Promise<boolean> {
    return this.transaction(true, () => {
      const before = this.state.postDrafts.length;
      this.state.postDrafts = this.state.postDrafts.filter((p) => p.id !== id);
      return this.state.postDrafts.length < before;
    });
  }
}

export const studioRepository: IStudioRepository = new LocalFileStudioRepository();
