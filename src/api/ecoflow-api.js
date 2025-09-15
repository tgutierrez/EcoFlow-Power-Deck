import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export class EcoFlowAPI {
    constructor() {
        this.accessKey = process.env.ECOFLOW_ACCESS_KEY;
        this.secretKey = process.env.ECOFLOW_SECRET_KEY;
        this.baseURL = process.env.ECOFLOW_BASE_URL || 'https://api-a.ecoflow.com/iot-open';
        
        if (!this.accessKey || !this.secretKey) {
            throw new Error('EcoFlow API credentials not found. Please set ECOFLOW_ACCESS_KEY and ECOFLOW_SECRET_KEY environment variables.');
        }
    }

    // Flatten nested parameters according to EcoFlow specs
    flattenParams(params, prefix = '') {
        const result = {};
        
        for (const [key, value] of Object.entries(params)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            
            if (value === null || value === undefined) {
                continue;
            }
            
            if (Array.isArray(value)) {
                // Handle arrays: key[0]=value1&key[1]=value2
                value.forEach((item, index) => {
                    if (typeof item === 'object' && item !== null) {
                        // Array of objects
                        Object.assign(result, this.flattenParams(item, `${newKey}[${index}]`));
                    } else {
                        // Array of primitives
                        result[`${newKey}[${index}]`] = item;
                    }
                });
            } else if (typeof value === 'object' && value !== null) {
                // Handle nested objects: key.subkey=value
                Object.assign(result, this.flattenParams(value, newKey));
            } else {
                // Handle primitives
                result[newKey] = value;
            }
        }
        
        return result;
    }

    // Generate signature according to EcoFlow documentation
    generateSignature(params, timestamp, nonce) {
        // Step 1 & 2: Flatten parameters first
        const flatParams = this.flattenParams(params);
        
        // Sort the request parameters first (excluding auth params)
        const requestKeys = Object.keys(flatParams).sort();
        const requestPairs = requestKeys.map(key => `${key}=${flatParams[key]}`);
        
        // Step 3: Add auth parameters in the specific order shown in documentation
        const authPairs = [
            `accessKey=${this.accessKey}`,
            `nonce=${nonce}`,
            `timestamp=${timestamp}`
        ];
        
        // Combine: request params first, then auth params
        const allPairs = [...requestPairs, ...authPairs];
        const stringToSign = allPairs.join('&');
        
        // Step 4 & 5: HMAC-SHA256 and convert to hex
        const signature = crypto.createHmac('sha256', this.secretKey)
            .update(stringToSign, 'utf8')
            .digest('hex');
        
        return signature;
    }

    // Generate authentication headers
    getAuthHeaders(params = {}) {
        const timestamp = Date.now(); // Use milliseconds as shown in example
        const nonce = Math.floor(Math.random() * 1000000).toString(); // Simple numeric nonce
        const signature = this.generateSignature(params, timestamp, nonce);

        return {
            'accessKey': this.accessKey,
            'nonce': nonce,
            'timestamp': timestamp.toString(),
            'sign': signature,
            'Content-Type': 'application/json;charset=UTF-8'
        };
    }

    // Get list of devices
    async getDevices() {
        try {
            // Try different possible endpoints
            const possibleEndpoints = [
                '/sign/device/list',
            ];
            
            for (const uri of possibleEndpoints) {
                try {
                    const params = {}; // Empty params for device list
                    const headers = this.getAuthHeaders(params);
                    // remove content-type for GET
                    delete headers['Content-Type'];
                    const response = await axios.get(this.baseURL + uri, { headers, params });
                    return response.data;
                } catch (error) {
                    // If this is the last endpoint, throw the error
                    if (uri === possibleEndpoints[possibleEndpoints.length - 1]) {
                        throw error;
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching devices:', error.message);
            throw error;
        }
    }

    async getDeviceAllQuotas(sn) {
        try {
            const uri = '/sign/device/quota/all';
            const params = {
                sn: sn
            };
            const headers = this.getAuthHeaders(params);
            delete headers['Content-Type'];
            const response = await axios.get(this.baseURL + uri, { headers, params });

            return response.data;
        } catch (error) {
            console.error(`Error fetching device quota ${sn}:`, error.message);
            throw error;
        }

    }

    async getDeviceQuotas(sn, quotas) {
        try {
            const uri = '/sign/device/quota';
            const params = {
                sn: sn,
                params: {
                    quotas: quotas
                }
            };
            const headers = this.getAuthHeaders(params);
            const response = await axios.post(this.baseURL + uri, params, { headers });

            return response.data;
        } catch (error) {
            console.error(`Error fetching device quota ${sn}:`, error.message);
            throw error;
        }

    }


    // Get device details by ID (example with parameters)
    async getDeviceQuotaForInverter(sn) {
        try {
            const uri = '/sign/device/quota';
            // const params = {
            //     sn: sn
            // };
            let params = {
                "sn": sn,
                "params": {
                    "quotas": [
                        "20_1.geneWatt",
                        "20_1.permanentWatts",
                        "20_1.floadLimitOut",
                        "20_1.consWatt",
                        "20_1.pvToInvWatts"
                    ]
                }
            }

            
            const headers = this.getAuthHeaders(params);
            const response = await axios.post(this.baseURL + uri, params, { headers });
            
            return response.data;
        } catch (error) {
            console.error(`Error fetching device quota ${sn}:`, error.message);
            throw error;
        }
    }

    // Get device details by ID (example with parameters)
    async getDeviceQuotaFromPlugInWatts(sn) {
        try {
            const uri = '/sign/device/quota';
            let params = {
                "sn": sn,
                "params": {
                    "quotas": [
                        "2_1.watts"
                    ]
                }
            }
            const headers = this.getAuthHeaders(params);
            const response = await axios.post(this.baseURL + uri, params, { headers });

            return response.data;
        } catch (error) {
            console.error(`Error fetching device quota ${sn}:`, error.message);
            throw error;
        }
    }

    // Test signature generation with the example from documentation
    async testSignature() {
        console.log('Testing signature generation with documentation example...');
        
        // Test data from documentation
        const testAccessKey = 'Fp4SvIprYSDPXtYJidEtUAd1o';
        const testSecretKey = 'WIbFEKre0s6sLnh4ei7SPUeYnptHG6V';
        const testNonce = '345164';
        const testTimestamp = '1671171709428';
        
        const testParams = {
            sn: '123456789',
            params: {
                cmdSet: 11,
                id: 24,
                eps: 0
            }
        };

        // Manually create the exact string from documentation to test
        const expectedStringToSign = 'params.cmdSet=11&params.eps=0&params.id=24&sn=123456789&accessKey=Fp4SvIprYSDPXtYJidEtUAd1o&nonce=345164&timestamp=1671171709428';
        
        console.log('Expected string to sign:', expectedStringToSign);
        
        // Test with exact string
        const testSignature = crypto.createHmac('sha256', testSecretKey)
            .update(expectedStringToSign, 'utf8')
            .digest('hex');
        
        const expectedSignature = '07c13b65e037faf3b153d51613638fa80003c4c38d2407379a7f52851af1473e';
        
        console.log('Direct test signature:', testSignature);
        console.log('Expected signature:', expectedSignature);
        console.log('Direct test match:', testSignature === expectedSignature ? '✅ PASS' : '❌ FAIL');

        // Temporarily use test credentials
        const originalAccessKey = this.accessKey;
        const originalSecretKey = this.secretKey;
        
        this.accessKey = testAccessKey;
        this.secretKey = testSecretKey;
        
        // Generate signature with test data
        const signature = this.generateSignature(testParams, testTimestamp, testNonce);
        
        // Restore original credentials
        this.accessKey = originalAccessKey;
        this.secretKey = originalSecretKey;
        
        console.log('Our generated signature:', signature);
        console.log('Our signature match:', signature === expectedSignature ? '✅ PASS' : '❌ FAIL');
        
        return signature === expectedSignature;
    }

    // Main business logic - get power status
    async getPowerStatus() {
        const devices = await this.getDevices();
        
        if (!devices || !devices.data || devices.data.length === 0) {
            throw new Error('No devices found for the account.');
        }

        const inverter = devices.data.filter(device => device.productName === 'PowerStream').map(device => device.sn)[0];
        const smartPlugs = devices.data.filter(device => device.productName === 'Smart Plug').map(device => device.sn);

        if (!inverter) {
            throw new Error('No PowerStream inverter found for the account.');
        }

        const inverterConsumption = await this.getDeviceQuotaForInverter(inverter);

        const currentGeneration = inverterConsumption.data["20_1.geneWatt"] || 0;
        const solarToPV = inverterConsumption.data["20_1.pvToInvWatts"] || 0;
        const currentLoadReportedByInverter = inverterConsumption.data["20_1.consWatt"] || 0;
        const currentOutputLimit = inverterConsumption.data["20_1.floadLimitOut"] || 0;
        const permanentWatt = inverterConsumption.data["20_1.permanentWatts"] || 0;
        
        let plugConsumption = [];

        for (const sn of smartPlugs) {
            try {
                const plugData = await this.getDeviceQuotaFromPlugInWatts(sn);
                plugConsumption.push(plugData.data["2_1.watts"] || 0);
            } catch (error) {
                console.warn(`Failed to get consumption for plug ${sn}:`, error.message);
                plugConsumption.push(0);
            }
        }

        const plugTotalConsumption = plugConsumption.reduce((acc, watts) => acc + watts, 0);
        const currentLoad = permanentWatt + plugTotalConsumption;
        const netLoad = currentLoad - currentGeneration;

        return {
            timestamp: new Date().toISOString(),
            generation: {
            current: currentGeneration,
            unit: "W"
            },
            consumption: {
            reportedByInverter: currentLoadReportedByInverter,
            permanentWatt: permanentWatt,
            smartPlugs: plugTotalConsumption,
            total: currentLoad,
            unit: "W"
            },
            inverter: {
            outputLimit: currentOutputLimit,
            serialNumber: inverter,
            unit: "W"
            },
            smartPlugs: smartPlugs.map((sn, index) => ({
            serialNumber: sn,
            consumption: plugConsumption[index] || 0,
            unit: "W"
            })),
            summary: {
            netLoad: netLoad,
            isGenerating: currentGeneration > 1,
            isConsuming: currentLoad > 0,
            unit: "W",
            summaryMessage: `☀️: ${(solarToPV/10).toFixed(1).padEnd(5)} W\n⚡: ${(currentGeneration/10).toFixed(1).padEnd(5)} W\n🔌: ${(currentLoad/10).toFixed(1).padEnd(5)} W`
            }
        };
    }
}

export default EcoFlowAPI;