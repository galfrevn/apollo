export type RunLauncher = {
  launchBackgroundRun(params: {
    readonly prompt: string;
    readonly deviceId: string;
  }): Promise<void>;
  launchCodingRun(params: {
    readonly repository: string;
    readonly task: string;
    readonly deviceId: string;
  }): Promise<void>;
};
