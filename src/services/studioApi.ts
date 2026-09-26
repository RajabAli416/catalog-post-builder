import {
  AIMode,
  BackgroundType,
  CataloguePagePlate,
  CatalogueProduct,
  GarmentAnalysis,
  GeneratedShootImage,
  InstagramPostDraft,
  ShootConfiguration,
  ShootStyleId,
  ShotPoseType,
  StudioProject,
  StudioRuntimeStatus,
  StudioShoot,
} from '../types/studio';

export interface BootstrapResponse {
  aiMode: AIMode;
  projects: StudioProject[];
  products: CatalogueProduct[];
  shoots: StudioShoot[];
  generatedImages: GeneratedShootImage[];
  postDrafts: InstagramPostDraft[];
  runtime: StudioRuntimeStatus;
}

export async function fetchBootstrapState(): Promise<BootstrapResponse> {
  const res = await fetch('/api/bootstrap');
  if (!res.ok) {
    throw new Error('Failed to load studio state from server.');
  }
  return res.json();
}

export async function setRuntimeAiMode(
  aiMode: AIMode
): Promise<StudioRuntimeStatus> {
  const res = await fetch('/api/settings/mode', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aiMode }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update AI mode.');
  }
  return data;
}

export async function uploadCatalogueToServer(params: {
  projectId: string;
  projectName: string;
  sourceType: 'Catalogue PDF' | 'Garment Images';
  files?: File[];
  fallbackFileNames?: string[];
}): Promise<{
  project: StudioProject;
  products: CatalogueProduct[];
  pages: CataloguePagePlate[];
}> {
  const formData = new FormData();
  formData.append('projectName', params.projectName);
  formData.append('sourceType', params.sourceType);

  if (params.files && params.files.length > 0) {
    params.files.forEach((f) => formData.append('files', f));
  } else if (params.fallbackFileNames && params.fallbackFileNames.length > 0) {
    formData.append('fileName', params.fallbackFileNames[0]);
  }

  const res = await fetch(`/api/projects/${encodeURIComponent(params.projectId)}/catalogue`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Catalogue upload and extraction failed.');
  }
  return data;
}

export async function manualExtractProductFromPage(
  projectId: string,
  payload: {
    name: string;
    sku: string;
    category: string;
    fabricDetails: string;
    sourcePage: number;
    croppedDataUrl: string;
  }
): Promise<CatalogueProduct> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/manual-extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Manual product crop extraction failed.');
  }
  return data;
}

export async function analyzeProductGarmentApi(productId: string): Promise<{
  product: CatalogueProduct;
  garmentAnalysis: GarmentAnalysis;
}> {
  const res = await fetch(`/api/products/${encodeURIComponent(productId)}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Garment analysis failed.');
  }
  return data;
}

export async function createAndStartShootApi(
  productId: string,
  config: ShootConfiguration
): Promise<StudioShoot> {
  const createRes = await fetch(
    `/api/products/${encodeURIComponent(productId)}/shoots`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    }
  );
  const createdShoot = await createRes.json();
  if (!createRes.ok) {
    throw new Error(createdShoot.error || 'Failed to create shoot.');
  }

  const genRes = await fetch(
    `/api/shoots/${encodeURIComponent(createdShoot.id)}/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  const genData = await genRes.json();
  if (!genRes.ok) {
    throw new Error(genData.error || 'Failed to start shoot generation.');
  }
  return genData.shoot || createdShoot;
}

export async function pollShootStatusApi(shootId: string): Promise<{
  shoot: StudioShoot;
  garmentAnalysis: GarmentAnalysis | null;
}> {
  const res = await fetch(`/api/shoots/${encodeURIComponent(shootId)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to poll shoot status.');
  }
  return data;
}

export interface RegenerateImageOverrides {
  promptNotes?: string;
  shotType?: ShotPoseType;
  style?: ShootStyleId;
  background?: BackgroundType;
}

export async function regenerateSingleImageApi(
  imageId: string,
  overrides: RegenerateImageOverrides = {}
): Promise<GeneratedShootImage> {
  const res = await fetch(
    `/api/generated-images/${encodeURIComponent(imageId)}/regenerate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to regenerate image.');
  }
  return data;
}

export async function deleteGeneratedImageApi(imageId: string): Promise<void> {
  const res = await fetch(
    `/api/generated-images/${encodeURIComponent(imageId)}`,
    {
      method: 'DELETE',
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete generated image.');
  }
}

export async function generateInstagramCopyApi(params: {
  productId: string;
  tone: InstagramPostDraft['captionTone'];
  style: string;
}): Promise<{
  productTitle: string;
  shortDescription: string;
  caption: string;
  hashtags: string[];
  cta: string;
}> {
  const res = await fetch('/api/posts/generate-copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate Instagram copy.');
  }
  return data;
}

export async function saveInstagramPostApi(
  draft: Omit<InstagramPostDraft, 'id' | 'updatedAt'>
): Promise<InstagramPostDraft> {
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save Instagram post draft.');
  }
  return data;
}

export async function deleteInstagramPostApi(postId: string): Promise<void> {
  const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to delete post draft.');
  }
}

export function generateOriginalEditorialCopy(
  product: CatalogueProduct,
  tone: InstagramPostDraft['captionTone'],
  style: string
): {
  productTitle: string;
  shortDescription: string;
  caption: string;
  hashtags: string[];
  cta: string;
} {
  const isIvory = product.name.toLowerCase().includes('ivory');
  const isCrimson = product.name.toLowerCase().includes('crimson');

  const cleanTitle = isIvory
    ? 'The Chandi Ivory Organza Ensemble'
    : isCrimson
    ? 'The Gulnar Crimson Silk Kaftan'
    : 'The Zardozi Emerald Raw Silk Edit';

  const shortDescription = isIvory
    ? 'Weightless woven silk organza illuminated with hand-embroidered silver resham florals and delicate freshwater pearl accents.'
    : isCrimson
    ? 'Fluid crimson matka silk tailored in a relaxed resort kaftan silhouette with artisanal antique gold marori borders.'
    : 'Architectural raw silk tailoring in deep forest emerald, finished with heirloom gold tilla and zardozi work at the neckline and cuffs.';

  const captionsByTone: Record<InstagramPostDraft['captionTone'], string> = {
    'Editorial Storytelling': `Light, shadow, and the quiet permanence of handcraft.\n\nReimagined for our ${style} story, ${cleanTitle} pairs architectural drape with intricate South Asian surface artistry. Every metallic thread is placed to catch natural twilight without overwhelming the silhouette—crafted for women who collect pieces with lasting presence.`,
    'Minimalist Luxury': `${cleanTitle}.\n\nPure textile integrity meets restrained embellishment. Tailored for an effortless fall and finished by hand in our studio, designed to transition seamlessly from sunlit courtyard gatherings to formal evening receptions.`,
    'Festive Heritage': `Celebrating timeless South Asian craft in a contemporary frame.\n\n${cleanTitle} honors classical zardozi and resham techniques on luminous woven silk—bringing warmth, poise, and heirloom grace to the festive season.`,
    'Boutique Launch': `New in Studio — ${cleanTitle}.\n\nOur latest limited-edition release is now open for orders. Thoughtfully proportioned for movement and photographed in our ${style.toLowerCase()} campaign setting.`,
  };

  const baseHashtags = [
    '#AtelierNoor',
    '#PakistaniFashionEditorial',
    '#SouthAsianLuxury',
    '#ModernHeirloom',
    '#LuxuryPretPakistan',
    '#ArtisanalEmbroidery',
    '#EditorialLookbook',
    isIvory ? '#OrganzaCouture' : isCrimson ? '#SilkKaftanEdit' : '#RawSilkZardozi',
  ];

  return {
    productTitle: cleanTitle,
    shortDescription,
    caption: captionsByTone[tone],
    hashtags: baseHashtags,
    cta: 'Explore bespoke & standard sizing via the link in bio, or message our studio concierge.',
  };
}
