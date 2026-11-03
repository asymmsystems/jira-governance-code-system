/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * Asymm Systems In-Jira UI shared layout primitives and accessible card surfaces.
 * Reusable across FourRealities, LedgerSeal, and DefinitionGuard with zero app-specific imports.
 */

import * as React from 'react';
import { Badge, Box, Button, Heading, Inline, Label, Lozenge, Stack, Text, User, xcss } from '@forge/react';
import { LozengeAppearance, SPACE, TEXT_ROLE, TOKENS, statusToAppearance } from './brand';

type TextSize = React.ComponentProps<typeof Text>['size'];
type TextColor = React.ComponentProps<typeof Text>['color'];
type InlineSpace = React.ComponentProps<typeof Inline>['space'];

const APP_SURFACE_STYLE = xcss({
  backgroundColor: TOKENS.surfaceApp,
  borderRadius: TOKENS.radiusSection,
  padding: TOKENS.spacePage
});

const APP_SURFACE_COMPACT_STYLE = xcss({
  backgroundColor: TOKENS.surfaceApp,
  borderRadius: TOKENS.radiusSection,
  padding: TOKENS.spaceGroup
});

const CARD_STYLE = xcss({
  backgroundColor: TOKENS.surfaceSection,
  borderColor: TOKENS.borderSection,
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: TOKENS.radiusSection,
  boxShadow: TOKENS.shadowCard,
  padding: TOKENS.spaceSection,
  height: '100%'
});

const SUMMARY_BLOCK_STYLE = xcss({
  backgroundColor: TOKENS.surfaceSection,
  borderColor: TOKENS.borderSection,
  borderTopColor: TOKENS.borderBrandTeal,
  borderTopWidth: 'border.width.selected',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: TOKENS.radiusSection,
  boxShadow: TOKENS.shadowCard,
  padding: TOKENS.spaceSection
});

const BANNER_BASE = {
  backgroundColor: TOKENS.surfaceSection,
  borderColor: TOKENS.borderSection,
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderLeftWidth: 'border.width.focused',
  borderRadius: TOKENS.radiusSection,
  boxShadow: TOKENS.shadowCard,
  padding: TOKENS.spaceSection
} as const;

const BANNER_DANGER_STYLE = xcss({ ...BANNER_BASE, borderLeftColor: TOKENS.borderBrandRose });
const BANNER_SUCCESS_STYLE = xcss({ ...BANNER_BASE, borderLeftColor: TOKENS.borderBrandSage });
const BANNER_WARNING_STYLE = xcss({ ...BANNER_BASE, borderLeftColor: TOKENS.borderBrandSand });
const BANNER_INFO_STYLE = xcss({ ...BANNER_BASE, borderLeftColor: TOKENS.borderBrandTeal });

const CALLOUT_STRIP_STYLE = xcss({
  backgroundColor: TOKENS.surfaceNote,
  borderRadius: TOKENS.radiusChip,
  paddingBlock: TOKENS.spaceItem,
  paddingInline: TOKENS.spaceGroup
});

const GATE_CARD_BASE = {
  backgroundColor: TOKENS.surfaceSection,
  borderColor: TOKENS.borderSection,
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderTopWidth: 'border.width.selected',
  borderRadius: TOKENS.radiusSection,
  boxShadow: TOKENS.shadowCard,
  padding: TOKENS.spaceSection,
  height: '100%'
} as const;

const GATE_CARD_INTENT = xcss({ ...GATE_CARD_BASE, borderTopColor: TOKENS.borderBrandTeal });
const GATE_CARD_PROCESS = xcss({ ...GATE_CARD_BASE, borderTopColor: TOKENS.borderBrandSand });
const GATE_CARD_CODE = xcss({ ...GATE_CARD_BASE, borderTopColor: TOKENS.borderBrandRose });
const GATE_CARD_AUDIT = xcss({ ...GATE_CARD_BASE, borderTopColor: TOKENS.borderBrandSage });

const STAT_TILE_STYLE = xcss({
  backgroundColor: TOKENS.surfaceNote,
  borderRadius: TOKENS.radiusChip,
  padding: TOKENS.spaceGroup,
  height: '100%'
});

const TABLE_CARD_STYLE = xcss({
  backgroundColor: TOKENS.surfaceSection,
  borderColor: TOKENS.borderSection,
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: TOKENS.radiusSection,
  boxShadow: TOKENS.shadowCard,
  overflow: 'hidden'
});

const TABLE_TOOLBAR_STYLE = xcss({
  backgroundColor: TOKENS.surfaceSubtle,
  borderBottomColor: TOKENS.borderSection,
  borderBottomWidth: 'border.width',
  borderBottomStyle: 'solid',
  padding: TOKENS.spaceSection
});

const TABLE_BODY_STYLE = xcss({
  padding: TOKENS.spaceSection
});

const SECTION_BODY_STYLE = xcss({
  borderTopColor: TOKENS.borderSection,
  borderTopWidth: 'border.width',
  borderTopStyle: 'solid',
  paddingTop: TOKENS.spaceGroup
});

const LIST_ROW_DIVIDED_STYLE = xcss({
  borderBottomColor: TOKENS.borderSection,
  borderBottomWidth: 'border.width',
  borderBottomStyle: 'solid',
  paddingBlock: TOKENS.spaceItem
});

const LIST_ROW_PLAIN_STYLE = xcss({
  paddingBlock: TOKENS.spaceItem
});

const NOTE_BOX_STYLE = xcss({
  backgroundColor: TOKENS.surfaceNote,
  borderRadius: TOKENS.radiusChip,
  paddingBlock: TOKENS.spaceItem,
  paddingInline: TOKENS.spaceGroup
});

const SUB_SECTION_STYLE = xcss({
  paddingLeft: TOKENS.spaceIndent,
  paddingBlock: TOKENS.spaceSub
});

const MODAL_CONTENT_STYLE = xcss({
  paddingBlock: TOKENS.spaceSection,
  paddingInline: TOKENS.spacePage
});

export interface AppSurfaceProps {
  readonly compact?: boolean;
  readonly children: React.ReactNode;
}

export function AppSurface({ compact = false, children }: AppSurfaceProps): React.JSX.Element {
  return (
    <Box xcss={compact ? APP_SURFACE_COMPACT_STYLE : APP_SURFACE_STYLE}>
      <Stack space={compact ? SPACE.group : SPACE.section}>{children}</Stack>
    </Box>
  );
}

export interface PageHeaderProps {
  readonly title: string;
  readonly scopeBadge?: string;
  readonly subtitle?: string;
  readonly metaText?: string;
  readonly action?: React.ReactNode;
}

export function PageHeader({ title, scopeBadge, subtitle, metaText, action }: PageHeaderProps): React.JSX.Element {
  return (
    <Inline alignBlock="center" spread="space-between" space={SPACE.group} shouldWrap>
      <Stack space={SPACE.tight}>
        <Inline alignBlock="center" space={SPACE.item} shouldWrap>
          <Heading size="large">{title}</Heading>
          {scopeBadge ? (
            <Lozenge maxWidth="100%" appearance="default">
              {scopeBadge}
            </Lozenge>
          ) : null}
        </Inline>
        {subtitle ? (
          <Text as="span" size="small" color={TEXT_ROLE.secondary}>
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      {metaText || action ? (
        <Inline alignBlock="center" space={SPACE.group} shouldWrap>
          {metaText ? (
            <Text as="span" size="small" color={TEXT_ROLE.muted}>
              {metaText}
            </Text>
          ) : null}
          {action}
        </Inline>
      ) : null}
    </Inline>
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
    <Inline alignBlock="center" spread="space-between" space={SPACE.item} shouldWrap>
      <Inline alignBlock="center" space={SPACE.item} shouldWrap>
        <Heading size="small">{title}</Heading>
        {statusText ? (
          <Lozenge maxWidth="100%" appearance={statusAppearance} isBold>
            {statusText}
          </Lozenge>
        ) : null}
      </Inline>
      {action ? <Box>{action}</Box> : null}
    </Inline>
  );
}

export interface KeyValueInlineProps {
  readonly label: string;
  readonly value: string;
  readonly size?: TextSize;
  readonly color?: TextColor;
}

export function KeyValueInline({ label, value, size, color }: KeyValueInlineProps): React.JSX.Element {
  return (
    <Inline alignBlock="baseline" space={SPACE.sub} rowSpace={SPACE.tight} shouldWrap>
      <Text as="span" size={size} weight="semibold">
        {label}
      </Text>
      <Text as="span" size={size} color={color}>
        {value}
      </Text>
    </Inline>
  );
}

export interface StatusBannerProps {
  readonly status: string;
  readonly statusWord: string;
  readonly appearance?: LozengeAppearance;
  readonly summary: string;
  readonly nextStep: string;
  readonly action?: React.ReactNode;
}

export function StatusBanner({
  statusWord,
  appearance = 'removed',
  summary,
  nextStep,
  action
}: StatusBannerProps): React.JSX.Element {
  const bannerStyle =
    appearance === 'success' ? BANNER_SUCCESS_STYLE :
    appearance === 'moved' ? BANNER_WARNING_STYLE :
    appearance === 'removed' ? BANNER_DANGER_STYLE :
    BANNER_INFO_STYLE;

  const hasPrefix = nextStep.startsWith('Next step:');
  const stepBody = hasPrefix ? nextStep.slice('Next step:'.length).trim() : nextStep;

  return (
    <Box xcss={bannerStyle}>
      <Stack space={SPACE.group}>
        <Inline alignBlock="center" space={SPACE.item} shouldWrap>
          <Text as="span" size="large" weight="bold">Audit readiness:</Text>
          <Lozenge maxWidth="100%" appearance={appearance} isBold>
            {statusWord}
          </Lozenge>
        </Inline>
        <Text as="span" color={TEXT_ROLE.secondary}>{summary}</Text>
        <Box xcss={CALLOUT_STRIP_STYLE}>
          <Inline alignBlock="center" spread="space-between" space={SPACE.item} shouldWrap>
            {hasPrefix || appearance !== 'success' ? (
              <KeyValueInline label="Next step:" value={stepBody} />
            ) : (
              <Text as="span" weight="medium">{stepBody}</Text>
            )}
            {action}
          </Inline>
        </Box>
      </Stack>
    </Box>
  );
}

const FOUR_COL_CELL_STYLE = xcss({
  width: 'calc(25% - 12px)',
  minWidth: '200px',
  flexGrow: 1
});

const TWO_COL_CELL_STYLE = xcss({
  width: 'calc(50% - 8px)',
  minWidth: '300px',
  flexGrow: 1
});

const THREE_COL_CELL_STYLE = xcss({
  width: 'calc(33.333% - 8px)',
  minWidth: '110px',
  flexGrow: 1
});

export interface GridRowProps {
  readonly children: React.ReactNode;
}

export function FourColumnGrid({ children }: GridRowProps): React.JSX.Element {
  return (
    <Inline alignBlock="stretch" space={SPACE.section} rowSpace={SPACE.section} shouldWrap>
      {React.Children.toArray(children).map((child: React.ReactNode, idx: number) => (
        <Box key={idx} xcss={FOUR_COL_CELL_STYLE}>
          {child}
        </Box>
      ))}
    </Inline>
  );
}

export function TwoColumnGrid({ children }: GridRowProps): React.JSX.Element {
  return (
    <Inline alignBlock="stretch" space={SPACE.section} rowSpace={SPACE.section} shouldWrap>
      {React.Children.toArray(children).map((child: React.ReactNode, idx: number) => (
        <Box key={idx} xcss={TWO_COL_CELL_STYLE}>
          {child}
        </Box>
      ))}
    </Inline>
  );
}

export function ThreeColumnGrid({ children }: GridRowProps): React.JSX.Element {
  return (
    <Inline alignBlock="stretch" space={SPACE.group} rowSpace={SPACE.group} shouldWrap>
      {React.Children.toArray(children).map((child: React.ReactNode, idx: number) => (
        <Box key={idx} xcss={THREE_COL_CELL_STYLE}>
          {child}
        </Box>
      ))}
    </Inline>
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
      <Stack space={SPACE.group}>{children}</Stack>
    </Box>
  );
}

export interface SummaryBlockProps {
  readonly children: React.ReactNode;
}

export function SummaryBlock({ children }: SummaryBlockProps): React.JSX.Element {
  return (
    <Box xcss={SUMMARY_BLOCK_STYLE}>
      <Stack space={SPACE.group}>{children}</Stack>
    </Box>
  );
}

export interface CardProps {
  readonly children: React.ReactNode;
}

export function Card({ children }: CardProps): React.JSX.Element {
  return (
    <Box xcss={CARD_STYLE}>
      <Stack space={SPACE.group}>{children}</Stack>
    </Box>
  );
}

export interface CardHeaderProps {
  readonly title: string;
  readonly count?: number | string;
  readonly subtitle?: string;
  readonly metaText?: string;
  readonly action?: React.ReactNode;
}

export function CardHeader({ title, count, subtitle, metaText, action }: CardHeaderProps): React.JSX.Element {
  return (
    <Stack space={SPACE.tight}>
      <Inline spread="space-between" alignBlock="center" space={SPACE.item} shouldWrap>
        <Inline alignBlock="center" space={SPACE.item} shouldWrap>
          <Heading size="small" as="h4">{title}</Heading>
          {count !== undefined ? <Badge>{count}</Badge> : null}
        </Inline>
        {metaText || action ? (
          <Inline alignBlock="center" space={SPACE.item} shouldWrap>
            {metaText ? (
              <Text as="span" size="small" color={TEXT_ROLE.muted}>
                {metaText}
              </Text>
            ) : null}
            {action}
          </Inline>
        ) : null}
      </Inline>
      {subtitle ? (
        <Text as="span" size="small" color={TEXT_ROLE.secondary}>
          {subtitle}
        </Text>
      ) : null}
    </Stack>
  );
}

export interface StatTileProps {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly caption?: string;
}

export function StatTile({ label, value, caption }: StatTileProps): React.JSX.Element {
  return (
    <Box xcss={STAT_TILE_STYLE}>
      <Stack space={SPACE.sub} alignInline="start">
        <Text as="span" size="small" weight="medium" color={TEXT_ROLE.secondary}>
          {label}
        </Text>
        <Box>{value}</Box>
        {caption ? (
          <Text as="span" size="small" color={TEXT_ROLE.muted}>
            {caption}
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}

const LIST_ROW_MAIN_STYLE = xcss({
  width: 'calc(100% - 96px)',
  minWidth: '180px',
  flexGrow: 1
});

export interface ListRowProps {
  readonly divided?: boolean;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
}

export function ListRow({ divided = true, action, children }: ListRowProps): React.JSX.Element {
  return (
    <Box xcss={divided ? LIST_ROW_DIVIDED_STYLE : LIST_ROW_PLAIN_STYLE}>
      {action ? (
        <Inline alignBlock="center" spread="space-between" space={SPACE.group} shouldWrap>
          <Box xcss={LIST_ROW_MAIN_STYLE}>{children}</Box>
          <Box>{action}</Box>
        </Inline>
      ) : (
        children
      )}
    </Box>
  );
}

export interface TableCardProps {
  readonly title: string;
  readonly count?: number | string;
  readonly metaText?: string;
  readonly headerAction?: React.ReactNode;
  readonly toolbar: React.ReactNode;
  readonly children: React.ReactNode;
}

export function TableCard({ title, count, metaText, headerAction, toolbar, children }: TableCardProps): React.JSX.Element {
  return (
    <Box xcss={TABLE_CARD_STYLE}>
      <Box xcss={TABLE_TOOLBAR_STYLE}>
        <Stack space={SPACE.group}>
          <Inline alignBlock="center" spread="space-between" space={SPACE.item} shouldWrap>
            <Inline alignBlock="center" space={SPACE.item} shouldWrap>
              <Heading size="small" as="h4">{title}</Heading>
              {count !== undefined ? <Badge>{count}</Badge> : null}
            </Inline>
            {metaText || headerAction ? (
              <Inline alignBlock="center" space={SPACE.item} shouldWrap>
                {metaText ? (
                  <Text as="span" size="small" color={TEXT_ROLE.secondary}>
                    {metaText}
                  </Text>
                ) : null}
                {headerAction}
              </Inline>
            ) : null}
          </Inline>
          {toolbar}
        </Stack>
      </Box>
      <Box xcss={TABLE_BODY_STYLE}>{children}</Box>
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
      <Stack space={SPACE.group}>
        <Inline alignBlock="center" spread="space-between" space={SPACE.item} shouldWrap>
          <Inline alignBlock="center" space={SPACE.item} shouldWrap>
            <Heading size="small">{title}</Heading>
            {count !== undefined ? <Badge>{count}</Badge> : null}
          </Inline>
          <Button
            appearance="default"
            spacing="compact"
            iconBefore={collapsed ? 'chevron-right' : 'chevron-down'}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? 'Show details' : 'Hide details'}
          </Button>
        </Inline>
        {!collapsed ? (
          <Box xcss={SECTION_BODY_STYLE}>
            <Stack space={SPACE.group}>{children}</Stack>
          </Box>
        ) : null}
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
      <Stack space={SPACE.compact}>{children}</Stack>
    </Box>
  );
}

export interface NoteBoxProps {
  readonly children: React.ReactNode;
}

export function NoteBox({ children }: NoteBoxProps): React.JSX.Element {
  return (
    <Box xcss={NOTE_BOX_STYLE}>
      <Stack space={SPACE.sub}>{children}</Stack>
    </Box>
  );
}

export interface ModalContentProps {
  readonly children: React.ReactNode;
}

export function ModalContent({ children }: ModalContentProps): React.JSX.Element {
  return (
    <Box xcss={MODAL_CONTENT_STYLE}>
      <Stack space={SPACE.section}>{children}</Stack>
    </Box>
  );
}

export interface FormFieldProps {
  readonly id: string;
  readonly label: string;
  readonly helper?: string;
  readonly children: React.ReactNode;
}

export function FormField({ id, label, helper, children }: FormFieldProps): React.JSX.Element {
  return (
    <Stack space={SPACE.sub}>
      <Label labelFor={id}>{label}</Label>
      {children}
      {helper ? (
        <Text as="span" size="small" color={TEXT_ROLE.muted}>
          {helper}
        </Text>
      ) : null}
    </Stack>
  );
}

export interface LabeledInlineProps {
  readonly label: string;
  readonly space?: InlineSpace;
  readonly children: React.ReactNode;
}

export function LabeledInline({ label, space = SPACE.sub, children }: LabeledInlineProps): React.JSX.Element {
  return (
    <Inline space={space} rowSpace={SPACE.sub} alignBlock="center" shouldWrap>
      <Text as="span" size="small" weight="semibold" color={TEXT_ROLE.secondary}>
        {label}
      </Text>
      {children}
    </Inline>
  );
}

export interface AttributionLineProps {
  readonly prefix: string;
  readonly accountId: string;
  readonly suffix: string;
}

export function AttributionLine({ prefix, accountId, suffix }: AttributionLineProps): React.JSX.Element {
  return (
    <Inline space={SPACE.sub} rowSpace={SPACE.tight} alignBlock="center" shouldWrap>
      <Text as="span" size="small" weight="medium">
        {prefix}
      </Text>
      <User accountId={accountId} />
      <Text as="span" size="small" color={TEXT_ROLE.secondary}>
        {suffix}
      </Text>
    </Inline>
  );
}

export interface ActionRowProps {
  readonly children: React.ReactNode;
}

export function ActionRow({ children }: ActionRowProps): React.JSX.Element {
  return (
    <Inline alignBlock="center" space={SPACE.item} shouldWrap>
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
    <Lozenge maxWidth="100%" appearance={statusToAppearance(state, verification)} isBold={isBold}>
      {children}
    </Lozenge>
  );
}

