/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * Unit tests for brand layout primitives (AppSurface, PanelHeader, SummaryBlock, Section, NoteBox).
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { findAll, findButton, textOf } from '../frontend/forge-mocks';

jest.mock('@forge/react', () => require('../frontend/forge-mocks').reactMock());

import {
  ActionRow,
  AppSurface,
  Card,
  Column,
  NoteBox,
  PanelHeader,
  Section,
  StatusBanner,
  StatusLozenge,
  SubSection,
  SummaryBlock
} from '../../src/brand/layout';

describe('brand layout primitives', () => {
  it('renders AppSurface with sunken background and children', () => {
    const renderer = TestRenderer.create(
      <AppSurface>
        <span>Content</span>
      </AppSurface>
    );
    expect(findAll(renderer.root, 'Box')).toHaveLength(1);
    expect(findAll(renderer.root, 'Stack')).toHaveLength(1);
    expect(textOf(renderer.toJSON())).toContain('Content');
  });

  it('renders PanelHeader with title, status lozenge, and action', () => {
    const renderer = TestRenderer.create(
      <PanelHeader
        title="Four Realities"
        statusText="Incomplete"
        statusAppearance="removed"
        action={<button>Refresh</button>}
      />
    );
    expect(textOf(renderer.toJSON())).toContain('Four Realities');
    expect(textOf(renderer.toJSON())).toContain('Incomplete');
    expect(findAll(renderer.root, 'Lozenge')[0].props.appearance).toBe('removed');
    expect(textOf(renderer.toJSON())).toContain('Refresh');
  });

  it('renders PanelHeader without optional status and action', () => {
    const renderer = TestRenderer.create(<PanelHeader title="Four Realities" />);
    expect(textOf(renderer.toJSON())).toBe('Four Realities');
    expect(findAll(renderer.root, 'Lozenge')).toHaveLength(0);
  });

  it('renders SummaryBlock and Card as bounded surfaces', () => {
    const summary = TestRenderer.create(<SummaryBlock><span>Summary</span></SummaryBlock>);
    expect(textOf(summary.toJSON())).toContain('Summary');
    const card = TestRenderer.create(<Card><span>Card body</span></Card>);
    expect(textOf(card.toJSON())).toContain('Card body');
  });

  it('renders Section collapsed by default and toggles on click', async () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(
        <Section title="Gate findings" count={4} defaultCollapsed={true}>
          <span>Gate detail row</span>
        </Section>
      );
    });

    expect(textOf(renderer.toJSON())).toContain('Gate findings');
    expect(textOf(renderer.toJSON())).toContain('4');
    expect(textOf(renderer.toJSON())).toContain('Show details');
    expect(textOf(renderer.toJSON())).not.toContain('Gate detail row');

    // Expand
    await act(async () => {
      findButton(renderer.root, 'Show details').props.onClick();
    });
    expect(textOf(renderer.toJSON())).toContain('Hide details');
    expect(textOf(renderer.toJSON())).toContain('Gate detail row');

    // Collapse again
    await act(async () => {
      findButton(renderer.root, 'Hide details').props.onClick();
    });
    expect(textOf(renderer.toJSON())).toContain('Show details');
    expect(textOf(renderer.toJSON())).not.toContain('Gate detail row');
  });

  it('renders SubSection, NoteBox, ActionRow, and StatusLozenge', () => {
    const sub = TestRenderer.create(<SubSection><span>Indented</span></SubSection>);
    expect(textOf(sub.toJSON())).toContain('Indented');

    const note = TestRenderer.create(<NoteBox><span>Note text</span></NoteBox>);
    expect(textOf(note.toJSON())).toContain('Note text');

    const row = TestRenderer.create(<ActionRow><button>Action</button></ActionRow>);
    expect(textOf(row.toJSON())).toContain('Action');

    const lozenge = TestRenderer.create(<StatusLozenge state="FOUND" verification="VERIFIED" isBold={true}>Found</StatusLozenge>);
    expect(textOf(lozenge.toJSON())).toContain('Found');
    expect(findAll(lozenge.root, 'Lozenge')[0].props.appearance).toBe('success');
    expect(findAll(lozenge.root, 'Lozenge')[0].props.isBold).toBe(true);

    const col = TestRenderer.create(<Column><span>Col content</span></Column>);
    expect(textOf(col.toJSON())).toContain('Col content');

    const banner = TestRenderer.create(
      <StatusBanner
        status="Audit readiness: Incomplete"
        statusWord="Incomplete"
        summary="Evidence found for 1 of 4 gates."
        nextStep="Next step: link decision record."
      />
    );
    expect(textOf(banner.toJSON())).toContain('Audit readiness: Incomplete');
    expect(textOf(banner.toJSON())).toContain('Incomplete');
    expect(findAll(banner.root, 'Badge')).toHaveLength(1);
    expect(textOf(banner.toJSON())).toContain('Evidence found for 1 of 4 gates.');
    expect(textOf(banner.toJSON())).toContain('Next step: link decision record.');
  });
});
