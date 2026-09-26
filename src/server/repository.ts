import fs from 'fs';
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
import {
  CRIMSON_GARMENT_ANALYSIS,
  DEFAULT_SHOOT_CONFIG,
  EMERALD_GARMENT_ANALYSIS,
  IVORY_GARMENT_ANALYSIS,
} from '../data/mockStudioData';

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
const DB_FILE = path.join(DATA_DIR, 'studio-db.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const ASSET_PATHS = {
  garmentEmerald: '/src/assets/images/garment_emerald_zari_flatlay_1790442774795.jpg',
  shootEmeraldFull: '/src/assets/images/shoot_emerald_editorial_full_1790442793707.jpg',
  shootEmeraldDetail: '/src/assets/images/shoot_emerald_detail_portrait_1790442810047.jpg',
  garmentIvory: '/src/assets/images/garment_ivory_organza_flatlay_1790442824991.jpg',
  shootIvoryStudio: '/src/assets/images/shoot_ivory_studio_editorial_1790442838099.jpg',
  shootCrimsonWalking: '/src/assets/images/shoot_crimson_festive_walking_1790442854767.jpg',
};

function createInitialSeedState(): StudioDatabaseState {
  const envMode = (process.env.AI_MODE || 'mock').toLowerCase() === 'live' ? 'live' : 'mock';

  const products: CatalogueProduct[] = [
    {
      id: 'prod-emerald-01',
      projectId: 'proj-autumn-festive',
      sku: 'AN-26-014',
      name: 'Zardozi Emerald Raw Silk Kurta Set',
      category: 'Luxury Pret · 2-Piece',
      fabricDetails: '100% Pure Korean Raw Silk · Antique Gold Tilla & Zardozi Embroidery',
      rawCatalogueText:
        'ITEM #AN-26-014. EMERALD RAW SILK LONG SHIRT WITH ZARDOZI NECKLINE AND SLEEVE CUFF BORDER. LENGTH 44 INCHES. TROUSER RAW SILK CULOTTES. DRY CLEAN ONLY.',
      garmentImageUrl: ASSET_PATHS.garmentEmerald,
      referenceImage: ASSET_PATHS.garmentEmerald,
      sourcePage: 1,
      detectedPage: 1,
      garmentAnalysis: EMERALD_GARMENT_ANALYSIS,
      selected: true,
      createdAt: '2026-09-24',
      generatedCount: 4,
    },
    {
      id: 'prod-ivory-02',
      projectId: 'proj-autumn-festive',
      sku: 'AN-26-019',
      name: 'Chandi Ivory Silk Organza Peshwas',
      category: 'Formal Edit · 3-Piece',
      fabricDetails: 'Pure Woven Silk Organza · Hand-Worked Silver Resham & Freshwater Pearls',
      rawCatalogueText:
        'ITEM #AN-26-019. IVORY ORGANZA PANELLED TUNIC WITH SILVER RESHAM FLORAL MOTIFS AND PEARL TAKKAI. INCLUDES ORGANZA DUPATTA. DRY CLEAN ONLY.',
      garmentImageUrl: ASSET_PATHS.garmentIvory,
      referenceImage: ASSET_PATHS.garmentIvory,
      sourcePage: 2,
      detectedPage: 2,
      garmentAnalysis: IVORY_GARMENT_ANALYSIS,
      selected: true,
      createdAt: '2026-09-24',
      generatedCount: 2,
    },
    {
      id: 'prod-crimson-03',
      projectId: 'proj-heritage-silk',
      sku: 'AN-26-027',
      name: 'Gulnar Crimson Silk Kaftan',
      category: 'Festive Resort · 1-Piece',
      fabricDetails: 'Heavyweight Matka Silk · Marori & Dabka Neckline Artisanal Work',
      rawCatalogueText:
        'ITEM #AN-26-027. CRIMSON RED RELAXED FIT KAFTAN IN MATKA SILK WITH GOLD MARORI WORK ON V-NECK AND SLEEVES. FREE SIZE.',
      garmentImageUrl: ASSET_PATHS.shootCrimsonWalking,
      referenceImage: ASSET_PATHS.shootCrimsonWalking,
      sourcePage: 1,
      detectedPage: 1,
      garmentAnalysis: CRIMSON_GARMENT_ANALYSIS,
      selected: false,
      createdAt: '2026-09-21',
      generatedCount: 2,
    },
  ];

  const generatedImages: GeneratedShootImage[] = [
    {
      id: 'img-gen-101',
      shootId: 'shoot-emerald-01',
      productId: 'prod-emerald-01',
      projectId: 'proj-autumn-festive',
      imageUrl: ASSET_PATHS.shootEmeraldFull,
      garmentReferenceUrl: ASSET_PATHS.garmentEmerald,
      productName: 'Zardozi Emerald Raw Silk Kurta Set',
      productSku: 'AN-26-014',
      shotType: 'Full body',
      modelSummary: 'Ayla · Pakistani / South Asian (25–29)',
      style: 'Luxury Editorial',
      background: 'Minimal architectural',
      aspectRatio: 'Instagram Portrait 4:5',
      status: 'Ready',
      promptNotes:
        'Full-length architectural courtyard framing, sunlit limestone shadow play, poised stance highlighting emerald raw silk drape and cuff zardozi.',
      cropVariant: 'full',
      selectedForPost: true,
      createdAt: '2026-09-26 09:40',
    },
    {
      id: 'img-gen-102',
      shootId: 'shoot-emerald-01',
      productId: 'prod-emerald-01',
      projectId: 'proj-autumn-festive',
      imageUrl: ASSET_PATHS.shootEmeraldDetail,
      garmentReferenceUrl: ASSET_PATHS.garmentEmerald,
      productName: 'Zardozi Emerald Raw Silk Kurta Set',
      productSku: 'AN-26-014',
      shotType: 'Detail portrait',
      modelSummary: 'Ayla · Pakistani / South Asian (25–29)',
      style: 'Luxury Editorial',
      background: 'Minimal architectural',
      aspectRatio: 'Instagram Portrait 4:5',
      status: 'Ready',
      promptNotes:
        'Close 3/4 editorial beauty & neckline detail portrait, warm golden hour rim light emphasizing hand-worked antique gold tilla threadwork.',
      cropVariant: 'detail',
      selectedForPost: true,
      createdAt: '2026-09-26 09:40',
    },
    {
      id: 'img-gen-103',
      shootId: 'shoot-emerald-01',
      productId: 'prod-emerald-01',
      projectId: 'proj-autumn-festive',
      imageUrl: ASSET_PATHS.shootEmeraldFull,
      garmentReferenceUrl: ASSET_PATHS.garmentEmerald,
      productName: 'Zardozi Emerald Raw Silk Kurta Set',
      productSku: 'AN-26-014',
      shotType: '3/4 standing',
      modelSummary: 'Ayla · Pakistani / South Asian (25–29)',
      style: 'Luxury Editorial',
      background: 'Minimal architectural',
      aspectRatio: 'Instagram Portrait 4:5',
      status: 'Ready',
      promptNotes:
        'Mid-thigh 3/4 standing editorial crop, focus on structured raw silk shoulder line and gold zardozi sleeve borders.',
      cropVariant: 'three-quarter',
      selectedForPost: true,
      createdAt: '2026-09-26 09:41',
    },
    {
      id: 'img-gen-104',
      shootId: 'shoot-emerald-01',
      productId: 'prod-emerald-01',
      projectId: 'proj-autumn-festive',
      imageUrl: ASSET_PATHS.shootEmeraldDetail,
      garmentReferenceUrl: ASSET_PATHS.garmentEmerald,
      productName: 'Zardozi Emerald Raw Silk Kurta Set',
      productSku: 'AN-26-014',
      shotType: 'Back/side angle',
      modelSummary: 'Ayla · Pakistani / South Asian (25–29)',
      style: 'Luxury Editorial',
      background: 'Minimal architectural',
      aspectRatio: 'Instagram Portrait 4:5',
      status: 'Ready',
      promptNotes:
        'Side-profile editorial angle capturing jawline, sleek center-part bun, and metallic gold embroidery catching ambient light.',
      cropVariant: 'angle',
      selectedForPost: false,
      createdAt: '2026-09-26 09:41',
    },
    {
      id: 'img-gen-201',
      shootId: 'shoot-ivory-02',
      productId: 'prod-ivory-02',
      projectId: 'proj-autumn-festive',
      imageUrl: ASSET_PATHS.shootIvoryStudio,
      garmentReferenceUrl: ASSET_PATHS.garmentIvory,
      productName: 'Chandi Ivory Silk Organza Peshwas',
      productSku: 'AN-26-019',
      shotType: 'Seated',
      modelSummary: 'Meher · Pakistani / South Asian (20–24)',
      style: 'Minimal Studio',
      background: 'Studio',
      aspectRatio: 'Instagram Portrait 4:5',
      status: 'Ready',
      promptNotes:
        'Seated gracefully on a sculptural travertine plinth against warm alabaster studio cyclorama, sheer ivory organza layering.',
      cropVariant: 'seated',
      selectedForPost: true,
      createdAt: '2026-09-25 16:15',
    },
    {
      id: 'img-gen-301',
      shootId: 'shoot-crimson-03',
      productId: 'prod-crimson-03',
      projectId: 'proj-heritage-silk',
      imageUrl: ASSET_PATHS.shootCrimsonWalking,
      garmentReferenceUrl: ASSET_PATHS.shootCrimsonWalking,
      productName: 'Gulnar Crimson Silk Kaftan',
      productSku: 'AN-26-027',
      shotType: 'Walking',
      modelSummary: 'Zoya · Pakistani / South Asian (25–29)',
      style: 'Outdoor Lifestyle',
      background: 'Outdoor',
      aspectRatio: 'Instagram Portrait 4:5',
      status: 'Ready',
      promptNotes:
        'Fluid walking motion through a sandstone colonnade at dusk, crimson matka silk drape catching golden sunlight.',
      cropVariant: 'walking',
      selectedForPost: true,
      createdAt: '2026-09-22 14:20',
    },
  ];

  const shoots: StudioShoot[] = [
    {
      id: 'shoot-emerald-01',
      projectId: 'proj-autumn-festive',
      productId: 'prod-emerald-01',
      productName: 'Zardozi Emerald Raw Silk Kurta Set',
      productSku: 'AN-26-014',
      garmentImageUrl: ASSET_PATHS.garmentEmerald,
      style: DEFAULT_SHOOT_CONFIG.shootStyle,
      modelSettings: DEFAULT_SHOOT_CONFIG.model,
      shotSettings: {
        poses: DEFAULT_SHOOT_CONFIG.poses,
        background: DEFAULT_SHOOT_CONFIG.background,
        customBackgroundNote: DEFAULT_SHOOT_CONFIG.customBackgroundNote,
        numberOfImages: DEFAULT_SHOOT_CONFIG.numberOfImages,
      },
      aspectRatio: DEFAULT_SHOOT_CONFIG.aspectRatio,
      status: 'Complete',
      jobs: [
        { id: 'job-101', shootId: 'shoot-emerald-01', shotType: 'Full body', status: 'Complete', imageId: 'img-gen-101' },
        { id: 'job-102', shootId: 'shoot-emerald-01', shotType: 'Detail portrait', status: 'Complete', imageId: 'img-gen-102' },
        { id: 'job-103', shootId: 'shoot-emerald-01', shotType: '3/4 standing', status: 'Complete', imageId: 'img-gen-103' },
        { id: 'job-104', shootId: 'shoot-emerald-01', shotType: 'Back/side angle', status: 'Complete', imageId: 'img-gen-104' },
      ],
      config: DEFAULT_SHOOT_CONFIG,
      images: generatedImages.filter((img) => img.shootId === 'shoot-emerald-01'),
      createdAt: '2026-09-26',
    },
    {
      id: 'shoot-ivory-02',
      projectId: 'proj-autumn-festive',
      productId: 'prod-ivory-02',
      productName: 'Chandi Ivory Silk Organza Peshwas',
      productSku: 'AN-26-019',
      garmentImageUrl: ASSET_PATHS.garmentIvory,
      style: 'Minimal Studio',
      modelSettings: DEFAULT_SHOOT_CONFIG.model,
      shotSettings: {
        poses: ['Seated', 'Full body'],
        background: 'Studio',
        customBackgroundNote: '',
        numberOfImages: 2,
      },
      aspectRatio: 'Instagram Portrait 4:5',
      status: 'Complete',
      jobs: [
        { id: 'job-201', shootId: 'shoot-ivory-02', shotType: 'Seated', status: 'Complete', imageId: 'img-gen-201' },
      ],
      config: {
        ...DEFAULT_SHOOT_CONFIG,
        shootStyle: 'Minimal Studio',
        poses: ['Seated', 'Full body'],
        background: 'Studio',
        numberOfImages: 2,
      },
      images: generatedImages.filter((img) => img.shootId === 'shoot-ivory-02'),
      createdAt: '2026-09-25',
    },
    {
      id: 'shoot-crimson-03',
      projectId: 'proj-heritage-silk',
      productId: 'prod-crimson-03',
      productName: 'Gulnar Crimson Silk Kaftan',
      productSku: 'AN-26-027',
      garmentImageUrl: ASSET_PATHS.shootCrimsonWalking,
      style: 'Outdoor Lifestyle',
      modelSettings: DEFAULT_SHOOT_CONFIG.model,
      shotSettings: {
        poses: ['Walking', 'Full body'],
        background: 'Outdoor',
        customBackgroundNote: '',
        numberOfImages: 2,
      },
      aspectRatio: 'Instagram Portrait 4:5',
      status: 'Complete',
      jobs: [
        { id: 'job-301', shootId: 'shoot-crimson-03', shotType: 'Walking', status: 'Complete', imageId: 'img-gen-301' },
      ],
      config: {
        ...DEFAULT_SHOOT_CONFIG,
        shootStyle: 'Outdoor Lifestyle',
        poses: ['Walking', 'Full body'],
        background: 'Outdoor',
        numberOfImages: 2,
      },
      images: generatedImages.filter((img) => img.shootId === 'shoot-crimson-03'),
      createdAt: '2026-09-22',
    },
  ];

  const projects: StudioProject[] = [
    {
      id: 'proj-autumn-festive',
      name: "Autumn Festive '26 — Zardozi & Organza Edit",
      seasonCode: 'AF26',
      sourceType: 'Catalogue PDF',
      sourceFileName: 'AtelierNoor_Festive26_Lookbook_Sheet.pdf',
      status: 'active',
      createdAt: '2026-09-24',
      updatedAt: '2 hours ago',
      productIds: ['prod-emerald-01', 'prod-ivory-02'],
      shootIds: ['shoot-emerald-01', 'shoot-ivory-02'],
      coverImageUrl: ASSET_PATHS.shootEmeraldFull,
      pages: [
        {
          pageNumber: 1,
          imageUrl: ASSET_PATHS.garmentEmerald,
          label: 'Page 01 — Emerald Raw Silk Line Sheet Plate',
          detectedRegions: [
            {
              id: 'reg-1',
              label: 'Zardozi Emerald Raw Silk Kurta',
              sku: 'AN-26-014',
              cropBox: { x: 8, y: 6, width: 84, height: 88 },
            },
          ],
        },
        {
          pageNumber: 2,
          imageUrl: ASSET_PATHS.garmentIvory,
          label: 'Page 02 — Ivory Silk Organza Formal Plate',
          detectedRegions: [
            {
              id: 'reg-2',
              label: 'Chandi Ivory Silk Organza Peshwas',
              sku: 'AN-26-019',
              cropBox: { x: 10, y: 8, width: 80, height: 84 },
            },
          ],
        },
      ],
    },
    {
      id: 'proj-heritage-silk',
      name: 'Silk Route Resort — Evening Kaftans',
      seasonCode: 'SR26',
      sourceType: 'Garment Images',
      sourceFileName: 'Crimson_Matka_Kaftan_Flatlays.zip',
      status: 'completed',
      createdAt: '2026-09-21',
      updatedAt: '3 days ago',
      productIds: ['prod-crimson-03'],
      shootIds: ['shoot-crimson-03'],
      coverImageUrl: ASSET_PATHS.shootCrimsonWalking,
      pages: [
        {
          pageNumber: 1,
          imageUrl: ASSET_PATHS.shootCrimsonWalking,
          label: 'Plate 01 — Gulnar Crimson Silk Kaftan',
        },
      ],
    },
  ];

  const postDrafts: InstagramPostDraft[] = [
    {
      id: 'post-draft-01',
      projectId: 'proj-autumn-festive',
      productId: 'prod-emerald-01',
      shootId: 'shoot-emerald-01',
      productTitle: 'The Emerald Zardozi Raw Silk Set',
      shortDescription:
        'Architectural tailoring meets heirloom tilla craftsmanship in deep forest raw silk, cut for luminous evening gatherings.',
      description:
        'Architectural tailoring meets heirloom tilla craftsmanship in deep forest raw silk, cut for luminous evening gatherings.',
      caption:
        'Where quiet architecture meets heirloom craft.\n\nCut from luminous Korean raw silk in a deep forest emerald, the Zardozi Kurta Set balances clean modern lines with antique gold tilla and hand-worked zardozi along the portrait neckline and cuffs. Designed to move effortlessly from sunlit courtyard soirées to intimate festive evenings.\n\nNow available for bespoke and standard sizing.',
      captionTone: 'Editorial Storytelling',
      hashtags: [
        '#AtelierNoor',
        '#PakistaniLuxuryPret',
        '#SouthAsianEditorial',
        '#RawSilkCouture',
        '#ZardoziCraft',
        '#ModernPakistaniFashion',
        '#FestiveEdit26',
        '#LahoreCouture',
      ],
      cta: 'Discover the piece via link in bio or request a private studio fitting.',
      aspectRatio: 'Instagram Portrait 4:5',
      carouselImageIds: ['img-gen-101', 'img-gen-102', 'img-gen-103'],
      selectedImages: ['img-gen-101', 'img-gen-102', 'img-gen-103'],
      coverImageId: 'img-gen-101',
      coverImage: 'img-gen-101',
      status: 'Draft',
      updatedAt: 'Today, 10:02 AM',
    },
  ];

  return {
    aiMode: envMode,
    projects,
    products,
    shoots,
    generatedImages,
    postDrafts,
  };
}

export class LocalFileStudioRepository implements IStudioRepository {
  private state: StudioDatabaseState;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.state = JSON.parse(raw) as StudioDatabaseState;
      } catch {
        this.state = createInitialSeedState();
        this.persist();
      }
    } else {
      this.state = createInitialSeedState();
      this.persist();
    }
  }

  private persist(): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist studio state:', err);
    }
  }

  async getState(): Promise<StudioDatabaseState> {
    return this.state;
  }

  async getAiMode(): Promise<AIMode> {
    return this.state.aiMode;
  }

  async setAiMode(mode: AIMode): Promise<AIMode> {
    this.state.aiMode = mode;
    this.persist();
    return this.state.aiMode;
  }

  async listProjects(): Promise<StudioProject[]> {
    return this.state.projects;
  }

  async getProject(id: string): Promise<StudioProject | null> {
    return this.state.projects.find((p) => p.id === id) || null;
  }

  async createProject(project: StudioProject): Promise<StudioProject> {
    this.state.projects = [project, ...this.state.projects.filter((p) => p.id !== project.id)];
    this.persist();
    return project;
  }

  async updateProject(id: string, patch: Partial<StudioProject>): Promise<StudioProject | null> {
    const idx = this.state.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.state.projects[idx] = {
      ...this.state.projects[idx],
      ...patch,
      updatedAt: patch.updatedAt || 'Just now',
    };
    this.persist();
    return this.state.projects[idx];
  }

  async listProducts(projectId?: string): Promise<CatalogueProduct[]> {
    if (!projectId) return this.state.products;
    return this.state.products.filter((p) => p.projectId === projectId);
  }

  async getProduct(id: string): Promise<CatalogueProduct | null> {
    return this.state.products.find((p) => p.id === id) || null;
  }

  async createProducts(newProducts: CatalogueProduct[]): Promise<CatalogueProduct[]> {
    this.state.products = [...newProducts, ...this.state.products];
    this.persist();
    return newProducts;
  }

  async updateProduct(id: string, patch: Partial<CatalogueProduct>): Promise<CatalogueProduct | null> {
    const idx = this.state.products.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.state.products[idx] = { ...this.state.products[idx], ...patch };
    this.persist();
    return this.state.products[idx];
  }

  async saveGarmentAnalysis(productId: string, analysis: GarmentAnalysis): Promise<CatalogueProduct | null> {
    return this.updateProduct(productId, { garmentAnalysis: analysis });
  }

  async listShoots(productId?: string): Promise<StudioShoot[]> {
    if (!productId) return this.state.shoots;
    return this.state.shoots.filter((s) => s.productId === productId);
  }

  async getShoot(id: string): Promise<StudioShoot | null> {
    return this.state.shoots.find((s) => s.id === id) || null;
  }

  async createShoot(shoot: StudioShoot): Promise<StudioShoot> {
    this.state.shoots = [shoot, ...this.state.shoots];
    // Also attach shootId to project
    const proj = this.state.projects.find((p) => p.id === shoot.projectId);
    if (proj && !proj.shootIds.includes(shoot.id)) {
      proj.shootIds.push(shoot.id);
      proj.updatedAt = 'Just now';
    }
    this.persist();
    return shoot;
  }

  async updateShoot(id: string, patch: Partial<StudioShoot>): Promise<StudioShoot | null> {
    const idx = this.state.shoots.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.state.shoots[idx] = { ...this.state.shoots[idx], ...patch };
    this.persist();
    return this.state.shoots[idx];
  }

  async listGeneratedImages(shootId?: string): Promise<GeneratedShootImage[]> {
    if (!shootId) return this.state.generatedImages;
    return this.state.generatedImages.filter((img) => img.shootId === shootId);
  }

  async getGeneratedImage(id: string): Promise<GeneratedShootImage | null> {
    return this.state.generatedImages.find((img) => img.id === id) || null;
  }

  async createGeneratedImage(image: GeneratedShootImage): Promise<GeneratedShootImage> {
    this.state.generatedImages = [image, ...this.state.generatedImages];
    // Also sync inside shoot.images
    const shoot = this.state.shoots.find((s) => s.id === image.shootId);
    if (shoot) {
      shoot.images = [image, ...shoot.images.filter((i) => i.id !== image.id)];
    }
    this.persist();
    return image;
  }

  async updateGeneratedImage(
    id: string,
    patch: Partial<GeneratedShootImage>
  ): Promise<GeneratedShootImage | null> {
    const idx = this.state.generatedImages.findIndex((img) => img.id === id);
    if (idx === -1) return null;
    const updated = { ...this.state.generatedImages[idx], ...patch };
    this.state.generatedImages[idx] = updated;

    const shoot = this.state.shoots.find((s) => s.id === updated.shootId);
    if (shoot) {
      shoot.images = shoot.images.map((i) => (i.id === id ? updated : i));
    }
    this.persist();
    return updated;
  }

  async deleteGeneratedImage(id: string): Promise<boolean> {
    const target = this.state.generatedImages.find((img) => img.id === id);
    if (!target) return false;
    this.state.generatedImages = this.state.generatedImages.filter((img) => img.id !== id);
    const shoot = this.state.shoots.find((s) => s.id === target.shootId);
    if (shoot) {
      shoot.images = shoot.images.filter((i) => i.id !== id);
    }
    this.persist();
    return true;
  }

  async listPosts(): Promise<InstagramPostDraft[]> {
    return this.state.postDrafts;
  }

  async createPost(post: InstagramPostDraft): Promise<InstagramPostDraft> {
    this.state.postDrafts = [post, ...this.state.postDrafts];
    this.persist();
    return post;
  }

  async updatePost(
    id: string,
    patch: Partial<InstagramPostDraft>
  ): Promise<InstagramPostDraft | null> {
    const idx = this.state.postDrafts.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.state.postDrafts[idx] = {
      ...this.state.postDrafts[idx],
      ...patch,
      updatedAt: 'Just now',
    };
    this.persist();
    return this.state.postDrafts[idx];
  }

  async deletePost(id: string): Promise<boolean> {
    const before = this.state.postDrafts.length;
    this.state.postDrafts = this.state.postDrafts.filter((p) => p.id !== id);
    this.persist();
    return this.state.postDrafts.length < before;
  }
}

export const studioRepository: IStudioRepository = new LocalFileStudioRepository();
