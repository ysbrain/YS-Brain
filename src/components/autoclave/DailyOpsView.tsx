// src/components/autoclave/DailyOpsView.tsx

import type {
  DailyOpsFieldFocusHandler,
  DailyOpsOpenPicker,
  DailyOpsRegisterFieldRef,
} from '@/src/components/autoclave/DailyOpsCardTypes';
import { DailyOpsRunningCard } from '@/src/components/autoclave/DailyOpsRunningCard';
import { DailyOpsStartCard } from '@/src/components/autoclave/DailyOpsStartCard';
import type { DailyOpsController } from '@/src/hooks/autoclave/useDailyOpsController';
import React from 'react';

type DailyOpsViewProps = {
  controller: DailyOpsController;
  registerFieldRef: DailyOpsRegisterFieldRef;
  onFieldFocus: DailyOpsFieldFocusHandler;
  onFieldBlur: DailyOpsFieldFocusHandler;
  openPicker: DailyOpsOpenPicker;
  onOpenCamera: () => void;
  saving: boolean;
};

export function DailyOpsView({
  controller,
  registerFieldRef,
  onFieldFocus,
  onFieldBlur,
  openPicker,
  onOpenCamera,
  saving,
}: DailyOpsViewProps) {
  if (controller.isRunning) {
    return (
      <DailyOpsRunningCard
        controller={controller}
        registerFieldRef={registerFieldRef}
        onFieldFocus={onFieldFocus}
        onFieldBlur={onFieldBlur}
        openPicker={openPicker}
        onOpenCamera={onOpenCamera}
        saving={saving}
      />
    );
  }

  return (
    <DailyOpsStartCard
      controller={controller}
      registerFieldRef={registerFieldRef}
      onFieldFocus={onFieldFocus}
      onFieldBlur={onFieldBlur}
      openPicker={openPicker}
      saving={saving}
    />
  );
}
