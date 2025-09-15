// Define the structure of what getPowerStatus() returns
export interface PowerStatus {
    generation: {
        current: number;
    };
    consumption: {
        total: number;
    };
    summary: {
        netLoad: number;
        isGenerating: boolean;
        isConsuming: boolean;
    };
}

// Declare the class and its methods (like a C# interface)
export declare class EcoFlowAPI {
    constructor();
    
    // Methods from your actual ecoflow-api.js file
    flattenParams(params: any, prefix?: string): any;
    generateSignature(params: any, timestamp: number, nonce: string): string;
    getAuthHeaders(params?: any): any;
    getDevices(): Promise<any>;
    getDeviceAllQuotas(sn: string): Promise<any>;
    getDeviceQuotas(sn: string, quotas: any): Promise<any>;
    getDeviceQuotaForInverter(sn: string): Promise<any>;
    getDeviceQuotaFromPlugInWatts(sn: string): Promise<any>;
    testSignature(): Promise<void>;
    getPowerStatus(): Promise<PowerStatus>;
}

// Default export
export default EcoFlowAPI;