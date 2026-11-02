/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate row (issue panel, inspect modal) and gate chip (triage table)
 */

import React from 'react';
import { Inline, Lozenge, Text, Tooltip } from '@forge/react';
import { GATE_NAMES, GateName, GateResult, IssueGates } from '../contract/data/models';
import { GATE_LABEL, appearanceOf, chipText, detailText, glyphOf, sourceLine, stateLabel } from '../ui/gate-text';
import { pipelineTip } from '../ui/pipeline';
import { SPACE, TEXT_ROLE } from '../brand/brand';
import { SubSection } from '../brand/layout';

/** One gate: bold state lozenge, clear finding sentence, and quiet source line. */
export const GateRow: React.FC<{ gate: GateName; result: GateResult; note?: React.ReactNode }> = ({ gate, result, note }) => (
  <SubSection>
    <Lozenge maxWidth="100%" appearance={appearanceOf(result)} isBold>
      {`${glyphOf(result)} ${GATE_LABEL[gate]}: ${stateLabel(result)}`}
    </Lozenge>
    <Text>{detailText(result)}</Text>
    <Text size="small" color={TEXT_ROLE.muted}>{sourceLine(result)}</Text>
    {note || null}
  </SubSection>
);

/** One pipeline chip: glyph, gate name and short state; the tooltip adds the source (B-33). */
export const GateChip: React.FC<{ gate: GateName; result: GateResult }> = ({ gate, result }) => (
  <Tooltip content={pipelineTip(gate, result)}>
    <Lozenge maxWidth="100%" appearance={appearanceOf(result)}>{`${glyphOf(result)} ${chipText(gate, result)}`}</Lozenge>
  </Tooltip>
);

/** The four gates in chain order, Intent to Audit, the same on every surface (B-33). */
export const GatePipeline: React.FC<{ gates: IssueGates }> = ({ gates }) => (
  <Inline space={SPACE.sub} alignBlock="center" shouldWrap>
    {GATE_NAMES.map(g => (
      <GateChip key={g} gate={g} result={gates[g]} />
    ))}
  </Inline>
);
