'use client';

import { ReactNode } from 'react';
import SectionCard, { SectionMode } from './SectionCard';

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  summary?: ReactNode;
  modes?: SectionMode[];
  currentMode?: string;
  onModeChange?: (mode: string) => void;
}

export default function ChartCard({ 
  title, 
  description, 
  children, 
  action, 
  className = '',
  collapsible = false,
  defaultExpanded = true,
  summary,
  modes,
  currentMode,
  onModeChange
}: ChartCardProps) {
  return (
    <SectionCard 
      title={title} 
      action={action} 
      className={className} 
      collapsible={collapsible} 
      defaultExpanded={defaultExpanded}
      summary={summary}
      modes={modes}
      currentMode={currentMode}
      onModeChange={onModeChange}
    >
      {description && (
        <p className="text-sm text-neutral-500 mb-6 font-light">{description}</p>
      )}
      <div className="h-[300px] lg:h-[350px]">
        {children}
      </div>
    </SectionCard>
  );
}
