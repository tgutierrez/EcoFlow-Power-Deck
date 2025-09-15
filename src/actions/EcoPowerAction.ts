import streamDeck, { action, KeyDownEvent, KeyAction, DialAction, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";

import { EcoFlowAPI } from '../api/ecoflow-api';

@action({ UUID: "com.tomas-g.eco-power-deck.eco-power" })
export class EcoPowerAction extends SingletonAction<EcoPowerSettings> {
    private api: any;
    private pollInterval: NodeJS.Timeout | null = null;
    private isPolling: boolean = false;
    private currentActionHandler: KeyAction<EcoPowerSettings> | DialAction<EcoPowerSettings> | null = null;
    constructor() {
        super();
        try {
            this.api = new EcoFlowAPI();
        } catch (error) {
            streamDeck.logger.error(`Failed to initialize EcoFlow API: ${error}`);
        }
    }

    /**
     * Called when the action appears on the Stream Deck
     */
    override async onWillAppear(ev: WillAppearEvent<EcoPowerSettings>): Promise<void> {
        
        // Start polling if this is the first active context
        if (!this.isPolling) {
            this.startPolling(ev.payload.settings);
        }
        this.currentActionHandler = ev.action;

        // Get initial data
        await this.updatePowerData();
    }

    /**
     * Called when the action disappears from the Stream Deck
     */
    override async onWillDisappear(ev: WillDisappearEvent<EcoPowerSettings>): Promise<void> {
        this.isPolling = false;
        
        // Stop polling if no more active contexts
        if (!this.isPolling) {
            this.stopPolling();
        }
    }

    /**
     * Called when the key is pressed
     */
    override async onKeyDown(ev: KeyDownEvent<EcoPowerSettings>): Promise<void> {
        // Refresh data immediately when pressed - use ev.action.context
        this.currentActionHandler = ev.action;
        await this.updatePowerData();
    }

    override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<EcoPowerSettings>): Promise<void> {
        // Restart polling with new settings
        if (this.isPolling && ev.payload.settings) {
            this.isPolling = false;
            this.stopPolling();
            this.startPolling(ev.payload.settings);
        }
    }

    /**
     * Start polling for power data
     */
    private startPolling(settings: EcoPowerSettings): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.isPolling = true;
        // Poll every 30 seconds (adjust as needed)
        this.pollInterval = setInterval(async () => {
            await this.updatePowerData();
        }, (settings.pollInterval ?? 30) * 1000);

        streamDeck.logger.info("Started EcoFlow power polling");
    }

    /**
     * Stop polling for power data
     */
    private stopPolling(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        streamDeck.logger.info("Stopped EcoFlow power polling");
    }

    /**
     * Update power data for a specific context
     */
    private async updatePowerData(): Promise<void> {
        if (!this.api) {
            
            await streamDeck.ui.current?.action.setTitle("API Error");
            
            return;
        }

        try {
            const powerStatus = await this.api.getPowerStatus();
            
            // Update the button with SVG power info
            const svgContent = await this.formatPowerDisplay(powerStatus);
            //await this.currentActionHandler?.setTitle(svgContent);
            this.currentActionHandler?.setImage(`data:image/svg+xml,${encodeURIComponent(svgContent)}`);

            /*
            // Optionally update the button state based on generation/consumption
            if (powerStatus.summary.isGenerating && powerStatus.summary.netLoad < 0) {
                // Generating surplus power - show green state
                await streamDeck.ui.current?.action.setImage() .setState(context, 1);
            } else if (powerStatus.summary.isConsuming) {
                // Consuming power - show red state  
                await streamDeck.setState(context, 0);
            }
*/
            streamDeck.logger.info(`Updated power data: Gen=${powerStatus.generation.current}W, Load=${powerStatus.consumption.total}W`);

        } catch (error) {
            streamDeck.logger.error(`Failed to get power status: ${error}`);
            await this.currentActionHandler?.setTitle("Connection\nError");
        }
    }

    /**
     * Format power data for display on Stream Deck button - returns SVG
     */
    private async formatPowerDisplay(powerStatus: any): Promise<string> {
        const gen = (powerStatus.generation.current / 10).toFixed(1);
        const load = (powerStatus.consumption.total / 10).toFixed(1);
        const net = (powerStatus.summary.netLoad / 10).toFixed(1);
        const maxLoad = (((powerStatus.consumption.total / 10)/800)*100).toFixed(4); // Scale to fit 80px width
        // Inline SVG template (since bundled code can't easily read external files)
        const svgTemplate = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="roundedClip">
      <rect x="5" y="5" width="90" height="90" rx="10" ry="10"/>
    </clipPath>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2d2d2d;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect x="5" y="5" width="90" height="90" rx="10" ry="10" 
        fill="url(#bgGradient)" stroke="#444" stroke-width="2"/>
  
  <g clip-path="url(#roundedClip)">
    <g>
      <text x="5" y="45" fill="#ffd700" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
        ☀️: {{GEN}} W
      </text>
      <text x="5" y="60" fill="#00ff88" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
        ⚡: {{NET}} W
      </text>
      <text x="5" y="75" fill="#ff6b6b" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
        🔌: {{LOAD}} W
      </text>
    </g>
  </g>
  
  <!-- Status indicators -->
  <circle cx="15" cy="20" r="8" fill="#00ff88" opacity="0.8">
    <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite"/>
  </circle>
  
  <!-- Labels for clarity -->
  <text x="28" y="24" fill="#ccc" font-family="Arial, sans-serif" font-size="10">LIVE</text>
  
  <!-- Bottom status bar -->
  <rect x="10" y="88" width="80" height="4" rx="2" ry="2" fill="#333"/>
  <rect x="10" y="88" width="{{MAX_LOAD}}" height="4" rx="2" ry="2" fill="#00ff88" />
</svg>`;

        // Replace the template placeholders with actual data
        return svgTemplate
            .replace('{{GEN}}', gen)     // Solar generation
            .replace('{{NET}}', net)     // Net power
            .replace('{{LOAD}}', load)  // Load consumption
            .replace('{{MAX_LOAD}}', maxLoad);  // Load bar width
    }
}

/**
 * Settings for the EcoFlow power action
 */
type EcoPowerSettings = {
    pollInterval?: number; // Polling interval in seconds
};