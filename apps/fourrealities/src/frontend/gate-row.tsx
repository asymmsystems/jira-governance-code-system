/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate row (issue panel, inspect modal) and gate chip (triage table)
 */

import React from 'react';
import { Lozenge, Stack, Text } from '@forge/react';
import { GATE_NAMES, GateName, GateResult, IssueGates } from '../contract/data/models';
import { GATE_LABEL, appearanceOf, chipText, detailText, glyphOf, sourceLine, stateLabel } from '../ui/gate-text';

/** One gate: state with glyph and text, the source line, and one sentence of detail. */
export const GateRow: React.FC<{ gate: GateName; result: GateResult; note?: React.ReactNode }> = ({ gate, result, note }) => (
  <Stack space="space.050">
    <Lozenge maxWidth="100%" appearance={appearanceOf(result)}>
      {`${glyphOf(result)} ${GATE_LABEL[gate]}: ${stateLabel(result)}`}
    </Lozenge>
    <Text>{sourceLine(result)}</Text>
    <Text>{detailText(result)}</Text>
    {note || null}
  </Stack>
);

/** Table chip: the gate name and state as text, never a bare glyph. */
export const GateChip: React.FC<{ gate: GateName; result: GateResult }> = ({ gate, result }) => (
  <Lozenge maxWidth="100%" appearance={appearanceOf(result)}>{`${glyphOf(result)} ${chipText(gate, result)}`}</Lozenge>
);

export const GateChips: React.FC<{ gates: IssueGates }> = ({ gates }) => (
  <Stack space="space.025">
    {GATE_NAMES.map(g => <GateChip key={g} gate={g} result={gates[g]} />)}
  </Stack>
);
