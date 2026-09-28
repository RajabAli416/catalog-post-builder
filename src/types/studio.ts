export type NavigationTab =
  | 'dashboard'
  | 'new-project'
  | 'workspace'
  | 'generating'
  | 'shoot-gallery'
  | 'post-builder'
  | 'projects'
  | 'products'
  | 'shoots'
  | 'posts'
  | 'settings';

export type AIMode = 'mock' | 'live';

export type ShootStyleId =
  | 'Luxury Editorial'
  | 'Minimal Studio'
  | 'Outdoor Lifestyle'
  | 'Boutique Catalogue'
  | 'Festive'
  | 'Modern Pakistani Fashion';

export type ShotPoseType =
  | 'Full body'
  | '3/4 standing'
  | 'Walking'
  | 'Seated'
  | 'Detail portrait'
  | 'Back/side angle'
  | 'Sleeve close-up'
  | 'Neckline close-up'
  | 'Embroidery close-up'
  | 'Print / pattern close-up'
  | 'Dupatta close-up'
  | 'Fabric texture'
  | 'Cuff / border detail'
  | 'Trouser detail';

export type BackgroundType =
  | 'Studio'
  | 'Luxury interior'
  | 'Minimal architectural'
  | 'Outdoor'
  | 'Custom';

export type AspectRatioType =
  | 'Instagram Portrait 4:5'
  | 'Square 1:1'
  | 'Story 9:16';

export interface GarmentAnalysis {
  garmentCategory: string;
  shirtKameezDesign: string;
  trousersShawlDupatta: string;
  dominantColors: string[];
  secondaryColors: string[];
  printPattern: string;
  embroidery: string;
  neckline: string;
  sleeves: string;
  borders: string;
  motifs: string;
  fabricAppearance: string;
  importantVisualDetails: string[];
  immutableElements: string[];
  analyzedAt: string;
  modeUsed: AIMode;
}

export interface ModelConfiguration {
  aiGenerated: boolean;
  gender: 'Female';
  modelStyle: 'Pakistani / South Asian';
  personaName: string;
  ageRange: '20–24' | '25–29' | '30–35';
  skinComplexion: 'Warm Olive' | 'Golden Honey' | 'Rich Caramel' | 'Porcelain Ivory';
  hairStyling: 'Sleek Center-Part Bun' | 'Soft Editorial Waves' | 'Traditional Braided' | 'Minimal Pulled Back';
  stylingAccent: 'Minimal Gold Studs' | 'Heritage Jhumkas' | 'No Jewelry' | 'Sculptural Cuff';
}

export interface ShootConfiguration {
  model: ModelConfiguration;
  shootStyle: ShootStyleId;
  poses: ShotPoseType[];
  background: BackgroundType;
  customBackgroundNote: string;
  aspectRatio: AspectRatioType;
  numberOfImages: number;
}

export interface CataloguePagePlate {
  pageNumber: number;
  imageUrl: string;
  label: string;
  detectedRegions?: Array<{
    id: string;
    label: string;
    sku: string;
    cropBox: { x: number; y: number; width: number; height: number };
  }>;
}

export interface CatalogueProduct {
  id: string;
  projectId: string;
  sku: string;
  name: string;
  category: string;
  fabricDetails: string;
  rawCatalogueText: string;
  garmentImageUrl: string;
  referenceImage: string; // Phase 2A canonical field
  sourcePage: number; // Phase 2A canonical field
  detectedPage?: number;
  garmentAnalysis?: GarmentAnalysis | null; // Phase 2C structured analysis
  selected: boolean;
  createdAt: string;
  generatedCount: number;
}

export type GenerationStageStatus =
  | 'Queued'
  | 'Analyzing garment'
  | 'Generating'
  | 'Processing'
  | 'Complete'
  | 'Failed';

export interface ShootShotJob {
  id: string;
  shootId: string;
  shotType: ShotPoseType;
  status: GenerationStageStatus;
  imageId?: string;
  error?: string;
}

export interface GeneratedShootImage {
  id: string;
  shootId: string;
  productId: string;
  projectId: string;
  imageUrl: string;
  garmentReferenceUrl: string;
  productName: string;
  productSku: string;
  shotType: ShotPoseType;
  modelSummary: string;
  style: ShootStyleId;
  background: BackgroundType;
  aspectRatio: AspectRatioType;
  status: 'Queued' | 'Generating' | 'Ready' | 'Regenerating' | 'Refined' | 'Failed';
  promptNotes: string;
  masterPromptUsed?: string;
  cropVariant?: 'full' | 'three-quarter' | 'detail' | 'walking' | 'seated' | 'angle';
  selectedForPost: boolean;
  createdAt: string;
  errorMessage?: string;
}

export interface StudioShoot {
  id: string;
  projectId: string;
  productId: string;
  productName: string;
  productSku: string;
  garmentImageUrl: string;
  style: ShootStyleId; // Phase 2A
  modelSettings: ModelConfiguration; // Phase 2A
  shotSettings: {
    poses: ShotPoseType[];
    background: BackgroundType;
    customBackgroundNote: string;
    numberOfImages: number;
  }; // Phase 2A
  aspectRatio: AspectRatioType; // Phase 2A
  status: GenerationStageStatus; // Phase 2A
  errorMessage?: string;
  pipelineBusyUntil?: number;
  jobs: ShootShotJob[];
  config: ShootConfiguration;
  images: GeneratedShootImage[];
  createdAt: string;
}

export interface InstagramPostDraft {
  id: string;
  projectId: string;
  productId: string;
  shootId: string;
  productTitle: string;
  shortDescription: string;
  description: string; // Phase 2A alias
  caption: string;
  captionTone: 'Editorial Storytelling' | 'Minimalist Luxury' | 'Festive Heritage' | 'Boutique Launch';
  hashtags: string[];
  cta: string;
  copyPromptUsed?: string;
  aspectRatio: 'Instagram Portrait 4:5';
  carouselImageIds: string[];
  selectedImages: string[]; // Phase 2A alias
  coverImageId: string;
  coverImage: string; // Phase 2A alias
  status: 'Draft' | 'Ready to Publish';
  updatedAt: string;
}

export interface StudioProject {
  id: string;
  name: string;
  seasonCode: string;
  sourceType: 'Catalogue PDF' | 'Garment Images';
  sourceFileName: string;
  status: 'active' | 'processing' | 'completed' | 'archived'; // Phase 2A
  createdAt: string;
  updatedAt: string;
  productIds: string[];
  shootIds: string[];
  coverImageUrl: string;
  pages?: CataloguePagePlate[];
}

export interface StudioRuntimeStatus {
  aiMode: AIMode;
  envAiMode: AIMode;
  hasGeminiApiKey: boolean;
  imageModel: string;
  visionModel: string;
  textModel: string;
  storageMode: 'vercel-blob' | 'local-disk' | 'ephemeral';
}
