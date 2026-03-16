export type AppSettings = {
  taxRate: number; // e.g. 0.08 for 8%
  invoicePrefix: string; // e.g. "SALON-"
};

export const DEFAULT_SETTINGS: AppSettings = {
  taxRate: 0.08,
  invoicePrefix: "SALON-",
};

export const SETTINGS_STORAGE_KEY = "salon-spark:settings";

