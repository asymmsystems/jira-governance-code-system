/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * Asymm Systems In-Jira UI layout primitives and accessible card surfaces.
 * Pure UI components implementing the one-border rule, consistent hierarchy, and theme tokens.
 */

import * as React from 'react';
import { Badge, Box, Button, Heading, Inline, Lozenge, Stack, Text, xcss } from '@forge/react';
import { LozengeAppearance, statusToAppearance } from './brand';

const APP_SURFACE_STYLE = xcss({
  backgroundColor: 'elevation.surface.sunken',
  padding: 'space.150'
});

const TWO_COLUMN_STYLE = xcss({
  width: '49%',
  minWidth: '300px'
});

const CARD_STYLE = xcss({
  backgroundColor: 'elevation.surface',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.medium',
  boxShadow: 'elevation.shadow.raised',
  padding: 'space.150'
});

const STATUS_BANNER_STYLE = xcss({
  backgroundColor: 'color.background.accent.teal.subtlest',
  borderColor: 'color.border.accent.teal',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.medium',
  boxShadow: 'elevation.shadow.raised',
  padding: 'space.150'
});

const STATUS_NOTE_STYLE = xcss({
  backgroundColor: 'elevation.surface',
  borderColor: 'color.border.accent.teal.subtle',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.medium',
  padding: 'space.100'
});

const SUMMARY_BLOCK_STYLE = xcss({
  backgroundColor: 'elevation.surface',
  borderColor: 'color.border',
  borderTopColor: 'color.border.accent.teal',
  borderTopWidth: 'border.width.selected',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.medium',
  boxShadow: 'elevation.shadow.raised',
  padding: 'space.150'
});

const GATE_CARD_BASE = {
  backgroundColor: 'elevation.surface',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderTopWidth: 'border.width.selected',
  borderRadius: 'radius.medium',
  boxShadow: 'elevation.shadow.raised',
  padding: 'space.150',
  width: '23.5%',
  minWidth: '220px',
  flexGrow: 1
} as const;

const GATE_CARD_INTENT = xcss({ ...GATE_CARD_BASE, borderTopColor: 'color.border.accent.teal' });
const GATE_CARD_PROCESS = xcss({ ...GATE_CARD_BASE, borderTopColor: 'color.border.accent.orange' });
const GATE_CARD_CODE = xcss({ ...GATE_CARD_BASE, borderTopColor: 'color.border.accent.magenta' });
const GATE_CARD_AUDIT = xcss({ ...GATE_CARD_BASE, borderTopColor: 'color.border.accent.green' });

const NOTE_BOX_STYLE = xcss({
  backgroundColor: 'color.background.neutral',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.medium',
  padding: 'space.100'
});

const SUB_SECTION_STYLE = xcss({
  paddingLeft: 'space.200',
  paddingTop: 'space.050',
  paddingBottom: 'space.050'
});

export interface AppSurfaceProps {
  readonly children: React.ReactNode;
}

export function AppSurface({ children }: AppSurfaceProps): React.JSX.Element {
  return (
    <Box xcss={APP_SURFACE_STYLE}>
      <Stack space="space.150">{children}</Stack>
    </Box>
  );
}

export interface ColumnProps {
  readonly children: React.ReactNode;
}

export function Column({ children }: ColumnProps): React.JSX.Element {
  return (
    <Box xcss={TWO_COLUMN_STYLE}>
      {children}
    </Box>
  );
}

export interface GateCardProps {
  readonly gate: 'intent' | 'process' | 'code' | 'audit';
  readonly children: React.ReactNode;
}

export function GateCard({ gate, children }: GateCardProps): React.JSX.Element {
  const style =
    gate === 'intent' ? GATE_CARD_INTENT :
    gate === 'process' ? GATE_CARD_PROCESS :
    gate === 'code' ? GATE_CARD_CODE :
    GATE_CARD_AUDIT;

  return (
    <Box xcss={style}>
      {children}
    </Box>
  );
}

export interface StatusBannerProps {
  readonly status: string;
  readonly statusWord: string;
  readonly summary: string;
  readonly nextStep: string;
}

export function StatusBanner({
  statusWord,
  summary,
  nextStep
}: StatusBannerProps): React.JSX.Element {
  return (
    <Box xcss={STATUS_BANNER_STYLE}>
      <Stack space="space.100" alignInline="start">
        <Inline alignBlock="center" space="space.050" shouldWrap>
          <Text>Audit readiness:</Text>
          <Badge>{statusWord}</Badge>
        </Inline>
        <Text>{summary}</Text>
        <Box xcss={STATUS_NOTE_STYLE}>
          <Text>{nextStep.startsWith('Next step:') ? nextStep : `Next step: ${nextStep}`}</Text>
        </Box>
      </Stack>
    </Box>
  );
}

export interface PanelHeaderProps {
  readonly title: string;
  readonly statusText?: string;
  readonly statusAppearance?: LozengeAppearance;
  readonly action?: React.ReactNode;
}

export function PanelHeader({ title, statusText, statusAppearance = 'default', action }: PanelHeaderProps): React.JSX.Element {
  return (
    <Inline alignBlock="center" spread="space-between" shouldWrap>
      <Inline alignBlock="center" space="space.100" shouldWrap>
        <Heading size="medium">{title}</Heading>
        {statusText && <Lozenge appearance={statusAppearance}>{statusText}</Lozenge>}
      </Inline>
      {action && <Box>{action}</Box>}
    </Inline>
  );
}

export interface SummaryBlockProps {
  readonly children: React.ReactNode;
}

export function SummaryBlock({ children }: SummaryBlockProps): React.JSX.Element {
  return (
    <Box xcss={SUMMARY_BLOCK_STYLE}>
      <Stack space="space.100">{children}</Stack>
    </Box>
  );
}

export interface CardProps {
  readonly children: React.ReactNode;
}

export function Card({ children }: CardProps): React.JSX.Element {
  return (
    <Box xcss={CARD_STYLE}>
      <Stack space="space.100">{children}</Stack>
    </Box>
  );
}

export interface SectionProps {
  readonly title: string;
  readonly count?: number | string;
  readonly defaultCollapsed?: boolean;
  readonly children: React.ReactNode;
}

export function Section({ title, count, defaultCollapsed = true, children }: SectionProps): React.JSX.Element {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  return (
    <Box xcss={CARD_STYLE}>
      <Stack space="space.100">
        <Inline alignBlock="center" spread="space-between" shouldWrap>
          <Inline alignBlock="center" space="space.100" shouldWrap>
            <Heading size="small">{title}</Heading>
            {count !== undefined && <Badge>{count}</Badge>}
          </Inline>
          <Button appearance="subtle" spacing="compact" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? 'Show details' : 'Hide details'}
          </Button>
        </Inline>
        {!collapsed && <Stack space="space.150">{children}</Stack>}
      </Stack>
    </Box>
  );
}

export interface SubSectionProps {
  readonly children: React.ReactNode;
}

export function SubSection({ children }: SubSectionProps): React.JSX.Element {
  return (
    <Box xcss={SUB_SECTION_STYLE}>
      <Stack space="space.050">{children}</Stack>
    </Box>
  );
}

export interface NoteBoxProps {
  readonly children: React.ReactNode;
}

export function NoteBox({ children }: NoteBoxProps): React.JSX.Element {
  return (
    <Box xcss={NOTE_BOX_STYLE}>
      <Stack space="space.050">{children}</Stack>
    </Box>
  );
}

export interface ActionRowProps {
  readonly children: React.ReactNode;
}

export function ActionRow({ children }: ActionRowProps): React.JSX.Element {
  return (
    <Inline alignBlock="center" space="space.100" shouldWrap>
      {children}
    </Inline>
  );
}

export interface StatusLozengeProps {
  readonly state: string;
  readonly verification?: string;
  readonly children: React.ReactNode;
  readonly isBold?: boolean;
}

export function StatusLozenge({ state, verification, children, isBold }: StatusLozengeProps): React.JSX.Element {
  return (
    <Lozenge appearance={statusToAppearance(state, verification)} isBold={isBold}>
      {children}
    </Lozenge>
  );
}
