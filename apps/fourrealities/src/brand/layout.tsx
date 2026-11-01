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

const CARD_STYLE = xcss({
  backgroundColor: 'elevation.surface',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'radius.medium',
  padding: 'space.150'
});

const NOTE_BOX_STYLE = xcss({
  backgroundColor: 'color.background.neutral',
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
    <Box xcss={CARD_STYLE}>
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
