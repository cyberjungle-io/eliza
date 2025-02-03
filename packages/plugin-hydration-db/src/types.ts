// Basic types needed for the plugin
export interface Content {
  text: string;
  action: string;
  [key: string]: any;
}

export interface Memory {
  user: string;
  content: Content;
  [key: string]: any;
}

export interface State {
  [key: string]: any;
}

export interface HandlerCallback {
  (response: any): Promise<void>;
}

export interface IAgentRuntime {
  [key: string]: any;
}

export interface Action {
  name: string;
  description: string;
  similes: string[];
  examples: Memory[][];
  validate: (runtime: IAgentRuntime, message: Memory) => Promise<boolean>;
  handler: (runtime: IAgentRuntime, message: Memory, state?: State, options?: any, callback?: HandlerCallback) => Promise<any>;
}

export interface Plugin {
  name: string;
  description: string;
  actions: Action[];
} 