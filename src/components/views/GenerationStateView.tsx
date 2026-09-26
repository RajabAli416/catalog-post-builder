import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  CatalogueProduct,
  GenerationStageStatus,
  ShootConfiguration,
  StudioShoot,
} from '../../types/studio';
import { pollShootStatusApi } from '../../services/studioApi';
import { FashionImage } from '../common/FashionImage';

interface GenerationStateViewProps {
  product: CatalogueProduct;
  config: ShootConfiguration;
  activeShoot: StudioShoot | null;
  onShootUpdated: (shoot: StudioShoot) => void;
  onComplete: (shoot: StudioShoot) => void;
  onRetry?: () => void;
  onCancel: () => void;
}

const PIPELINE_STAGES: Array<{
  status: GenerationStageStatus;
  label: string;
  detail: string;
}> = [
  {
    status: 'Queued',
    label: 'Queued',
    detail: 'Initializing separate shot jobs & locking source garment reference plate.',
  },
  {
    status: 'Analyzing garment',
    label: 'Analyzing garment',
    detail: 'Extracting structured JSON garment geometry, dominant palette, embroidery & immutable details.',
  },
  {
    status: 'Generating',
    label: 'Generating',
    detail: 'Executing independent Gemini image-generation requests per pose specification.',
  },
  {
    status: 'Processing',
    label: 'Processing',
    detail: 'Validating output plates and associating frames with Shoot & Product records.',
  },
  {
    status: 'Complete',
    label: 'Complete',
    detail: 'All requested shot jobs finalized and stored in the Shoot Gallery.',
  },
];

const STAGE_ORDER: GenerationStageStatus[] = [
  'Queued',
  'Analyzing garment',
  'Generating',
  'Processing',
  'Complete',
];

export const GenerationStateView: React.FC<GenerationStateViewProps> = ({
  product,
  config,
  activeShoot,
  onShootUpdated,
  onComplete,
  onRetry,
  onCancel,
}) => {
  const [polledShoot, setPolledShoot] = useState<StudioShoot | null>(activeShoot);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    setPolledShoot(activeShoot);
  }, [activeShoot]);

  useEffect(() => {
    if (!activeShoot?.id) return;

    let cancelled = false;
    const startTime = Date.now();

    const poll = async (): Promise<boolean> => {
      try {
        if (Date.now() - startTime > 10 * 60 * 1000) {
          setNetworkError(
            'Generation is taking longer than expected. You can retry the live Gemini shoot.'
          );
          return false;
        }

        const { shoot } = await pollShootStatusApi(activeShoot.id);
        if (cancelled) return false;

        setPolledShoot(shoot);
        onShootUpdated(shoot);

        if (shoot.status === 'Complete') {
          setTimeout(() => {
            if (!cancelled) onComplete(shoot);
          }, 400);
          return false;
        }
        if (shoot.status === 'Failed') return false;
        return true;
      } catch (err: unknown) {
        if (!cancelled) {
          setNetworkError(
            err instanceof Error
              ? err.message
              : 'Error communicating with backend generation service.'
          );
        }
        return false;
      }
    };

    const run = async () => {
      while (!cancelled) {
        const keepGoing = await poll();
        if (!keepGoing || cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [activeShoot?.id]);

  const currentStatus: GenerationStageStatus =
    polledShoot?.status || 'Queued';
  const currentStageIdx = Math.max(0, STAGE_ORDER.indexOf(currentStatus));
  const isFailed = currentStatus === 'Failed' || Boolean(networkError);
  const errorMessage =
    networkError ||
    polledShoot?.errorMessage ||
    'Generation encountered an API error.';

  const jobs = polledShoot?.jobs || [];
  const completedJobCount = jobs.filter((j) => j.status === 'Complete').length;

  return (
    <div className="py-6 md:py-10 max-w-5xl mx-auto">
      <div className="bg-white border border-[#E2DFD7] p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Large Garment Preview */}
        <div className="lg:col-span-5">
          <div className="border border-[#E2DFD7] bg-[#FAF9F5] p-3">
            <FashionImage
              src={product.garmentImageUrl}
              alt={product.name}
              aspectClass="aspect-[3/4]"
              cropVariant="full"
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#6E6B62]">
            <span className="font-mono">{product.sku}</span>
            <span>{product.name}</span>
          </div>
        </div>

        {/* Right: Real Backend Stage Progression & Per-Shot Job Tree */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#6E6B62]">
              <span>Backend Generation Pipeline</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {completedJobCount} of {jobs.length || config.numberOfImages} Shot Jobs Complete ·{' '}
                {config.aspectRatio}
              </span>
            </div>
            <h1 className="font-editorial text-3xl md:text-4xl font-semibold text-[#141413] mt-1">
              {isFailed
                ? 'Generation Interrupted'
                : `Composing ${config.shootStyle} Shoot`}
            </h1>
            <p className="mt-1.5 text-sm text-[#57554E]">
              Model: {config.model.personaName} · Setting: {config.background}
            </p>
          </div>

          {/* Indeterminate Loading State (No Fake Percentages — Phase 2F) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#141413]">
                STAGE: {currentStatus.toUpperCase()}
              </span>
              <span className="text-[#6E6B62] tabular-nums">
                {completedJobCount}/{jobs.length || config.numberOfImages} shots finished
              </span>
            </div>
            <div className="h-1.5 w-full bg-[#E6E4DD] overflow-hidden relative">
              {isFailed ? (
                <div className="h-full w-full bg-[#991B1B]" />
              ) : currentStatus === 'Complete' ? (
                <div className="h-full w-full bg-[#16A34A]" />
              ) : (
                <div className="h-full w-2/5 bg-[#141413] animate-pulse mx-auto" />
              )}
            </div>
          </div>

          {/* Error Banner with Actionable Recovery */}
          {isFailed && (
            <div className="bg-[#FEF2F2] border border-[#DC2626] p-4 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-[#991B1B]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">
                    Generation Pipeline Error
                  </span>
                  <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
              {onRetry && (
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry live shoot
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Phase 2E: Separate Shot Jobs Tree */}
          {jobs.length > 0 && (
            <div className="bg-[#FAF9F5] border border-[#E6E4DD] p-4 space-y-2.5">
              <span className="block text-[11px] font-mono text-[#6E6B62]">
                MULTI-SHOT ASYNC GENERATION JOBS ({jobs.length} INDEPENDENT REQUESTS)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {jobs.map((job, idx) => (
                  <div
                    key={job.id}
                    className="p-2.5 bg-white border border-[#E2DFD7] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-[#78756C]">
                        0{idx + 1}
                      </span>
                      <span className="font-medium text-[#141413] truncate">
                        {job.shotType}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-[11px] shrink-0 ${
                        job.status === 'Complete'
                          ? 'text-[#16A34A]'
                          : job.status === 'Failed'
                          ? 'text-[#991B1B]'
                          : 'text-[#141413]'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5 Backend Pipeline Stages List (Queued -> Analyzing garment -> Generating -> Processing -> Complete) */}
          <div className="border border-[#E6E4DD] divide-y divide-[#E6E4DD] bg-[#FAF9F5]">
            {PIPELINE_STAGES.map((stage, idx) => {
              const isDone =
                currentStatus === 'Complete' ||
                (!isFailed && idx < currentStageIdx);
              const isCurrent =
                !isFailed &&
                idx === currentStageIdx &&
                currentStatus !== 'Complete';

              return (
                <div
                  key={stage.status}
                  className={`p-3.5 flex items-start gap-3.5 transition-colors ${
                    isCurrent ? 'bg-white' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <div className="w-5 h-5 bg-[#141413] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-5 h-5 border border-[#141413] flex items-center justify-center">
                        <Loader2 className="w-3 h-3 text-[#141413] animate-spin" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 border border-[#D6D3C9] flex items-center justify-center text-[10px] font-mono text-[#78756C]">
                        0{idx + 1}
                      </div>
                    )}
                  </div>

                  <div>
                    <h2
                      className={`text-sm font-medium ${
                        isDone || isCurrent ? 'text-[#141413]' : 'text-[#78756C]'
                      }`}
                    >
                      {stage.label}
                    </h2>
                    <p className="text-xs text-[#6E6B62] mt-0.5 leading-relaxed">
                      {stage.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="pt-2 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-[#57554E] hover:text-[#141413] transition-colors whitespace-nowrap"
            >
              Return to Workspace
            </button>

            {polledShoot && polledShoot.images.length > 0 && (
              <button
                type="button"
                onClick={() => onComplete(polledShoot)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#141413] bg-white border border-[#D6D3C9] hover:border-[#141413] transition-colors whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                View Completed Frames ({polledShoot.images.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
