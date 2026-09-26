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
