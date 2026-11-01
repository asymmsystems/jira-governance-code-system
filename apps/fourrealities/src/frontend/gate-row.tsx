/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate row (issue panel, inspect modal) and gate chip (triage table)
 */

import React from 'react';
import { Inline, Lozenge, Stack, Text, Tooltip } from '@forge/react';
import { GATE_NAMES, GateName, GateResult, IssueGates } from '../contract/data/models';
import { GATE_LABEL, appearanceOf, chipText, detailText, glyphOf, sourceLine, stateLabel } from '../ui/gate-text';
import { pipelineTip } from '../ui/pipeline';
import { SubSection } from '../brand/layout';

/** One gate: state with glyph and text, the source line, and one sentence of detail. */
export const GateRow: React.FC<{ gate: GateName; result: GateResult; note?: React.ReactNode }> = ({ gate, result, note }) => (
  <SubSection>
    <Stack space="space.075" alignInline="start">
      <Lozenge maxWidth="100%" appearance={appearanceOf(result)}>
        {`${glyphOf(result)} ${GATE_LABEL[gate]}: ${stateLabel(result)}`}
      </Lozenge>
      <Text>{sourceLine(result)}</Text>
      <Text>{detailText(result)}</Text>
      {note || null}
    </Stack>
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
  <Inline space="space.050" alignBlock="center" shouldWrap>
    {GATE_NAMES.map(g => (
      <GateChip key={g} gate={g} result={gates[g]} />
    ))}
  </Inline>
);
