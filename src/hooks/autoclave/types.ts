// src/hooks/autoclave/types.ts

export type SetupStoredValue = string | number;

export type SetupStoredItem = {
  field?: string;
  value?: SetupStoredValue;
};

export type ApplianceDocShape = {
  applianceKey?: string;
  applianceName?: string;
  typeKey?: string;
  typeName?: string;
  setup?: Record<string, SetupStoredItem | undefined>;
  lastCycle?: {
    cycleNumber?: number;
    dateExecuted?: string;
  };
  _status?: {
    isRunning?: boolean;
    currentCycle?: string;
  };
};

export type DailyOpsCycleDoc = {
  _isFinished?: boolean;
  createdAt?: unknown;
  settings?: {
    temperature?: number;
    pressure?: number;
  };
  cycleBeginTime?: string;
  cycleBeganBy?: {
    userId?: string;
    userName?: string | null;
  };
};
