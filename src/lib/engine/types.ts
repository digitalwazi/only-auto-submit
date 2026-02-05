
export interface CampaignField {
    name: string;
    label: string;
    value: string;
    type?: string;
}

export interface EngineResult {
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'WARN';
    reason: string;
    screenshotPath?: string;
    submittedUrl?: string;
}

export interface PageFeatures {
    hasCaptcha: boolean;
    hasOverlay: boolean;
    hasWordPress: boolean;
}
